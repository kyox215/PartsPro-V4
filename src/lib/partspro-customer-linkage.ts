import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type DbRow = Record<string, unknown>;

type LinkedCustomerOptions = {
  email?: string | null;
  select: string;
};

export async function readLinkedCustomerRow(
  client: SupabaseServerClient,
  userId: string,
  options: LinkedCustomerOptions
): Promise<DbRow | null> {
  const profile = await readProfileLinkage(client, userId);

  if (readString(profile?.account_type) === "employee") {
    return null;
  }

  const email = readString(options.email) ?? readString(profile?.email);
  const candidates: DbRow[] = [];
  const profileCustomerId = readString(profile?.customer_id);

  if (profileCustomerId) {
    const row = await readCustomerById(client, profileCustomerId, options.select);

    if (row) {
      candidates.push(row);
    }
  }

  candidates.push(...await readCustomerRowsByUserId(client, userId, options.select));
  candidates.push(...await readCustomerRowsByMembership(client, userId, options.select));

  if (email) {
    candidates.push(...await readCustomerRowsByEmail(client, email, options.select));
  }

  return chooseLinkedCustomer(candidates, {
    email,
    profileCustomerId,
    userId,
  });
}

export async function readLinkedCustomerId(
  client: SupabaseServerClient,
  userId: string,
  email?: string | null
) {
  const row = await readLinkedCustomerRow(client, userId, {
    email,
    select: "id, user_id, email, status, customer_type, assignment_status, profile_kind, updated_at, created_at",
  });

  return readString(row?.id);
}

async function readProfileLinkage(client: SupabaseServerClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("account_type, customer_id, email")
    .eq("id", userId)
    .maybeSingle();

  return error ? null : asRow(data);
}

async function readCustomerById(
  client: SupabaseServerClient,
  customerId: string,
  select: string
) {
  const { data, error } = await client
    .from("customers")
    .select(select)
    .eq("id", customerId)
    .maybeSingle();

  return error ? null : asRow(data);
}

async function readCustomerRowsByUserId(
  client: SupabaseServerClient,
  userId: string,
  select: string
) {
  const { data, error } = await client
    .from("customers")
    .select(select)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(10);

  return error ? [] : rows(data);
}

async function readCustomerRowsByMembership(
  client: SupabaseServerClient,
  userId: string,
  select: string
) {
  const { data, error } = await client
    .from("customer_memberships")
    .select("customer_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(10);
  const customerIds = rows(data)
    .map((row) => readString(row.customer_id))
    .filter(isDefined);

  if (error || customerIds.length === 0) {
    return [];
  }

  const { data: customers, error: customerError } = await client
    .from("customers")
    .select(select)
    .in("id", customerIds);

  return customerError ? [] : rows(customers);
}

async function readCustomerRowsByEmail(
  client: SupabaseServerClient,
  email: string,
  select: string
) {
  const { data, error } = await client
    .from("customers")
    .select(select)
    .ilike("email", email)
    .order("updated_at", { ascending: false })
    .limit(10);

  return error ? [] : rows(data);
}

function chooseLinkedCustomer(
  candidates: DbRow[],
  context: { email: string | null; profileCustomerId: string | null; userId: string }
) {
  const uniqueCandidates = Array.from(
    new Map(
      candidates
        .filter(isNormalCustomerProfile)
        .map((row) => [readString(row.id), row])
        .filter((entry): entry is [string, DbRow] => Boolean(entry[0]))
    ).values()
  );

  return uniqueCandidates.sort((left, right) => {
    const rankDelta = rankCustomer(right, context) - rankCustomer(left, context);

    if (rankDelta !== 0) {
      return rankDelta;
    }

    return timestampOf(right) - timestampOf(left);
  })[0] ?? null;
}

function rankCustomer(
  row: DbRow,
  context: { email: string | null; profileCustomerId: string | null; userId: string }
) {
  let rank = 0;

  if (readString(row.id) === context.profileCustomerId) {
    rank += 1000;
  }

  if (readString(row.user_id) === context.userId) {
    rank += 500;
  }

  if (context.email && equalEmail(readString(row.email), context.email)) {
    rank += 200;
  }

  if (readString(row.status) === "active") {
    rank += 100;
  }

  if (readString(row.assignment_status) === "assigned") {
    rank += 60;
  } else if (readString(row.assignment_status) === "needs_review") {
    rank += 20;
  }

  if (readString(row.customer_type) === "wholesale") {
    rank += 20;
  }

  return rank;
}

function isNormalCustomerProfile(row: DbRow) {
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

function rows(value: unknown) {
  return Array.isArray(value) ? value.filter(isDbRow) : [];
}

function asRow(value: unknown) {
  return isDbRow(value) ? value : null;
}

function isDbRow(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
