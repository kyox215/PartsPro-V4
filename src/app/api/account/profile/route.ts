import { NextResponse } from "next/server";
import { accountProfileSchema } from "@/lib/partspro-account-profile-validation";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  getCurrentCustomerProfile,
  getCurrentEmployeeSelfProfile,
  RepositoryWriteError,
  updateCurrentCustomerProfile,
} from "@/lib/partspro-repository";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const account = await getCurrentAccountContext({ ensure: true });
    const profile =
      account.accountType === "employee"
        ? await getCurrentEmployeeSelfProfile()
        : await getCurrentCustomerProfile();

    return NextResponse.json({
      data: profile.data,
      meta: {
        source: profile.source,
        ...warningsMeta(profile.warning),
      },
    });
  } catch (error) {
    return repositoryApiError(error, "ACCOUNT_PROFILE_UNAVAILABLE");
  }
}

export async function PATCH(request: Request) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = accountProfileSchema.safeParse(body.data);

  if (!result.success) {
    return apiError(400, "INVALID_ACCOUNT_PROFILE", "Account profile is invalid.", {
      issues: formatZodIssues(result.error),
    });
  }

  try {
    const userEmail = await readCurrentUserEmail();

    if (!userEmail) {
      return apiError(401, "ACCOUNT_PROFILE_AUTH_REQUIRED", "Authentication is required.");
    }

    const updated = await updateCurrentCustomerProfile({
      ...result.data,
      email: userEmail,
    });

    return NextResponse.json({
      data: updated.data,
      meta: {
        source: updated.source,
      },
    });
  } catch (error) {
    return repositoryApiError(error, "ACCOUNT_PROFILE_UPDATE_FAILED");
  }
}

async function readCurrentUserEmail() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return null;
  }

  return user.email.trim();
}

function repositoryApiError(error: unknown, fallbackCode: string) {
  if (error instanceof RepositoryWriteError) {
    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, "Account profile is temporarily unavailable.");
}

function warningsMeta(warning: string | undefined) {
  return warning ? { warning } : {};
}
