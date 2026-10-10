import { NextRequest } from "next/server";
import { z } from "zod";
import { accountProfilePatchSchema } from "@/lib/admin-account-operation.mjs";
import { savedAccountResponse } from "../../_saved-account-response";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import {
  ensureAdminCustomerProfile,
  ensureAdminEmployeeSelfCustomer,
  updateAdminCustomerProfile,
} from "@/lib/partspro-repository";
import { createClient } from "@/lib/supabase/server";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import {
  readAdminAccountDetail,
  readEditableAdminAccountProfileCustomerByUserId,
} from "../../_account-data";

export const dynamic = "force-dynamic";

const accountParamSchema = z
  .object({
    userId: z.string().trim().uuid(),
  })
  .strict();

type AccountParams = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, { params }: AccountParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const paramResult = accountParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_ID", "Account user id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = accountProfilePatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_CUSTOMER_PROFILE", "Customer profile payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

    const requiredPermission = "customers.classify";

    if (!hasAdminPermission(admin.authState, requiredPermission)) {
      return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
        permission: requiredPermission,
        role: admin.authState.role,
      });
    }

  try {
    const supabase = await createClient();
    let editableProfile = await readEditableAdminAccountProfileCustomerByUserId(
      supabase,
      paramResult.data.userId
    );

    if (!editableProfile) {
      return apiError(404, "ADMIN_ACCOUNT_NOT_FOUND", "Account was not found.", {
        userId: paramResult.data.userId,
      });
    }

    const isEmployee = editableProfile.account.accountType === "employee";
    if (!editableProfile.profileCustomer?.id && parsed.data.mode === "correction") {
      return apiError(409, "ACCOUNT_PROFILE_NOT_INITIALIZED", "Complete the profile before correcting an uninitialized profile.");
    }
    if (!editableProfile.profileCustomer?.id) {
      if (isEmployee) {
        await ensureAdminEmployeeSelfCustomer(paramResult.data.userId, parsed.data.reason);
      } else {
        await ensureAdminCustomerProfile(paramResult.data.userId, parsed.data.reason);
      }

      editableProfile = await readEditableAdminAccountProfileCustomerByUserId(
        supabase,
        paramResult.data.userId
      );
    }

    if (!editableProfile?.profileCustomer?.id) {
      return apiError(502, "ADMIN_ACCOUNT_PROFILE_ENSURE_FAILED", "Account profile could not be initialized.", {
        userId: paramResult.data.userId,
      });
    }

    const email = editableProfile.account.email ?? editableProfile.profileCustomer.email;

    if (!email && parsed.data.mode === "complete") {
      return apiError(400, "ADMIN_ACCOUNT_EMAIL_REQUIRED", "Account login email is required before editing the profile.", {
        userId: paramResult.data.userId,
      });
    }

    await updateAdminCustomerProfile(editableProfile.profileCustomer.id, {
      billingAddress: parsed.data.billingAddress,
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName,
      ...(parsed.data.mode === "complete" ? { email } : {}),
      fiscalCode: parsed.data.fiscalCode,
      pec: parsed.data.pec,
      phone: parsed.data.phone,
      reason: parsed.data.reason,
      shippingAddress: parsed.data.shippingAddress,
    });

    return savedAccountResponse(() => readAdminAccountDetail(supabase, paramResult.data.userId), "admin_update_customer_profile");
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ACCOUNT_CUSTOMER_PROFILE_UPDATE_FAILED",
      "Customer profile could not be updated at this time."
    );
  }
}
