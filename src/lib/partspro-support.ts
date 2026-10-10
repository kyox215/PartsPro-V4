import "server-only";
import { randomUUID } from "node:crypto";
import { createClient as createStaffSupportClient } from "@/lib/supabase/server";

import {
  createServiceRoleClient,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/admin";
import {
  notifySupportAssigned,
  notifySupportCustomerMessage,
  notifySupportStaffReply,
} from "@/lib/partspro-notifications";

type SupportDbClient = ReturnType<typeof createServiceRoleClient>;
type DbRow = Record<string, unknown>;

export type SupportConversationStatus = "open" | "resolved" | "archived";
export type SupportSenderType = "customer" | "staff" | "system";
export type SupportConversationScope = "all" | "mine" | "unassigned";
export type SupportConversationAction =
  | "assign"
  | "claim"
  | "mark_read"
  | "reopen"
  | "resolve";

export type SupportActorDto = {
  displayName: string | null;
  email: string | null;
  id: string | null;
  role: string | null;
  roleTemplate: string | null;
};

export type SupportCustomerDto = {
  companyName: string | null;
  email: string | null;
  id: string | null;
  phone: string | null;
};

export type SupportConversationDto = {
  assignedAt: string | null;
  assignedBy: string | null;
  assignedTo: string | null;
  assignee: SupportActorDto | null;
  createdAt: string;
  customer: SupportCustomerDto | null;
  customerId: string | null;
  customerLastReadAt: string | null;
  customerUnreadCount: number;
  id: string;
  lastCustomerMessageAt: string | null;
  lastMessageAt: string | null;
  lastStaffMessageAt: string | null;
  reopenedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  staffLastReadAt: string | null;
  staffUnreadCount: number;
  status: SupportConversationStatus;
  subject: string | null;
  updatedAt: string;
  userId: string;
};

export type SupportMessageDto = {
  body: string;
  conversationId: string;
  createdAt: string;
  id: string;
  sender: SupportActorDto | null;
  senderId: string | null;
  senderType: SupportSenderType;
};

export type SupportEventDto = {
  actor: SupportActorDto | null;
  actorId: string | null;
  conversationId: string;
  createdAt: string;
  eventType: string;
  fromAssignee: string | null;
  fromStatus: string | null;
  id: string;
  metadata: Record<string, unknown>;
  note: string | null;
  toAssignee: string | null;
  toStatus: string | null;
};

export class SupportServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export async function getCustomerCurrentSupportConversation(input: {
  userId: string;
}) {
  const client = getSupportClient();
  const conversation = await readOpenCustomerConversation(client, input.userId);

  if (!conversation) {
    return {
      conversation: null,
      messages: [],
    };
  }

  return readCustomerConversationBundle(client, conversation);
}

export async function createCustomerSupportMessage(input: {
  body: string;
  customerId: string | null;
  userId: string;
}) {
  const body = normalizeMessageBody(input.body);
  const client = getSupportClient();
  const now = new Date().toISOString();
  let conversation = await readOpenCustomerConversation(client, input.userId);
  let created = false;

  if (!conversation) {
    const { data, error } = await client
      .from("support_conversations")
      .insert({
        customer_id: input.customerId,
        customer_last_read_at: now,
        last_customer_message_at: now,
        last_message_at: now,
        staff_unread_count: 1,
        status: "open",
        subject: makeSubject(body),
        user_id: input.userId,
      })
      .select("*")
      .single();

    if (error || !isRow(data)) {
      throw supportWriteError(
        "SUPPORT_CONVERSATION_CREATE_FAILED",
        "Support conversation could not be created.",
        error
      );
    }

    conversation = data;
    created = true;
    await insertSupportEvent(client, {
      actorId: input.userId,
      conversationId: readRequiredString(conversation.id, "conversation.id"),
      eventType: "created",
      metadata: { source: "customer_widget" },
      toStatus: "open",
    });
  }

  const conversationId = readRequiredString(conversation.id, "conversation.id");
  const currentUnread = readNumber(conversation.staff_unread_count) ?? 0;
  const { error: messageError } = await client.from("support_messages").insert({
    body,
    conversation_id: conversationId,
    sender_id: input.userId,
    sender_type: "customer",
  });

  if (messageError) {
    throw supportWriteError(
      "SUPPORT_MESSAGE_CREATE_FAILED",
      "Support message could not be sent.",
      messageError
    );
  }

  const { data: updatedConversation, error: updateError } = await client
    .from("support_conversations")
    .update({
      customer_last_read_at: now,
      last_customer_message_at: now,
      last_message_at: now,
      staff_unread_count: created ? 1 : currentUnread + 1,
      status: "open",
    })
    .eq("id", conversationId)
    .select("*")
    .single();

  if (updateError || !isRow(updatedConversation)) {
    throw supportWriteError(
      "SUPPORT_CONVERSATION_UPDATE_FAILED",
      "Support conversation could not be updated.",
      updateError
    );
  }

  await insertSupportEvent(client, {
    actorId: input.userId,
    conversationId,
    eventType: "customer_message",
    metadata: { source: "customer_widget" },
  });

  try {
    await notifySupportCustomerMessage({
      actorUserId: input.userId,
      assignedTo: readString(updatedConversation.assigned_to),
      conversationId,
      customerName: await readConversationCustomerName(client, updatedConversation),
    });
  } catch (error) {
    console.error("[support:customer_message] notification failed", {
      conversationId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return readCustomerConversationBundle(client, updatedConversation);
}

export async function markCustomerSupportConversationRead(input: {
  conversationId: string;
  userId: string;
}) {
  const client = getSupportClient();
  const conversation = await readConversationForCustomer(
    client,
    input.conversationId,
    input.userId
  );
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("support_conversations")
    .update({
      customer_last_read_at: now,
      customer_unread_count: 0,
    })
    .eq("id", input.conversationId)
    .select("*")
    .single();

  if (error || !isRow(data)) {
    throw supportWriteError(
      "SUPPORT_CONVERSATION_READ_FAILED",
      "Support conversation could not be marked as read.",
      error
    );
  }

  await insertSupportEvent(client, {
    actorId: input.userId,
    conversationId: readRequiredString(conversation.id, "conversation.id"),
    eventType: "read",
    metadata: { side: "customer" },
  });

  return readCustomerConversationBundle(client, data);
}

export async function readAdminSupportInboxCounts(currentUserId: string) {
  const client = getSupportClient();
  const base = () => client.from("support_conversations").select("id", { count: "exact", head: true }).eq("status", "open");
  const results = await Promise.all([base(), base().gt("staff_unread_count", 0), base().is("assigned_to", null), base().eq("assigned_to", currentUserId)]);
  if (results.some(result => result.error || result.count == null)) throw new SupportServiceError(502, "SUPPORT_INBOX_COUNTS_UNAVAILABLE", "Inbox counts unavailable.");
  return { all: results[0].count!, needsReply: results[1].count!, unassigned: results[2].count!, mine: results[3].count! };
}

export async function listAdminSupportConversations(input: {
  currentUserId: string;
  limit: number;
  offset: number;
  q?: string;
  needsReply?: boolean;
  scope: SupportConversationScope;
  status: SupportConversationStatus | "all";
}) {
  const client = getSupportClient();
  let request = client
    .from("support_conversations")
    .select("*", { count: "exact" });

  if (input.needsReply) request = request.gt("staff_unread_count", 0);

  if (input.status !== "all") {
    request = request.eq("status", input.status);
  }

  if (input.scope === "mine") {
    request = request.eq("assigned_to", input.currentUserId);
  } else if (input.scope === "unassigned") {
    request = request.is("assigned_to", null);
  }

  if (input.q) {
    const value = input.q.replace(/[%_,().]/g, " ").trim();
    if (value) {
      const profiles = await client.from("profiles").select("id", { count: "exact" }).or(
        `display_name.ilike.%${value}%,email.ilike.%${value}%`
      ).limit(250);
      if (profiles.error) throw supportWriteError("ADMIN_SUPPORT_SEARCH_FAILED", "Customer search failed.", profiles.error);
      if ((profiles.count ?? 0) > 250) throw new SupportServiceError(400, "SUPPORT_SEARCH_TOO_BROAD", "Search matches too many customers. Use a more precise name or email.");
      const profileIds = readRows(profiles.data).map(row => readString(row.id)).filter((id): id is string => Boolean(id));
      const clauses = [`subject.ilike.%${value}%`];
      if (/^[a-f0-9-]{36}$/i.test(value)) clauses.push(`id.eq.${value}`);
      if (profileIds.length) clauses.push(`user_id.in.(${profileIds.join(",")})`);
      request = request.or(clauses.join(","));
    }
  }

  const { data, error, count } = await request
    .order("last_message_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (error) {
    throw supportWriteError(
      "ADMIN_SUPPORT_CONVERSATIONS_READ_FAILED",
      "Support conversations could not be read.",
      error
    );
  }

  const rows = readRows(data);

  return {
    conversations: await toConversationDtos(client, rows),
    total: count ?? rows.length,
  };
}

export async function getAdminSupportConversationDetail(input: {
  conversationId: string;
}) {
  const client = getSupportClient();
  const conversation = await readConversation(client, input.conversationId);

  return readAdminConversationBundle(client, conversation);
}

export async function createAdminSupportMessage(input: { body: string; conversationId: string; userId: string; requestId?: string }) {
  const body = normalizeMessageBody(input.body);
  const client = await createStaffSupportClient();
  const messageId = input.requestId ?? randomUUID();
  const { data, error } = await client.rpc("admin_send_support_message_atomic", { p_conversation_id: input.conversationId, p_body: body, p_message_id: messageId });
  if (error || !isRow(data) || data.saved !== true) {
    const status = error?.code === "42501" ? 403 : error?.code === "23505" ? 409 : error?.code === "23514" ? 400 : error?.code === "P0002" ? 404 : 503;
    throw new SupportServiceError(status, "SUPPORT_ATOMIC_SEND_UNAVAILABLE", "Message was not acknowledged. Verify the atomic reply migration and use the same send identifier to retry.");
  }
  // No fallback writes: an environment missing the transaction must fail closed.
  let detail: Awaited<ReturnType<typeof getAdminSupportConversationDetail>> | null = null;
  let followupError = false;
  try { detail = await getAdminSupportConversationDetail({ conversationId: input.conversationId }); } catch { followupError = true; }
  if (data.created === true) {
    try {
      const conversation = await readConversation(getSupportClient(), input.conversationId);
      const customerUserId = readString(conversation.user_id);
      if (customerUserId) await notifySupportStaffReply({ actorUserId: input.userId, conversationId: input.conversationId, customerUserId });
    } catch { followupError = true; }
  }
  return { detail, saved: true as const, followupError };
}

export async function updateAdminSupportConversation(input: { action: SupportConversationAction; assignedTo?: string | null; conversationId: string; note?: string | null; userId: string }) {
  const client = await createStaffSupportClient();
  const { data, error } = await client.rpc("admin_update_support_conversation_atomic", { p_conversation_id: input.conversationId, p_action: input.action, p_assigned_to: input.assignedTo ?? null, p_note: input.note ?? null });
  if (error || !isRow(data) || data.saved !== true) throw new SupportServiceError(error?.code === "42501" ? 403 : error?.code === "23514" ? 409 : 503, "SUPPORT_ATOMIC_ACTION_UNAVAILABLE", "Conversation action was not acknowledged. Verify the migration and reload the current state.");
  let readError = false;
  if (input.action === "claim" || input.action === "assign") {
    try { await notifySupportAssignmentChange({ actorUserId: input.userId, assignedTo: input.action === "claim" ? input.userId : input.assignedTo ?? null, conversationId: input.conversationId }); } catch { readError = true; }
  }
  try { return { detail: await getAdminSupportConversationDetail({ conversationId: input.conversationId }), saved: true as const, readError }; }
  catch { return { detail: null, saved: true as const, readError: true }; }
}

function getSupportClient() {
  if (!isSupabaseServiceRoleConfigured()) {
    throw new SupportServiceError(
      503,
      "SUPPORT_SERVICE_ROLE_NOT_CONFIGURED",
      "Supabase service role must be configured before support messaging can be used."
    );
  }

  return createServiceRoleClient();
}

async function readOpenCustomerConversation(
  client: SupportDbClient,
  userId: string
) {
  const { data, error } = await client
    .from("support_conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw supportWriteError(
      "SUPPORT_CONVERSATION_READ_FAILED",
      "Support conversation could not be read.",
      error
    );
  }

  return isRow(data) ? data : null;
}

async function readConversationForCustomer(
  client: SupportDbClient,
  conversationId: string,
  userId: string
) {
  const conversation = await readConversation(client, conversationId);

  if (readString(conversation.user_id) !== userId) {
    throw new SupportServiceError(
      404,
      "SUPPORT_CONVERSATION_NOT_FOUND",
      "Support conversation was not found."
    );
  }

  return conversation;
}

async function readConversation(client: SupportDbClient, conversationId: string) {
  const { data, error } = await client
    .from("support_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    throw supportWriteError(
      "SUPPORT_CONVERSATION_READ_FAILED",
      "Support conversation could not be read.",
      error
    );
  }

  if (!isRow(data)) {
    throw new SupportServiceError(
      404,
      "SUPPORT_CONVERSATION_NOT_FOUND",
      "Support conversation was not found."
    );
  }

  return data;
}

async function readConversationCustomerName(
  client: SupportDbClient,
  conversation: DbRow
) {
  const customerId = readString(conversation.customer_id);

  if (!customerId) {
    return null;
  }

  const { data } = await client
    .from("customers")
    .select("company_name, email")
    .eq("id", customerId)
    .maybeSingle();

  if (!isRow(data)) {
    return null;
  }

  return readString(data.company_name) ?? readString(data.email);
}

async function notifySupportAssignmentChange(input: {
  actorUserId: string;
  assignedTo: string | null;
  conversationId: string;
}) {
  try {
    await notifySupportAssigned(input);
  } catch (error) {
    console.error("[support:assignment] notification failed", {
      conversationId: input.conversationId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function readCustomerConversationBundle(
  client: SupportDbClient,
  conversation: DbRow
) {
  const [conversationDto] = await toConversationDtos(client, [conversation]);

  return {
    conversation: conversationDto,
    messages: await readMessages(client, conversationDto.id),
  };
}

async function readAdminConversationBundle(
  client: SupportDbClient,
  conversation: DbRow
) {
  const [conversationDto] = await toConversationDtos(client, [conversation]);

  return {
    conversation: conversationDto,
    events: await readEvents(client, conversationDto.id),
    messages: await readMessages(client, conversationDto.id),
  };
}

async function readMessages(client: SupportDbClient, conversationId: string) {
  const { data, error } = await client
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw supportWriteError(
      "SUPPORT_MESSAGES_READ_FAILED",
      "Support messages could not be read.",
      error
    );
  }

  return toMessageDtos(client, readRows(data));
}

async function readEvents(client: SupportDbClient, conversationId: string) {
  const { data, error } = await client
    .from("support_conversation_events")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw supportWriteError(
      "SUPPORT_EVENTS_READ_FAILED",
      "Support events could not be read.",
      error
    );
  }

  return toEventDtos(client, readRows(data));
}

async function insertSupportEvent(
  client: SupportDbClient,
  input: {
    actorId?: string | null;
    conversationId: string;
    eventType: string;
    fromAssignee?: string | null;
    fromStatus?: string | null;
    metadata?: Record<string, unknown>;
    note?: string | null;
    toAssignee?: string | null;
    toStatus?: string | null;
  }
) {
  const { error } = await client.from("support_conversation_events").insert({
    actor_id: input.actorId ?? null,
    conversation_id: input.conversationId,
    event_type: input.eventType,
    from_assignee: input.fromAssignee ?? null,
    from_status: input.fromStatus ?? null,
    metadata: input.metadata ?? {},
    note: input.note ?? null,
    to_assignee: input.toAssignee ?? null,
    to_status: input.toStatus ?? null,
  });

  if (error) {
    throw supportWriteError(
      "SUPPORT_EVENT_CREATE_FAILED",
      "Support event could not be recorded.",
      error
    );
  }
}

async function toConversationDtos(client: SupportDbClient, rows: DbRow[]) {
  const customerIds = uniqueStrings(rows.map((row) => readString(row.customer_id)));
  const profileIds = uniqueStrings(
    rows.flatMap((row) => [
      readString(row.assigned_by),
      readString(row.assigned_to),
      readString(row.resolved_by),
      readString(row.user_id),
    ])
  );
  const [customers, profiles] = await Promise.all([
    readCustomerMap(client, customerIds),
    readProfileMap(client, profileIds),
  ]);

  return rows.map((row) => toConversationDto(row, customers, profiles));
}

async function toMessageDtos(client: SupportDbClient, rows: DbRow[]) {
  const profiles = await readProfileMap(
    client,
    uniqueStrings(rows.map((row) => readString(row.sender_id)))
  );

  return rows.map((row) => ({
    body: readString(row.body) ?? "",
    conversationId: readRequiredString(row.conversation_id, "message.conversation_id"),
    createdAt: readRequiredString(row.created_at, "message.created_at"),
    id: readRequiredString(row.id, "message.id"),
    sender: readActor(readString(row.sender_id), profiles),
    senderId: readString(row.sender_id),
    senderType: normalizeSenderType(readString(row.sender_type)),
  }));
}

async function toEventDtos(client: SupportDbClient, rows: DbRow[]) {
  const profiles = await readProfileMap(
    client,
    uniqueStrings(rows.map((row) => readString(row.actor_id)))
  );

  return rows.map((row) => ({
    actor: readActor(readString(row.actor_id), profiles),
    actorId: readString(row.actor_id),
    conversationId: readRequiredString(row.conversation_id, "event.conversation_id"),
    createdAt: readRequiredString(row.created_at, "event.created_at"),
    eventType: readString(row.event_type) ?? "system_note",
    fromAssignee: readString(row.from_assignee),
    fromStatus: readString(row.from_status),
    id: readRequiredString(row.id, "event.id"),
    metadata: readRecord(row.metadata) ?? {},
    note: readString(row.note),
    toAssignee: readString(row.to_assignee),
    toStatus: readString(row.to_status),
  }));
}

function toConversationDto(
  row: DbRow,
  customers: Map<string, SupportCustomerDto>,
  profiles: Map<string, SupportActorDto>
): SupportConversationDto {
  const customerId = readString(row.customer_id);
  const assignedTo = readString(row.assigned_to);

  return {
    assignedAt: readString(row.assigned_at),
    assignedBy: readString(row.assigned_by),
    assignedTo,
    assignee: readActor(assignedTo, profiles),
    createdAt: readRequiredString(row.created_at, "conversation.created_at"),
    customer: customerId ? customers.get(customerId) ?? null : null,
    customerId,
    customerLastReadAt: readString(row.customer_last_read_at),
    customerUnreadCount: readNumber(row.customer_unread_count) ?? 0,
    id: readRequiredString(row.id, "conversation.id"),
    lastCustomerMessageAt: readString(row.last_customer_message_at),
    lastMessageAt: readString(row.last_message_at),
    lastStaffMessageAt: readString(row.last_staff_message_at),
    reopenedAt: readString(row.reopened_at),
    resolvedAt: readString(row.resolved_at),
    resolvedBy: readString(row.resolved_by),
    staffLastReadAt: readString(row.staff_last_read_at),
    staffUnreadCount: readNumber(row.staff_unread_count) ?? 0,
    status: normalizeStatus(readString(row.status)),
    subject: readString(row.subject),
    updatedAt: readRequiredString(row.updated_at, "conversation.updated_at"),
    userId: readRequiredString(row.user_id, "conversation.user_id"),
  };
}

async function readCustomerMap(client: SupportDbClient, ids: string[]) {
  const customers = new Map<string, SupportCustomerDto>();

  if (ids.length === 0) {
    return customers;
  }

  const { data, error } = await client
    .from("customers")
    .select("id, company_name, email, phone")
    .in("id", ids);

  if (error) {
    return customers;
  }

  for (const row of readRows(data)) {
    const id = readString(row.id);

    if (!id) {
      continue;
    }

    customers.set(id, {
      companyName: readString(row.company_name),
      email: readString(row.email),
      id,
      phone: readString(row.phone),
    });
  }

  return customers;
}

async function readProfileMap(client: SupportDbClient, ids: string[]) {
  const profiles = new Map<string, SupportActorDto>();

  if (ids.length === 0) {
    return profiles;
  }

  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, email, role, role_template")
    .in("id", ids);

  if (error) {
    return profiles;
  }

  for (const row of readRows(data)) {
    const id = readString(row.id);

    if (!id) {
      continue;
    }

    profiles.set(id, {
      displayName: readString(row.display_name),
      email: readString(row.email),
      id,
      role: readString(row.role),
      roleTemplate: readString(row.role_template),
    });
  }

  return profiles;
}

function readActor(id: string | null, profiles: Map<string, SupportActorDto>) {
  return id ? profiles.get(id) ?? { displayName: null, email: null, id, role: null, roleTemplate: null } : null;
}

function normalizeMessageBody(value: string) {
  const body = value.trim();

  if (body.length < 1 || body.length > 2000) {
    throw new SupportServiceError(
      400,
      "SUPPORT_MESSAGE_INVALID",
      "Support message must be between 1 and 2000 characters."
    );
  }

  return body;
}

function makeSubject(body: string) {
  return body.length > 120 ? `${body.slice(0, 117)}...` : body;
}

function normalizeStatus(value: string | null): SupportConversationStatus {
  return value === "resolved" || value === "archived" ? value : "open";
}

function normalizeSenderType(value: string | null): SupportSenderType {
  if (value === "staff" || value === "system") {
    return value;
  }

  return "customer";
}

function supportWriteError(
  code: string,
  message: string,
  error: { message?: string } | null
) {
  return new SupportServiceError(
    502,
    code,
    message,
    error?.message ? { message: error.message } : undefined
  );
}

function readRows(value: unknown): DbRow[] {
  return Array.isArray(value) ? value.filter(isRow) : [];
}

function isRow(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRow(value) ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRequiredString(value: unknown, field: string) {
  const text = readString(value);

  if (!text) {
    throw new SupportServiceError(
      500,
      "SUPPORT_DATA_CONTRACT_INVALID",
      `Support data is missing ${field}.`
    );
  }

  return text;
}

function uniqueStrings(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
