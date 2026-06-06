import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const customerProfilePatchSchema = z
  .object({
    billingAddress: z.string().trim().min(1).max(240),
    companyName: z.string().trim().min(1).max(160),
    contactName: z.string().trim().max(120).optional().default(""),
    fiscalCode: z.string().trim().min(1).max(32),
    pec: z.string().trim().max(160).optional().default(""),
    phone: z.string().trim().min(5).max(40),
    reason: z.string().trim().min(3).max(1000),
    shippingAddress: z.string().trim().min(1).max(240),
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

  const parsed = customerProfilePatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_CUSTOMER_PROFILE", "Customer profile payload is invalid.", {
      issues: formatZodIssues(parsed.error),
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
    const requiredPermission = isEmployee ? "employees.manage_permissions" : "customers.classify";

    if (!hasAdminPermission(admin.authState, requiredPermission)) {
      return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
        permission: requiredPermission,
        role: admin.authState.role,
      });
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

    if (!email) {
      return apiError(400, "ADMIN_ACCOUNT_EMAIL_REQUIRED", "Account login email is required before editing the profile.", {
        userId: paramResult.data.userId,
      });
    }

    await updateAdminCustomerProfile(editableProfile.profileCustomer.id, {
      billingAddress: parsed.data.billingAddress,
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName,
      email,
      fiscalCode: parsed.data.fiscalCode,
      pec: parsed.data.pec,
      phone: parsed.data.phone,
      reason: parsed.data.reason,
      shippingAddress: parsed.data.shippingAddress,
    });

    const detail = await readAdminAccountDetail(supabase, paramResult.data.userId);

    if (!detail) {
      return apiError(404, "ADMIN_ACCOUNT_NOT_FOUND", "Account was updated but could not be reloaded.", {
        userId: paramResult.data.userId,
      });
    }

    return NextResponse.json({
      data: detail,
      meta: { source: "supabase_rpc", rpc: "admin_update_customer_profile" },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ACCOUNT_CUSTOMER_PROFILE_UPDATE_FAILED",
      "Customer profile could not be updated at this time."
    );
  }
}
