import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  getCurrentCustomerProfile,
  RepositoryWriteError,
  updateCurrentCustomerProfile,
} from "@/lib/partspro-repository";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z
  .object({
    billingAddress: z.string().trim().min(1).max(240),
    companyName: z.string().trim().min(1).max(160),
    contactName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(160),
    fiscalCode: z.string().trim().max(32).optional(),
    pec: z.string().trim().email().max(160).optional().or(z.literal("")),
    phone: z.string().trim().min(5).max(40),
    sdi: z.string().trim().max(16).optional(),
    shippingAddress: z.string().trim().min(1).max(240),
    vatNumber: z.string().trim().max(32).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.vatNumber || value.fiscalCode), {
    message: "VAT number or fiscal code is required.",
    path: ["vatNumber"],
  })
  .refine((value) => Boolean(value.pec || value.sdi), {
    message: "PEC or SDI is required for checkout.",
    path: ["pec"],
  });

export async function GET() {
  try {
    const profile = await getCurrentCustomerProfile();

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

  const result = profileSchema.safeParse(body.data);

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
