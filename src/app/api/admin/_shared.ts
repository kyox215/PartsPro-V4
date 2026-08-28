import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readJsonBody,
  readQueryParams,
} from "@/lib/partspro-api";
import {
  getAdminAuthState,
  hasAdminPermission,
} from "@/lib/partspro-admin-auth";
import { supplierBatchCostPermissions } from "@/lib/partspro-permissions";
import type { AdminAuthState } from "@/lib/partspro-admin-auth";
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

export async function parseAdminJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: ReturnType<typeof apiError> }
> {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return {
      ok: false,
      response: apiError(400, "INVALID_BODY", "Request body must be valid JSON."),
    };
  }

  const parsed = schema.safeParse(body.data);

  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(400, "INVALID_BODY", "Request body is invalid.", {
        issues: formatZodIssues(parsed.error),
      }),
    };
  }

  return { ok: true, data: parsed.data };
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

export function hasSupplierBatchReadPermission(authState: AdminAuthState) {
  return (
    hasAdminPermission(authState, "product.read_admin") ||
    hasAdminPermission(authState, "products.read_admin")
  );
}

/** Cost history and correction-link projections are deliberately narrower than
 * the base catalog/batch reader.  A product reader may enumerate batches and
 * see non-audit cost status, but only the dedicated supplier-batch reader may
 * invoke the history RPC. */
export function hasSupplierBatchHistoryPermission(authState: AdminAuthState) {
  return hasAdminPermission(authState, supplierBatchCostPermissions.read);
}

/** V2 formal actions use dedicated capabilities; legacy manage_costs is not
 * accepted for irreversible confirmation or correction. */
export function hasSupplierBatchCostPermission(
  authState: AdminAuthState,
  operation: "read" | "estimate" | "confirm" | "correct" | "export"
) {
  if (operation === "read") {
    return hasSupplierBatchReadPermission(authState);
  }
  if (operation === "estimate") {
    return (
      hasAdminPermission(authState, supplierBatchCostPermissions.estimate) ||
      hasAdminPermission(authState, supplierBatchCostPermissions.legacyManage)
    );
  }
  return hasAdminPermission(authState, supplierBatchCostPermissions[operation]);
}

/** Audit actor and before/after projections require an explicit reconciliation
 * or export capability; ordinary catalog readers receive status/history links
 * without sensitive audit payloads. */
export function hasSupplierBatchAuditPermission(authState: AdminAuthState) {
  return (
    hasAdminPermission(authState, "finance.cost_reconcile") ||
    hasAdminPermission(authState, supplierBatchCostPermissions.export)
  );
}

export function basicCustomerManagementDisabledResponse(feature: string) {
  return apiError(
    410,
    "CUSTOMER_BASIC_LEGACY_FEATURE_DISABLED",
    "This legacy customer-management workflow is disabled in the basic customer management version.",
    {
      feature,
      mode: "basic_customer_management",
    }
  );
}
