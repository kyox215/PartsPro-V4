import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody, readQueryParams } from "@/lib/partspro-api";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { requireAdminApi } from "../_shared";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const accountQuerySchema = z
  .object({
    accountType: z.enum(["customer", "employee"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    q: z.string().trim().min(2).max(100).optional(),
  })
  .strict();

const accountPatchSchema = z
  .object({
    accountType: z.enum(["customer", "employee"]),
    customerType: z.enum(["retail", "wholesale"]).optional(),
    reason: z.string().trim().min(3).max(1000),
    roleTemplate: z
      .enum([
        "admin",
        "auditor",
        "catalog_manager",
        "inventory_manager",
        "pricing_manager",
        "purchasing",
        "sales",
        "sales_support",
        "warehouse",
      ])
      .nullable()
      .optional(),
    assignmentStatus: z
      .enum(["needs_review", "assigned", "converted_to_employee", "archived"])
      .optional(),
    userId: z.string().trim().uuid(),
  })
  .strict()
  .refine((value) => value.accountType === "employee" || value.roleTemplate === undefined, {
    message: "roleTemplate can only be set for employee accounts",
    path: ["roleTemplate"],
  });

const accountQueryKeys = new Set(Object.keys(accountQuerySchema.shape));
const profileSelect =
  "id, email, role, account_type, auth_provider, display_name, avatar_url, role_template, customer_id, created_at, updated_at";
const customerSelect =
  "id, user_id, company_name, contact_name, email, phone, vat_number, fiscal_code, sdi, pec, billing_address, shipping_address, status, customer_type, assignment_status, level, lifetime_spend_net, profile_completed_at, created_at, updated_at";

type DbRow = Record<string, unknown>;

export async function GET(request: NextRequest) {
  const query = parseAccountQuery(request);

  if (!query.ok) {
    return query.response;
  }

  const accountType = query.data.accountType ?? "customer";
  const admin = await requireAdminApi(accountType === "employee" ? "employees.read" : "customers.read");

  if (!admin.ok) {
    return admin.response;
  }

  const from = query.data.offset;
  const to = from + query.data.limit - 1;

  try {
    const supabase = await createClient();
    let profileRequest = supabase
      .from("profiles")
      .select(profileSelect, { count: "exact" });

    profileRequest = profileRequest.eq("account_type", accountType);

    if (query.data.q) {
      const search = query.data.q.replace(/[%(),]/g, " ").trim();
      profileRequest = profileRequest.or(
        `email.ilike.%${search}%,display_name.ilike.%${search}%,role.ilike.%${search}%`
      );
    }

    const { data, error, count } = await profileRequest
      .order("created_at", { ascending: false })
      .range(from, to);
    const profiles = Array.isArray(data) ? data.filter(isRow) : [];

    if (error) {
      return apiError(502, "ADMIN_ACCOUNTS_READ_FAILED", "Admin accounts could not be read.");
    }

    const customerIds = profiles
      .map((profile) => readString(profile.customer_id))
      .filter(isString);
    const userIds = profiles.map((profile) => readString(profile.id)).filter(isString);
    const customers = await readCustomersForProfiles(supabase, customerIds, userIds);

    return NextResponse.json({
      data: profiles.map((profile) => toAccountDto(profile, customers)),
      meta: {
        source: "supabase",
        total: count ?? profiles.length,
        limit: query.data.limit,
        offset: query.data.offset,
        returned: profiles.length,
        workflow: "profiles + customers + permissions",
      },
    });
  } catch {
    return apiError(500, "ADMIN_ACCOUNTS_UNAVAILABLE", "Admin accounts are temporarily unavailable.");
  }
}

export async function PATCH(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = accountPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_PAYLOAD", "Account payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const requiredPermission =
    parsed.data.accountType === "employee" || parsed.data.roleTemplate !== undefined
      ? "employees.manage_permissions"
      : "customers.classify";

  if (!hasAdminPermission(admin.authState, requiredPermission)) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission: requiredPermission,
      role: admin.authState.role,
    });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_update_account_type", {
      p_account_type: parsed.data.accountType,
      p_assignment_status: parsed.data.assignmentStatus ?? null,
      p_customer_type: parsed.data.customerType ?? null,
      p_reason: parsed.data.reason,
      p_user_id: parsed.data.userId,
    });

    if (error) {
      return apiError(502, "ADMIN_ACCOUNT_UPDATE_FAILED", "Account could not be updated.", {
        message: error.message,
      });
    }

    let roleData: unknown = null;

    if (parsed.data.accountType === "employee" && parsed.data.roleTemplate) {
      const roleResult = await supabase.rpc("admin_update_employee_role", {
        p_reason: parsed.data.reason,
        p_role_template: parsed.data.roleTemplate,
        p_user_id: parsed.data.userId,
      });

      if (roleResult.error) {
        return apiError(502, "ADMIN_EMPLOYEE_ROLE_UPDATE_FAILED", "Employee role could not be updated.", {
          message: roleResult.error.message,
        });
      }

      roleData = roleResult.data;
    }

    return NextResponse.json({
      data: roleData ?? data,
      meta: {
        source: "supabase_rpc",
        rpc: roleData ? "admin_update_employee_role" : "admin_update_account_type",
      },
    });
  } catch {
    return apiError(500, "ADMIN_ACCOUNT_UPDATE_FAILED", "Account could not be updated.");
  }
}

function parseAccountQuery(request: NextRequest) {
  const parsedParams = readQueryParams(request.nextUrl.searchParams, accountQueryKeys);

  if (!parsedParams.ok) {
    return {
      ok: false as const,
      response: apiError(400, "INVALID_QUERY", "Admin account query parameters are invalid.", parsedParams.details),
    };
  }

  const result = accountQuerySchema.safeParse(parsedParams.data);

  if (!result.success) {
    return {
      ok: false as const,
      response: apiError(400, "INVALID_QUERY", "Admin account query parameters are invalid.", {
        issues: formatZodIssues(result.error),
      }),
    };
  }

  return { ok: true as const, data: result.data };
}

async function readCustomersForProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerIds: string[],
  userIds: string[]
) {
  const customers = new Map<string, DbRow>();

  if (customerIds.length > 0) {
    const { data } = await supabase
      .from("customers")
      .select(customerSelect)
      .in("id", customerIds);

    for (const row of Array.isArray(data) ? data.filter(isRow) : []) {
      const id = readString(row.id);

      if (id) {
        customers.set(id, row);
      }
    }
  }

  if (userIds.length > 0) {
    const { data } = await supabase
      .from("customers")
      .select(customerSelect)
      .in("user_id", userIds);

    for (const row of Array.isArray(data) ? data.filter(isRow) : []) {
      const userId = readString(row.user_id);

      if (userId && !customers.has(userId)) {
        customers.set(userId, row);
      }
    }
  }

  return customers;
}

function toAccountDto(profile: DbRow, customers: Map<string, DbRow>) {
  const profileId = readString(profile.id) ?? "";
  const customerId = readString(profile.customer_id);
  const customer = customerId
    ? customers.get(customerId) ?? customers.get(profileId) ?? null
    : customers.get(profileId) ?? null;
  const linkedCustomerId = customer ? readString(customer.id) : null;

  return {
    userId: profileId,
    email: readString(profile.email),
    displayName: readString(profile.display_name),
    avatarUrl: readString(profile.avatar_url),
    authProvider: readString(profile.auth_provider) ?? "password",
    accountType: readString(profile.account_type) ?? "customer",
    role: readString(profile.role) ?? "customer",
    roleTemplate: readString(profile.role_template),
    customerId: customerId ?? linkedCustomerId,
    customerState: customer ? "linked" : "profiles_only",
    customer: customer ? toCustomerDto(customer) : null,
    createdAt: readString(profile.created_at),
    updatedAt: readString(profile.updated_at),
  };
}

function toCustomerDto(row: DbRow) {
  return {
    id: readString(row.id),
    userId: readString(row.user_id),
    name: readString(row.company_name),
    contactName: readString(row.contact_name),
    email: readString(row.email),
    phone: readString(row.phone),
    vatNumber: readString(row.vat_number),
    fiscalCode: readString(row.fiscal_code),
    sdi: readString(row.sdi),
    pec: readString(row.pec),
    billingAddress: readString(row.billing_address),
    shippingAddress: readString(row.shipping_address),
    status: readString(row.status) ?? "pending",
    customerType: readString(row.customer_type) ?? "retail",
    assignmentStatus: readString(row.assignment_status) ?? "needs_review",
    level: readString(row.level) ?? "bronze",
    lifetimeSpendNet: readNumber(row.lifetime_spend_net) ?? 0,
    profileCompletedAt: readString(row.profile_completed_at),
    createdAt: readString(row.created_at),
    updatedAt: readString(row.updated_at),
  };
}

function isRow(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
