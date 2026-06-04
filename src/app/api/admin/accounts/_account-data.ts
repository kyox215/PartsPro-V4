import { createClient } from "@/lib/supabase/server";

export const roleTemplates = [
  "admin",
  "auditor",
  "catalog_manager",
  "inventory_manager",
  "pricing_manager",
  "purchasing",
  "sales",
  "sales_support",
  "warehouse",
] as const;

export const profileSelect =
  "id, email, role, account_type, auth_provider, display_name, avatar_url, role_template, customer_id, created_at, updated_at";
export const customerSelect =
  "id, user_id, company_name, contact_name, email, phone, vat_number, fiscal_code, sdi, pec, billing_address, shipping_address, status, customer_type, assignment_status, level, lifetime_spend_net, orders_count, revenue, last_order_at, last_activity_at, profile_completed_at, created_at, updated_at";
const customerActivitySelect =
  "id, user_id, customer_id, event_type, sku_code, product_name, brand, model, model_series, search_query, metadata, created_at";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type DbRow = Record<string, unknown>;

export type AdminAccountDto = {
  accountType: string;
  authProvider: string;
  avatarUrl: string | null;
  createdAt: string | null;
  customer: AdminAccountCustomerDto | null;
  customerId: string | null;
  customerState: "linked" | "profiles_only";
  displayName: string | null;
  email: string | null;
  role: string;
  roleTemplate: string | null;
  updatedAt: string | null;
  userId: string;
};

export type AdminAccountCustomerDto = {
  assignmentStatus: string;
  billingAddress: string | null;
  contactName: string | null;
  createdAt: string | null;
  customerType: string;
  email: string | null;
  fiscalCode: string | null;
  id: string | null;
  lastActivityAt: string | null;
  lastOrderAt: string | null;
  level: string;
  lifetimeSpendNet: number;
  name: string | null;
  ordersCount: number;
  pec: string | null;
  phone: string | null;
  profileCompletedAt: string | null;
  recentActivity: AdminAccountCustomerActivityDto[];
  revenue: number;
  sdi: string | null;
  shippingAddress: string | null;
  status: string;
  updatedAt: string | null;
  userId: string | null;
  vatNumber: string | null;
};

export type AdminAccountCustomerActivityDto = {
  brand: string | null;
  createdAt: string | null;
  customerId: string;
  eventType: string;
  id: string;
  metadata: unknown;
  model: string | null;
  modelSeries: string | null;
  productName: string | null;
  searchQuery: string | null;
  skuCode: string | null;
  userId: string | null;
};

export type AdminAccountMembershipDto = {
  accountType: string;
  avatarUrl: string | null;
  createdAt: string | null;
  customerId: string;
  displayName: string | null;
  email: string | null;
  memberRole: string;
  role: string | null;
  roleTemplate: string | null;
  status: string;
  updatedAt: string | null;
  userId: string;
};

export type AdminAccountAuditEventDto = {
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  createdAt: string | null;
  entityId: string | null;
  entityType: string | null;
  id: string;
  reason: string | null;
  result: string;
};

export type AdminAccountDetailDto = {
  account: AdminAccountDto;
  auditEvents: AdminAccountAuditEventDto[];
  customer: AdminAccountCustomerDto | null;
  memberships: AdminAccountMembershipDto[];
  permissions: string[];
};

export async function readCustomersForProfiles(
  supabase: SupabaseServerClient,
  profiles: DbRow[]
) {
  const contexts = profiles
    .map((profile) => ({
      customerId: readString(profile.customer_id),
      email: readString(profile.email),
      userId: readString(profile.id),
    }))
    .filter((context): context is { customerId: string | null; email: string | null; userId: string } =>
      Boolean(context.userId)
    );
  const customerIds = uniqueStrings(contexts.map((context) => context.customerId).filter(isString));
  const userIds = uniqueStrings(contexts.map((context) => context.userId));
  const emails = uniqueStrings(contexts.map((context) => context.email).filter(isString));
  const rowsById = new Map<string, DbRow>();
  const ownerMembershipCustomerIdsByUserId = new Map<string, string[]>();

  function addRows(rows: unknown) {
    for (const row of Array.isArray(rows) ? rows.filter(isRow) : []) {
      const id = readString(row.id);

      if (id) {
        rowsById.set(id, row);
      }
    }
  }

  if (customerIds.length > 0) {
    const { data } = await supabase
      .from("customers")
      .select(customerSelect)
      .in("id", customerIds);

    addRows(data);
  }

  if (userIds.length > 0) {
    const { data } = await supabase
      .from("customers")
      .select(customerSelect)
      .in("user_id", userIds);

    addRows(data);
  }

  if (userIds.length > 0) {
    const { data } = await supabase
      .from("customer_memberships")
      .select("customer_id, user_id, member_role, status")
      .in("user_id", userIds)
      .eq("status", "active")
      .eq("member_role", "owner");

    for (const row of Array.isArray(data) ? data.filter(isRow) : []) {
      const userId = readString(row.user_id);
      const customerId = readString(row.customer_id);

      if (userId && customerId) {
        ownerMembershipCustomerIdsByUserId.set(userId, [
          ...(ownerMembershipCustomerIdsByUserId.get(userId) ?? []),
          customerId,
        ]);
      }
    }

    const membershipCustomerIds = uniqueStrings(
      Array.from(ownerMembershipCustomerIdsByUserId.values()).flat()
    ).filter((id) => !rowsById.has(id));

    if (membershipCustomerIds.length > 0) {
      const { data: customers } = await supabase
        .from("customers")
        .select(customerSelect)
        .in("id", membershipCustomerIds);

      addRows(customers);
    }
  }

  if (emails.length > 0) {
    const { data } = await supabase
      .from("customers")
      .select(customerSelect)
      .in("email", emails);

    addRows(data);
  }

  const selected = new Map<string, DbRow>();
  const allRows = Array.from(rowsById.values()).filter(isNormalCustomerRow);

  for (const context of contexts) {
    const customer = chooseCustomerForProfile(allRows, {
      ...context,
      ownerMembershipCustomerIds: ownerMembershipCustomerIdsByUserId.get(context.userId) ?? [],
    });

    if (customer) {
      const customerId = readString(customer.id);

      selected.set(context.userId, customer);

      if (customerId) {
        selected.set(customerId, customer);
      }
    }
  }

  return selected;
}

export async function readAdminAccountByUserId(
  supabase: SupabaseServerClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!isRow(data)) {
    return null;
  }

  const customers = await readCustomersForProfiles(supabase, [data]);

  return toAccountDto(data, customers);
}

export async function readAdminAccountDetail(
  supabase: SupabaseServerClient,
  userId: string
): Promise<AdminAccountDetailDto | null> {
  const account = await readAdminAccountByUserId(supabase, userId);

  if (!account) {
    return null;
  }

  const [memberships, permissions, auditEvents] = await Promise.all([
    readAccountMemberships(supabase, account),
    readAccountPermissions(supabase, account),
    readAccountAuditEvents(supabase, account),
  ]);
  const recentActivity = account.customer?.id
    ? await readCustomerRecentActivity(supabase, account.customer.id)
    : [];
  const customer = account.customer
    ? { ...account.customer, recentActivity }
    : null;

  return {
    account: {
      ...account,
      customer,
    },
    auditEvents,
    customer,
    memberships,
    permissions,
  };
}

export function toAccountDto(
  profile: DbRow,
  customers: Map<string, DbRow>
): AdminAccountDto {
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

function chooseCustomerForProfile(
  customers: DbRow[],
  context: {
    customerId: string | null;
    email: string | null;
    ownerMembershipCustomerIds: string[];
    userId: string;
  }
) {
  const ranked = customers
    .map((customer) => ({
      customer,
      rank: customerLinkRank(customer, context),
      timestamp: timestampOf(customer),
    }))
    .filter((entry) => entry.rank > 0);

  ranked.sort((left, right) => {
    const rankDelta = right.rank - left.rank;

    return rankDelta !== 0 ? rankDelta : right.timestamp - left.timestamp;
  });

  return ranked[0]?.customer ?? null;
}

function customerLinkRank(
  customer: DbRow,
  context: {
    customerId: string | null;
    email: string | null;
    ownerMembershipCustomerIds: string[];
    userId: string;
  }
) {
  const customerId = readString(customer.id);
  const customerUserId = readString(customer.user_id);

  if (
    customerId &&
    customerId === context.customerId &&
    (!customerUserId || customerUserId === context.userId)
  ) {
    return 400 + customerTieBreakRank(customer);
  }

  if (customerUserId === context.userId) {
    return 300 + customerTieBreakRank(customer);
  }

  if (
    customerId &&
    context.ownerMembershipCustomerIds.includes(customerId) &&
    (!customerUserId || customerUserId === context.userId)
  ) {
    return 200 + customerTieBreakRank(customer);
  }

  if (
    context.email &&
    equalEmail(readString(customer.email), context.email) &&
    (!customerUserId || customerUserId === context.userId)
  ) {
    return 100 + customerTieBreakRank(customer);
  }

  return 0;
}

function customerTieBreakRank(customer: DbRow) {
  let rank = 0;

  if (readString(customer.status) === "active") {
    rank += 30;
  }

  if (readString(customer.assignment_status) === "assigned") {
    rank += 20;
  } else if (readString(customer.assignment_status) === "needs_review") {
    rank += 10;
  }

  return rank;
}

function isNormalCustomerRow(row: DbRow) {
  const profileKind = readString(row.profile_kind) ?? "customer";

  return profileKind !== "employee_self" && profileKind !== "archived_customer";
}

function timestampOf(row: DbRow) {
  const value = readString(row.updated_at) ?? readString(row.created_at);
  const timestamp = value ? Date.parse(value) : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function equalEmail(left: string | null, right: string) {
  return left?.toLowerCase() === right.toLowerCase();
}

export function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function isRow(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCustomerDto(row: DbRow): AdminAccountCustomerDto {
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
    ordersCount: readNumber(row.orders_count) ?? 0,
    revenue: readNumber(row.revenue) ?? readNumber(row.lifetime_spend_net) ?? 0,
    lastActivityAt: readString(row.last_activity_at),
    lastOrderAt: readString(row.last_order_at),
    recentActivity: [],
    profileCompletedAt: readString(row.profile_completed_at),
    createdAt: readString(row.created_at),
    updatedAt: readString(row.updated_at),
  };
}

async function readAccountMemberships(
  supabase: SupabaseServerClient,
  account: AdminAccountDto
): Promise<AdminAccountMembershipDto[]> {
  let request = supabase
    .from("customer_memberships")
    .select("customer_id, user_id, member_role, status, created_at, updated_at");

  request = account.customer?.id
    ? request.eq("customer_id", account.customer.id)
    : request.eq("user_id", account.userId);

  const { data, error } = await request.order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) {
    return [];
  }

  const rows = data.filter(isRow);
  const userIds = uniqueStrings(rows.map((row) => readString(row.user_id)).filter(isString));
  const profilesById = await readProfilesById(supabase, userIds);

  return rows.map((row) => toMembershipDto(row, profilesById)).filter(isDefined);
}

async function readProfilesById(supabase: SupabaseServerClient, userIds: string[]) {
  const profiles = new Map<string, DbRow>();

  if (userIds.length === 0) {
    return profiles;
  }

  const { data } = await supabase
    .from("profiles")
    .select(profileSelect)
    .in("id", userIds);

  for (const row of Array.isArray(data) ? data.filter(isRow) : []) {
    const id = readString(row.id);

    if (id) {
      profiles.set(id, row);
    }
  }

  return profiles;
}

function toMembershipDto(
  row: DbRow,
  profilesById: Map<string, DbRow>
): AdminAccountMembershipDto | null {
  const customerId = readString(row.customer_id);
  const userId = readString(row.user_id);

  if (!customerId || !userId) {
    return null;
  }

  const profile = profilesById.get(userId);

  return {
    customerId,
    userId,
    email: readString(profile?.email),
    displayName: readString(profile?.display_name),
    avatarUrl: readString(profile?.avatar_url),
    accountType: readString(profile?.account_type) ?? "customer",
    role: readString(profile?.role),
    roleTemplate: readString(profile?.role_template),
    memberRole: readString(row.member_role) ?? "owner",
    status: readString(row.status) ?? "active",
    createdAt: readString(row.created_at),
    updatedAt: readString(row.updated_at),
  };
}

async function readAccountPermissions(
  supabase: SupabaseServerClient,
  account: AdminAccountDto
) {
  const [allPermissions, templatePermissions, overrides] = await Promise.all([
    supabase.from("admin_permissions").select("id"),
    supabase
      .from("admin_role_template_permissions")
      .select("role_template_id, permission_id"),
    supabase
      .from("admin_user_permission_overrides")
      .select("permission_id, effect")
      .eq("user_id", account.userId),
  ]);

  const templateId = account.roleTemplate ?? account.role ?? "customer";
  const permissionSet = new Set<string>();

  for (const row of Array.isArray(templatePermissions.data)
    ? templatePermissions.data.filter(isRow)
    : []) {
    if (readString(row.role_template_id) === templateId) {
      const permissionId = readString(row.permission_id);

      if (permissionId) {
        permissionSet.add(permissionId);
      }
    }
  }

  if (account.role === "admin") {
    for (const row of Array.isArray(allPermissions.data)
      ? allPermissions.data.filter(isRow)
      : []) {
      const permissionId = readString(row.id);

      if (permissionId) {
        permissionSet.add(permissionId);
      }
    }
  }

  for (const row of Array.isArray(overrides.data) ? overrides.data.filter(isRow) : []) {
    const permissionId = readString(row.permission_id);
    const effect = readString(row.effect);

    if (!permissionId) {
      continue;
    }

    if (effect === "deny") {
      permissionSet.delete(permissionId);
    } else if (effect === "grant") {
      permissionSet.add(permissionId);
    }
  }

  return [...permissionSet].sort();
}

async function readAccountAuditEvents(
  supabase: SupabaseServerClient,
  account: AdminAccountDto
): Promise<AdminAccountAuditEventDto[]> {
  const entityIds = uniqueStrings([account.userId, account.customer?.id].filter(isString));

  if (entityIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("admin_audit_events")
    .select("id, action, actor_email, actor_role, entity_id, entity_type, reason, result, created_at")
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.filter(isRow).map((row) => ({
    id: readString(row.id) ?? "",
    action: readString(row.action) ?? "admin.audit",
    actorEmail: readString(row.actor_email),
    actorRole: readString(row.actor_role),
    entityId: readString(row.entity_id),
    entityType: readString(row.entity_type),
    reason: readString(row.reason),
    result: readString(row.result) ?? "ok",
    createdAt: readString(row.created_at),
  }));
}

async function readCustomerRecentActivity(
  supabase: SupabaseServerClient,
  customerId: string
): Promise<AdminAccountCustomerActivityDto[]> {
  const { data, error } = await supabase
    .from("customer_activity_events")
    .select(customerActivitySelect)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.filter(isRow).map((row) => ({
    id: readString(row.id) ?? "",
    userId: readString(row.user_id),
    customerId: readString(row.customer_id) ?? customerId,
    eventType: readString(row.event_type) ?? "activity",
    skuCode: readString(row.sku_code),
    productName: readString(row.product_name),
    brand: readString(row.brand),
    model: readString(row.model),
    modelSeries: readString(row.model_series),
    searchQuery: readString(row.search_query),
    metadata: row.metadata ?? {},
    createdAt: readString(row.created_at),
  }));
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

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
