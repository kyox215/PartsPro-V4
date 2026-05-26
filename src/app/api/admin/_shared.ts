import { z } from "zod";
import { apiError, formatZodIssues, readQueryParams } from "@/lib/partspro-api";
import {
  getAdminAuthState,
  hasAdminPermission,
} from "@/lib/partspro-admin-auth";
import { RepositoryWriteError } from "@/lib/partspro-repository";

export async function requireAdminApi(permission?: string) {
  const authState = await getAdminAuthState();

  if (!authState.allowed) {
    return {
      ok: false as const,
      response: apiError(
        authState.reason === "missing_session" ? 401 : 403,
        "ADMIN_FORBIDDEN",
        "Only staff users can access this admin API.",
        { reason: authState.reason }
      ),
    };
  }

  if (permission && !hasAdminPermission(authState, permission)) {
    return {
      ok: false as const,
      response: apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
        permission,
        role: authState.role,
      }),
    };
  }

  return { ok: true as const, authState };
}

export function parseAdminQuery<T extends z.ZodObject>(
  params: URLSearchParams,
  schema: T
):
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: ReturnType<typeof apiError> } {
  const parsedParams = readQueryParams(params, new Set(Object.keys(schema.shape)));

  if (!parsedParams.ok) {
    return {
      ok: false,
      response: apiError(
        400,
        "INVALID_QUERY",
        "Admin query parameters are invalid.",
        parsedParams.details
      ),
    };
  }

  const result = schema.safeParse(parsedParams.data);

  if (!result.success) {
    return {
      ok: false,
      response: apiError(400, "INVALID_QUERY", "Admin query parameters are invalid.", {
        issues: formatZodIssues(result.error),
      }),
    };
  }

  return { ok: true, data: result.data };
}

export function repositoryErrorResponse(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
) {
  if (error instanceof RepositoryWriteError) {
    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, fallbackMessage);
}
