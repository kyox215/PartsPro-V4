import { calculateTierPrice, normalizeCustomerTier } from "@/lib/partspro-pricing";
import { visiblePanelsForPermissions } from "@/lib/partspro-permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type {
  CustomerAssignmentStatus,
  CustomerLevel,
  CustomerType,
  PartProduct,
} from "@/lib/partspro-data";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type DbRow = Record<string, unknown>;

export type AccountType = "customer" | "employee";

export type AccountCustomerContext = {
  assignmentStatus: CustomerAssignmentStatus;
  customerType: CustomerType;
  id: string;
  level: CustomerLevel;
  lifetimeSpendNet: number;
  name: string;
  profileCompletedAt: string | null;
  status: string;
};

export type AccountContext = {
  accountType: AccountType | null;
  authenticated: boolean;
  canCheckout: boolean;
  canViewPrices: boolean;
  customer: AccountCustomerContext | null;
  email: string | null;
  permissions: string[];
  role: string | null;
  roleTemplate: string | null;
  userId: string | null;
  visiblePanels: string[];
};

export const anonymousAccountContext: AccountContext = {
  accountType: null,
  authenticated: false,
  canCheckout: false,
  canViewPrices: false,
  customer: null,
  email: null,
  permissions: [],
  role: null,
  roleTemplate: null,
  userId: null,
  visiblePanels: [],
};

export async function ensureCurrentUserAccount() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  await supabase.rpc("ensure_current_user_account");

  return user;
}

export async function getCurrentAccountContext(options: { ensure?: boolean } = {}) {
  if (!isSupabaseConfigured()) {
    return anonymousAccountContext;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return anonymousAccountContext;
  }

  if (options.ensure) {
    await supabase.rpc("ensure_current_user_account");
  }

  const [profile, permissions] = await Promise.all([
    readProfile(supabase, user.id),
    readPermissions(supabase),
  ]);
  const customerId = readString(profile?.customer_id);
  const customer = customerId
    ? await readCustomer(supabase, customerId)
    : await readCustomerByUserId(supabase, user.id);
  const accountType = normalizeAccountType(readString(profile?.account_type));
  const customerContext = customer ? toCustomerContext(customer) : null;
  const isEmployee = accountType === "employee";
  const canViewPrices = Boolean(user && (isEmployee || customerContext));
  const canCheckout = Boolean(
    accountType === "customer" &&
      customerContext &&
      customerContext.status === "active" &&
      isCustomerProfileComplete(customer)
  );

  return {
    accountType,
    authenticated: true,
    canCheckout,
    canViewPrices,
    customer: customerContext,
    email: user.email ?? readString(profile?.email),
    permissions,
    role: readString(profile?.role),
    roleTemplate: readString(profile?.role_template),
    userId: user.id,
    visiblePanels: visiblePanelsForPermissions(permissions),
  } satisfies AccountContext;
}

export function isCustomerProfileComplete(row: DbRow | null | undefined) {
  if (!row) {
    return false;
  }

  const customerType = normalizeCustomerType(readString(row.customer_type));
  const sharedFields = [
    readString(row.contact_name),
    readString(row.email),
    readString(row.phone),
    readString(row.billing_address),
    readString(row.shipping_address),
  ];

  if (sharedFields.some((value) => !value)) {
    return false;
  }

  if (customerType === "retail") {
    return Boolean(readString(row.fiscal_code) || readString(row.vat_number));
  }

  return Boolean(
    readString(row.company_name) &&
      readString(row.vat_number) &&
      readString(row.fiscal_code) &&
      readString(row.registered_address) &&
      (readString(row.pec) || readString(row.sdi))
  );
}

export function applyAccountPriceToProduct(
  product: PartProduct,
  account: AccountContext
): PartProduct {
  if (!account.canViewPrices) {
    return {
      ...product,
      price: 0,
      retailPrice: 0,
    };
  }

  const customerType = account.customer?.customerType ?? "retail";
  const level = account.customer?.level ?? "bronze";
  const basePrice = customerType === "wholesale" ? product.price : product.retailPrice;
  const finalPrice = calculateTierPrice(basePrice, level);

  return {
    ...product,
    price: finalPrice,
    retailPrice: product.retailPrice,
  };
}

export function priceVisibilityReason(account: AccountContext) {
  if (!account.authenticated) {
    return "login_required";
  }

  if (account.accountType === "employee") {
    return "employee";
  }

  if (account.customer?.assignmentStatus === "needs_review") {
    return "customer_needs_assignment";
  }

  return "customer";
}

async function readProfile(client: SupabaseServerClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, email, role, account_type, role_template, customer_id")
    .eq("id", userId)
    .maybeSingle();

  return error ? null : asRow(data);
}

async function readPermissions(client: SupabaseServerClient) {
  const { data, error } = await client.rpc("partspro_my_permissions");

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.filter((permission): permission is string => typeof permission === "string");
}

async function readCustomer(client: SupabaseServerClient, customerId: string) {
  const { data, error } = await client
    .from("customers")
    .select(
      "id, company_name, status, customer_type, assignment_status, level, lifetime_spend_net, profile_completed_at, contact_name, email, phone, vat_number, fiscal_code, sdi, pec, registered_address, billing_address, shipping_address"
    )
    .eq("id", customerId)
    .maybeSingle();

  return error ? null : asRow(data);
}

async function readCustomerByUserId(client: SupabaseServerClient, userId: string) {
  const { data, error } = await client
    .from("customers")
    .select(
      "id, company_name, status, customer_type, assignment_status, level, lifetime_spend_net, profile_completed_at, contact_name, email, phone, vat_number, fiscal_code, sdi, pec, registered_address, billing_address, shipping_address"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return error ? null : asRow(data);
}

function toCustomerContext(row: DbRow): AccountCustomerContext {
  const level = normalizeCustomerTier(readString(row.level));

  return {
    assignmentStatus: normalizeAssignmentStatus(readString(row.assignment_status)),
    customerType: normalizeCustomerType(readString(row.customer_type)),
    id: readString(row.id) ?? "",
    level,
    lifetimeSpendNet: readNumber(row.lifetime_spend_net) ?? 0,
    name: readString(row.company_name) ?? "Cliente PartsPro",
    profileCompletedAt: readString(row.profile_completed_at),
    status: readString(row.status) ?? "pending",
  };
}

function normalizeAccountType(value: string | null): AccountType {
  return value === "employee" ? "employee" : "customer";
}

function normalizeCustomerType(value: string | null): CustomerType {
  return value === "wholesale" ? "wholesale" : "retail";
}

function normalizeAssignmentStatus(value: string | null): CustomerAssignmentStatus {
  if (
    value === "assigned" ||
    value === "converted_to_employee" ||
    value === "archived" ||
    value === "needs_review"
  ) {
    return value;
  }

  return "needs_review";
}

function asRow(value: unknown): DbRow | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DbRow)
    : null;
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
