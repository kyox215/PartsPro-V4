import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type DbRow = Record<string, unknown>;

type LinkedCustomerOptions = {
  email?: string | null;
  profile?: DbRow | null;
  select: string;
};

export async function readLinkedCustomerRow(
  client: SupabaseServerClient,
  userId: string,
  options: LinkedCustomerOptions
): Promise<DbRow | null> {
  const profile =
    options.profile === undefined
      ? await readProfileLinkage(client, userId)
      : options.profile;

  if (readString(profile?.account_type) === "employee") {
    return null;
  }

  const profileCustomerId = readString(profile?.customer_id);
  if (profileCustomerId) {
    const { data: owned, error: ownerError } = await client.from("customers")
      .select(options.select).eq("id", profileCustomerId).eq("user_id", userId).maybeSingle();
    if (ownerError) return null;
    const ownerRow = asRow(owned);
    if (ownerRow) return isNormalCustomerProfile(ownerRow) ? ownerRow : null;
    const { data: membership, error: membershipError } = await client.from("customer_memberships")
      .select("customer_id").eq("customer_id", profileCustomerId).eq("user_id", userId)
      .eq("status", "active").limit(1).maybeSingle();
    if (membershipError || !membership) return null;
    const { data, error } = await client.from("customers").select(options.select)
      .eq("id", profileCustomerId).maybeSingle();
    const memberRow = error ? null : asRow(data);
    return memberRow && isNormalCustomerProfile(memberRow) ? memberRow : null;
  }

  // Ownership/membership are authoritative; an email match never grants a price list.
  const [userRows, membershipRows] = await Promise.all([
    readCustomerRowsByUserId(client, userId, options.select),
    readCustomerRowsByMembership(client, userId, options.select),
  ]);
  if (!userRows || !membershipRows) return null;
  const candidates = Array.from(new Map(
    [...userRows, ...membershipRows]
      .filter(isNormalCustomerProfile)
      .map((row) => [readString(row.id), row] as const)
      .filter(([id]) => Boolean(id))
  ).values());
  // Ambiguous links require an explicit assignment; never prefer a cheaper wholesale account.
  return candidates.length === 1 ? candidates[0] : null;
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

  return error || rows(data).length >= 10 ? null : rows(data);
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

  if (error || rows(data).length >= 10) return null;
  if (customerIds.length === 0) return [];

  const { data: customers, error: customerError } = await client
    .from("customers")
    .select(select)
    .in("id", customerIds);

  return customerError ? null : rows(customers);
}

function isNormalCustomerProfile(row: DbRow) {
  const profileKind = readString(row.profile_kind) ?? "customer";

  return profileKind !== "employee_self" && profileKind !== "archived_customer";
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
