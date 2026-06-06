import { createClient } from "@/lib/supabase/server";

export const roleTemplates = [
  "admin",
  "auditor",
  "catalog_manager",
  "commerce_manager",
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
  "id, user_id, company_name, contact_name, email, phone, vat_number, fiscal_code, sdi, pec, billing_address, shipping_address, status, customer_type, assignment_status, profile_kind, level, lifetime_spend_net, orders_count, revenue, last_order_at, last_activity_at, profile_completed_at, converted_to_employee_at, created_at, updated_at";
const customerActivitySelect =
  "id, user_id, customer_id, event_type, sku_code, product_name, brand, model, model_series, search_query, metadata, created_at";
const customerOrderSelect =
  "id, order_no, status, payment_status, total_net, vat, shipping, created_at, updated_at";

export type AdminAccountDetailInclude = "activity" | "audit" | "orders";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseSelectQuery = ReturnType<ReturnType<SupabaseServerClient["from"]>["select"]>;
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
  profileCustomer: AdminAccountCustomerDto | null;
  profileState: AdminAccountProfileStateDto;
  role: string;
  roleTemplate: string | null;
  updatedAt: string | null;
  userId: string;
};

export type AdminAccountProfileStateDto = {
  kind: "customer" | "employee_self";
  missingFields: string[];
  status: "complete" | "incomplete" | "missing";
};

export type AdminAccountCustomerDto = {
  assignmentStatus: string;
  billingAddress: string | null;
  contactName: string | null;
  convertedToEmployeeAt: string | null;
  createdAt: string | null;
  customerType: string;
  email: string | null;
  fiscalCode: string | null;
  id: string | null;
  lastActivityAt: string | null;
  lastOrderAt: string | null;
  level: string;
  lifetimeSpendNet: number;
  orders: AdminAccountCustomerOrderDto[];
  name: string | null;
  ordersCount: number;
  pec: string | null;
  phone: string | null;
  profileCompletedAt: string | null;
  profileKind: string;
  recentActivity: AdminAccountCustomerActivityDto[];
  revenue: number;
  sdi: string | null;
  shippingAddress: string | null;
  spendSummary: AdminAccountCustomerSpendSummaryDto;
  status: string;
  updatedAt: string | null;
  userId: string | null;
  vatNumber: string | null;
};

export type AdminAccountCustomerOrderDto = {
  createdAt: string | null;
  id: string;
  lineCount: number;
  orderNo: string;
  paymentStatus: string;
  shipping: number;
  status: string;
  total: number;
  totalNet: number;
  updatedAt: string | null;
  vat: number;
};

export type AdminAccountCustomerSpendSummaryDto = {
  cancelledAmount: number;
  orderCount: number;
  paidAmount: number;
  pendingAmount: number;
  refundedAmount: number;
  shipping: number;
  total: number;
  totalNet: number;
  vat: number;
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
  profileCustomer: AdminAccountCustomerDto | null;
  profileState: AdminAccountProfileStateDto;
};

export type ReadAdminAccountDetailOptions = {
  include?: readonly AdminAccountDetailInclude[];
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

export async function readProfileCustomersForProfiles(
  supabase: SupabaseServerClient,
  profiles: DbRow[],
  customers: Map<string, DbRow>
) {
  const profileCustomers = new Map<string, DbRow>();
  const employeeUserIds = profiles
    .filter((profile) => readString(profile.account_type) === "employee")
    .map((profile) => readString(profile.id))
    .filter(isString);

  for (const profile of profiles) {
    const profileId = readString(profile.id);
    const normalCustomer = profileId ? customers.get(profileId) : null;

    if (profileId && normalCustomer) {
      profileCustomers.set(profileId, normalCustomer);
    }
  }

  if (employeeUserIds.length === 0) {
    return profileCustomers;
  }

  const { data } = await supabase
    .from("customers")
    .select(customerSelect)
    .in("user_id", uniqueStrings(employeeUserIds))
    .eq("profile_kind", "employee_self")
    .order("updated_at", { ascending: false });

  for (const row of Array.isArray(data) ? data.filter(isRow) : []) {
    const userId = readString(row.user_id);
    const customerId = readString(row.id);

    if (userId && !profileCustomers.has(userId)) {
      profileCustomers.set(userId, row);
    }

    if (customerId) {
      profileCustomers.set(customerId, row);
    }
  }

  return profileCustomers;
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

  const customer = await readCustomerForProfile(supabase, data);
  const profileCustomer =
    readString(data.account_type) === "employee"
      ? await readEmployeeSelfCustomerForProfile(supabase, data)
      : customer;
  const customers = new Map<string, DbRow>();
  const profileCustomers = new Map<string, DbRow>();

  if (customer) {
    const customerId = readString(customer.id);

    customers.set(userId, customer);

    if (customerId) {
      customers.set(customerId, customer);
    }
  }

  if (profileCustomer) {
    const profileId = readString(data.id);
    const profileCustomerId = readString(profileCustomer.id);

    if (profileId) {
      profileCustomers.set(profileId, profileCustomer);
    }

    if (profileCustomerId) {
      profileCustomers.set(profileCustomerId, profileCustomer);
    }
  }

  return toAccountDto(data, customers, profileCustomers);
}

export async function readEditableAdminAccountCustomerByUserId(
  supabase: SupabaseServerClient,
  userId: string
) {
  const account = await readAdminAccountByUserId(supabase, userId);

  if (!account) {
    return null;
  }

  return {
    account,
    customer: account.customer,
  };
}

export async function readEditableAdminAccountProfileCustomerByUserId(
  supabase: SupabaseServerClient,
  userId: string
) {
  const account = await readAdminAccountByUserId(supabase, userId);

  if (!account) {
    return null;
  }

  return {
    account,
    profileCustomer: account.profileCustomer,
    profileState: account.profileState,
  };
}

async function readCustomerForProfile(
  supabase: SupabaseServerClient,
  profile: DbRow
) {
  const context = {
    customerId: readString(profile.customer_id),
    email: readString(profile.email),
    ownerMembershipCustomerIds: [] as string[],
    userId: readString(profile.id) ?? "",
  };

  if (!context.userId) {
    return null;
  }

  if (context.customerId) {
    const customer = await readFirstMatchingCustomer(supabase, context, (request) =>
      request.eq("id", context.customerId)
    );

    if (customer) {
      return customer;
    }
  }

  const ownedCustomer = await readFirstMatchingCustomer(supabase, context, (request) =>
    request.eq("user_id", context.userId)
  );

  if (ownedCustomer) {
    return ownedCustomer;
  }

  const { data: memberships } = await supabase
    .from("customer_memberships")
    .select("customer_id")
    .eq("user_id", context.userId)
    .eq("status", "active")
    .eq("member_role", "owner")
    .limit(5);
  const membershipCustomerIds = uniqueStrings(
    (Array.isArray(memberships) ? memberships.filter(isRow) : [])
      .map((row) => readString(row.customer_id))
      .filter(isString)
  );

  if (membershipCustomerIds.length > 0) {
    context.ownerMembershipCustomerIds = membershipCustomerIds;

    const membershipCustomer = await readFirstMatchingCustomer(supabase, context, (request) =>
      request.in("id", membershipCustomerIds)
    );

    if (membershipCustomer) {
      return membershipCustomer;
    }
  }

  if (context.email) {
    return readFirstMatchingCustomer(supabase, context, (request) =>
      request.eq("email", context.email)
    );
  }

  return null;
}

async function readEmployeeSelfCustomerForProfile(
  supabase: SupabaseServerClient,
  profile: DbRow
) {
  const profileId = readString(profile.id);
  const customerId = readString(profile.customer_id);

  if (!profileId) {
    return null;
  }

  if (customerId) {
    const { data } = await supabase
      .from("customers")
      .select(customerSelect)
      .eq("id", customerId)
      .eq("profile_kind", "employee_self")
      .maybeSingle();

    if (isRow(data)) {
      return data;
    }
  }

  const { data } = await supabase
    .from("customers")
    .select(customerSelect)
    .eq("user_id", profileId)
    .eq("profile_kind", "employee_self")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return isRow(data) ? data : null;
}

async function readFirstMatchingCustomer(
  supabase: SupabaseServerClient,
  context: {
    customerId: string | null;
    email: string | null;
    ownerMembershipCustomerIds: string[];
    userId: string;
  },
  applyFilter: (
    request: SupabaseSelectQuery
  ) => PromiseLike<{ data: unknown }> | { data: unknown }
) {
  const request = supabase
    .from("customers")
    .select(customerSelect)
    .order("updated_at", { ascending: false })
    .limit(5);
  const filteredRequest = request as unknown as SupabaseSelectQuery;
  const { data } = (await applyFilter(filteredRequest)) as {
    data: unknown;
  };
  const rows = Array.isArray(data) ? data.filter(isRow).filter(isNormalCustomerRow) : [];

  return chooseCustomerForProfile(rows, context);
}

export async function readAdminAccountDetail(
  supabase: SupabaseServerClient,
  userId: string,
  options: ReadAdminAccountDetailOptions = {}
): Promise<AdminAccountDetailDto | null> {
  const include = new Set(options.include ?? []);
  const account = await readAdminAccountByUserId(supabase, userId);

  if (!account) {
    return null;
  }

  const [memberships, permissions, auditEvents] = await Promise.all([
    readAccountMemberships(supabase, account),
    readAccountPermissions(supabase, account),
    include.has("audit") ? readAccountAuditEvents(supabase, account) : Promise.resolve([]),
  ]);
  const [recentActivity, orderLedger] = account.customer?.id
    ? await Promise.all([
        include.has("activity")
          ? readCustomerRecentActivity(supabase, account.customer.id)
          : Promise.resolve([]),
        include.has("orders")
          ? readCustomerOrderLedger(supabase, account.customer.id)
          : Promise.resolve(emptyCustomerOrderLedger()),
      ])
    : [[], emptyCustomerOrderLedger()];
  const customer = account.customer
    ? {
        ...account.customer,
        orders: orderLedger.orders,
        recentActivity,
        spendSummary: orderLedger.spendSummary,
      }
    : null;
  const profileCustomer =
    account.profileCustomer?.id && customer?.id === account.profileCustomer.id
      ? customer
      : account.profileCustomer;
  const profileState = profileStateForAccount(account, profileCustomer);

  return {
    account: {
      ...account,
      customer,
      profileCustomer,
      profileState,
    },
    auditEvents,
    customer,
    memberships,
    permissions,
    profileCustomer,
    profileState,
  };
}

export function toAccountDto(
  profile: DbRow,
  customers: Map<string, DbRow>,
  profileCustomers: Map<string, DbRow> = new Map()
): AdminAccountDto {
  const profileId = readString(profile.id) ?? "";
  const customerId = readString(profile.customer_id);
  const customer = customerId
    ? customers.get(customerId) ?? customers.get(profileId) ?? null
    : customers.get(profileId) ?? null;
  const profileCustomer = profileCustomers.get(profileId) ?? (customer ?? null);
  const linkedCustomerId = customer ? readString(customer.id) : null;
  const accountType = readString(profile.account_type) ?? "customer";
  const profileCustomerDto = profileCustomer ? toCustomerDto(profileCustomer) : null;

  return {
    userId: profileId,
    email: readString(profile.email),
    displayName: readString(profile.display_name),
    avatarUrl: readString(profile.avatar_url),
    authProvider: readString(profile.auth_provider) ?? "password",
    accountType,
    role: readString(profile.role) ?? "customer",
    roleTemplate: readString(profile.role_template),
    customerId: customerId ?? linkedCustomerId,
    customerState: customer ? "linked" : "profiles_only",
    customer: customer ? toCustomerDto(customer) : null,
    profileCustomer: profileCustomerDto,
    profileState: profileStateForProfile(accountType, profileCustomerDto),
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

function profileStateForAccount(
  account: Pick<AdminAccountDto, "accountType">,
  profileCustomer: AdminAccountCustomerDto | null
) {
  return profileStateForProfile(account.accountType, profileCustomer);
}

function profileStateForProfile(
  accountType: string,
  profileCustomer: AdminAccountCustomerDto | null
): AdminAccountProfileStateDto {
  const kind = accountType === "employee" ? "employee_self" : "customer";

  if (!profileCustomer) {
    return {
      kind,
      missingFields: ["profile"],
      status: "missing",
    };
  }

  const missingFields = profileMissingFields(profileCustomer);

  return {
    kind,
    missingFields,
    status: missingFields.length > 0 ? "incomplete" : "complete",
  };
}

function profileMissingFields(customer: AdminAccountCustomerDto) {
  const missingFields: string[] = [];

  for (const [field, value] of [
    ["name", customer.name],
    ["email", customer.email],
    ["phone", customer.phone],
    ["fiscalCode", customer.fiscalCode],
    ["billingAddress", customer.billingAddress],
    ["shippingAddress", customer.shippingAddress],
  ] as const) {
    if (!readString(value)) {
      missingFields.push(field);
    }
  }

  return missingFields;
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
    profileKind: readString(row.profile_kind) ?? "customer",
    level: readString(row.level) ?? "bronze",
    lifetimeSpendNet: readNumber(row.lifetime_spend_net) ?? 0,
    orders: [],
    ordersCount: readNumber(row.orders_count) ?? 0,
    revenue: readNumber(row.revenue) ?? readNumber(row.lifetime_spend_net) ?? 0,
    lastActivityAt: readString(row.last_activity_at),
    lastOrderAt: readString(row.last_order_at),
    recentActivity: [],
    spendSummary: emptySpendSummary(),
    profileCompletedAt: readString(row.profile_completed_at),
    convertedToEmployeeAt: readString(row.converted_to_employee_at),
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
  const templateId = account.roleTemplate ?? account.role ?? "customer";
  const [allPermissions, templatePermissions, overrides] = await Promise.all([
    account.role === "admin"
      ? supabase.from("admin_permissions").select("id")
      : Promise.resolve({ data: [] }),
    supabase
      .from("admin_role_template_permissions")
      .select("permission_id")
      .eq("role_template_id", templateId),
    supabase
      .from("admin_user_permission_overrides")
      .select("permission_id, effect")
      .eq("user_id", account.userId),
  ]);
  const permissionSet = new Set<string>();

  for (const row of Array.isArray(templatePermissions.data)
    ? templatePermissions.data.filter(isRow)
    : []) {
    const permissionId = readString(row.permission_id);

    if (permissionId) {
      permissionSet.add(permissionId);
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
  const entityIds = uniqueStrings([
    account.userId,
    account.customer?.id,
    account.profileCustomer?.id,
  ].filter(isString));

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

async function readCustomerOrderLedger(
  supabase: SupabaseServerClient,
  customerId: string
): Promise<{
  orders: AdminAccountCustomerOrderDto[];
  spendSummary: AdminAccountCustomerSpendSummaryDto;
}> {
  const ledger = await supabase.rpc("admin_customer_order_ledger", {
    p_customer_id: customerId,
    p_order_limit: 20,
  });

  if (!ledger.error) {
    return normalizeCustomerOrderLedger(ledger.data);
  }

  const { data, error } = await supabase
    .from("orders")
    .select(customerOrderSelect)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !Array.isArray(data)) {
    return emptyCustomerOrderLedger();
  }

  const rows = data.filter(isRow);
  const lineCounts = await readOrderLineCounts(supabase, rows);

  return {
    orders: rows.map((row) => toCustomerOrderDto(row, lineCounts)).filter(isDefined),
    spendSummary: emptySpendSummary(),
  };
}

function normalizeCustomerOrderLedger(value: unknown) {
  if (!isRow(value)) {
    return emptyCustomerOrderLedger();
  }

  return {
    orders: readArray(value.orders).map(normalizeCustomerOrderDto).filter(isDefined),
    spendSummary: normalizeSpendSummaryDto(value.spendSummary),
  };
}

function normalizeCustomerOrderDto(value: unknown): AdminAccountCustomerOrderDto | null {
  if (!isRow(value)) {
    return null;
  }

  const id = readString(value.id);
  const orderNo = readString(value.orderNo) ?? readString(value.order_no);

  if (!id || !orderNo) {
    return null;
  }

  return {
    id,
    orderNo,
    status: readString(value.status) ?? "submitted",
    paymentStatus: normalizeOrderPaymentStatus(
      readString(value.paymentStatus) ?? readString(value.payment_status)
    ),
    totalNet: readNumber(value.totalNet) ?? readNumber(value.total_net) ?? 0,
    vat: readNumber(value.vat) ?? 0,
    shipping: readNumber(value.shipping) ?? 0,
    total: readNumber(value.total) ?? 0,
    lineCount: readNumber(value.lineCount) ?? readNumber(value.line_count) ?? 0,
    createdAt: readString(value.createdAt) ?? readString(value.created_at),
    updatedAt: readString(value.updatedAt) ?? readString(value.updated_at),
  };
}

function normalizeSpendSummaryDto(value: unknown): AdminAccountCustomerSpendSummaryDto {
  if (!isRow(value)) {
    return emptySpendSummary();
  }

  return roundSpendSummary({
    cancelledAmount: readNumber(value.cancelledAmount) ?? 0,
    orderCount: readNumber(value.orderCount) ?? 0,
    paidAmount: readNumber(value.paidAmount) ?? 0,
    pendingAmount: readNumber(value.pendingAmount) ?? 0,
    refundedAmount: readNumber(value.refundedAmount) ?? 0,
    shipping: readNumber(value.shipping) ?? 0,
    total: readNumber(value.total) ?? 0,
    totalNet: readNumber(value.totalNet) ?? 0,
    vat: readNumber(value.vat) ?? 0,
  });
}

async function readOrderLineCounts(
  supabase: SupabaseServerClient,
  orderRows: DbRow[]
) {
  const orderIds = uniqueStrings(orderRows.map((row) => readString(row.id)).filter(isString));
  const counts = new Map<string, number>();

  if (orderIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabase
    .from("order_lines")
    .select("order_id")
    .in("order_id", orderIds)
    .limit(10000);

  if (error || !Array.isArray(data)) {
    return counts;
  }

  for (const row of data.filter(isRow)) {
    const orderId = readString(row.order_id);

    if (orderId) {
      counts.set(orderId, (counts.get(orderId) ?? 0) + 1);
    }
  }

  return counts;
}

function toCustomerOrderDto(
  row: DbRow,
  lineCounts: Map<string, number>
): AdminAccountCustomerOrderDto | null {
  const id = readString(row.id);
  const orderNo = readString(row.order_no) ?? readString(row.order_number) ?? readString(row.reference) ?? id;

  if (!id || !orderNo) {
    return null;
  }

  const amounts = readOrderAmounts(row);

  return {
    id,
    orderNo,
    status: readString(row.status) ?? "submitted",
    paymentStatus: normalizeOrderPaymentStatus(readString(row.payment_status)),
    totalNet: amounts.totalNet,
    vat: amounts.vat,
    shipping: amounts.shipping,
    total: amounts.total,
    lineCount: lineCounts.get(id) ?? readNumber(row.line_count) ?? readNumber(row.items_count) ?? 0,
    createdAt: readString(row.created_at),
    updatedAt: readString(row.updated_at),
  };
}

function readOrderAmounts(row: DbRow) {
  const totalNet = readNumber(row.total_net) ?? 0;
  const vat = readNumber(row.vat) ?? 0;
  const shipping = readNumber(row.shipping) ?? 0;
  const total =
    readNumber(row.total) ??
    readNumber(row.grand_total) ??
    readNumber(row.amount_total) ??
    readNumber(row.total_amount) ??
    totalNet + vat + shipping;

  return {
    shipping,
    total,
    totalNet,
    vat,
  };
}

function normalizeOrderPaymentStatus(value: string | null) {
  if (value === "paid") {
    return "paid";
  }

  if (value === "bank_waiting" || value === "authorized") {
    return "authorized";
  }

  if (value === "refunded" || value === "failed") {
    return "refunded";
  }

  return "unpaid";
}

function emptyCustomerOrderLedger() {
  return {
    orders: [] as AdminAccountCustomerOrderDto[],
    spendSummary: emptySpendSummary(),
  };
}

function emptySpendSummary(): AdminAccountCustomerSpendSummaryDto {
  return {
    cancelledAmount: 0,
    orderCount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    refundedAmount: 0,
    shipping: 0,
    total: 0,
    totalNet: 0,
    vat: 0,
  };
}

function roundSpendSummary(
  summary: AdminAccountCustomerSpendSummaryDto
): AdminAccountCustomerSpendSummaryDto {
  return {
    cancelledAmount: roundMoney(summary.cancelledAmount),
    orderCount: summary.orderCount,
    paidAmount: roundMoney(summary.paidAmount),
    pendingAmount: roundMoney(summary.pendingAmount),
    refundedAmount: roundMoney(summary.refundedAmount),
    shipping: roundMoney(summary.shipping),
    total: roundMoney(summary.total),
    totalNet: roundMoney(summary.totalNet),
    vat: roundMoney(summary.vat),
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
