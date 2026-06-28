import "server-only";

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import {
  adminPermissions,
  roleTemplatePermissions,
} from "@/lib/partspro-permissions";
import {
  createServiceRoleClient,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { getPartsProSiteUrl } from "@/lib/partspro-site-url";

type NotificationDbClient = ReturnType<typeof createServiceRoleClient>;
type DbRow = Record<string, unknown>;

const bootstrapAdminEmails = new Set(
  (process.env.PARTSPRO_ADMIN_EMAILS ?? "kyox120@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const configuredPublicKey =
  process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ??
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY ??
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const configuredPrivateKey =
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY ?? process.env.VAPID_PRIVATE_KEY;
const configuredSubject =
  process.env.WEB_PUSH_SUBJECT ?? "mailto:kyox120@gmail.com";

export type NotificationAudience = "customer" | "staff";
export type NotificationEventType =
  | "admin_test"
  | "customer_test"
  | "new_order"
  | "order_status_updated"
  | "order_shipping_updated"
  | "support_customer_message"
  | "support_staff_reply"
  | "support_assigned";

export type BrowserPushSubscriptionPayload = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

export type NotificationEventDto = {
  audience: NotificationAudience;
  body: string;
  createdAt: string;
  eventType: NotificationEventType;
  id: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  targetPath: string;
  title: string;
};

export class NotificationServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function getNotificationClientConfig() {
  return {
    configured: Boolean(configuredPublicKey && configuredPrivateKey),
    publicKey: configuredPublicKey ?? null,
  };
}

export async function upsertNotificationSubscription(input: {
  browser?: string | null;
  platform?: string | null;
  scope?: string | null;
  subscription: BrowserPushSubscriptionPayload;
  userAgent?: string | null;
  userId: string;
}) {
  assertSubscription(input.subscription);
  const client = getNotificationClient();
  const now = new Date().toISOString();
  const expirationTime =
    typeof input.subscription.expirationTime === "number"
      ? new Date(input.subscription.expirationTime).toISOString()
      : null;
  const { data, error } = await client
    .from("notification_subscriptions")
    .upsert(
      {
        auth: input.subscription.keys.auth,
        browser: trimNullable(input.browser, 80),
        endpoint: input.subscription.endpoint,
        expiration_time: expirationTime,
        failure_count: 0,
        last_error: null,
        last_seen_at: now,
        permission: "granted",
        platform: trimNullable(input.platform, 80),
        p256dh: input.subscription.keys.p256dh,
        revoked_at: null,
        scope: trimNullable(input.scope, 120) ?? "/",
        user_agent: trimNullable(input.userAgent, 500),
        user_id: input.userId,
      },
      { onConflict: "endpoint" }
    )
    .select("id")
    .single();

  if (error || !isRecord(data)) {
    throw new NotificationServiceError(
      502,
      "NOTIFICATION_SUBSCRIPTION_SAVE_FAILED",
      "Notification subscription could not be saved.",
      error
    );
  }

  return { id: readRequiredString(data.id, "subscription.id") };
}

export async function revokeNotificationSubscription(input: {
  endpoint?: string | null;
  userId: string;
}) {
  const client = getNotificationClient();
  const now = new Date().toISOString();
  let request = client
    .from("notification_subscriptions")
    .update({
      last_seen_at: now,
      permission: "denied",
      revoked_at: now,
    })
    .eq("user_id", input.userId);

  if (input.endpoint) {
    request = request.eq("endpoint", input.endpoint);
  }

  const { error } = await request;

  if (error) {
    throw new NotificationServiceError(
      502,
      "NOTIFICATION_SUBSCRIPTION_REVOKE_FAILED",
      "Notification subscription could not be revoked.",
      error
    );
  }

  return { ok: true };
}

export async function listNotificationEvents(input: {
  limit: number;
  userId: string;
}) {
  const client = getNotificationClient();
  const { data, error } = await client
    .from("notification_events")
    .select("*")
    .eq("recipient_user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(input.limit);

  if (error) {
    throw new NotificationServiceError(
      502,
      "NOTIFICATIONS_READ_FAILED",
      "Notifications could not be read.",
      error
    );
  }

  const events = readRows(data).map(toNotificationEventDto);

  return {
    notifications: events,
    unreadCount: events.filter((event) => !event.readAt).length,
  };
}

export async function markNotificationEventsRead(input: {
  ids?: string[];
  userId: string;
}) {
  const client = getNotificationClient();
  const now = new Date().toISOString();
  let request = client
    .from("notification_events")
    .update({ read_at: now })
    .eq("recipient_user_id", input.userId)
    .is("read_at", null);

  if (input.ids && input.ids.length > 0) {
    request = request.in("id", input.ids);
  }

  const { error } = await request;

  if (error) {
    throw new NotificationServiceError(
      502,
      "NOTIFICATIONS_MARK_READ_FAILED",
      "Notifications could not be marked as read.",
      error
    );
  }

  return { ok: true };
}

export async function sendNotificationTest(input: {
  audience: NotificationAudience;
  userId: string;
}) {
  return createAndPushNotifications({
    audience: input.audience,
    body:
      input.audience === "staff"
        ? "PartsPro 后台通知已开启。"
        : "PartsPro 账号通知已开启。",
    eventType: input.audience === "staff" ? "admin_test" : "customer_test",
    payload: { source: "manual_test" },
    recipients: [input.userId],
    sourceTable: null,
    sourceId: null,
    targetPath: input.audience === "staff" ? "/admin" : "/account",
    title: "PartsPro 通知测试",
  });
}

export async function notifyNewOrder(input: {
  actorUserId: string | null;
  customerName: string;
  orderNo: string;
}) {
  const recipients = await listStaffRecipients(["orders.read", "orders.manage"]);

  return createAndPushNotifications({
    actorUserId: input.actorUserId,
    audience: "staff",
    body: `${input.customerName} 提交了新订单。`,
    eventType: "new_order",
    payload: {
      customerName: input.customerName,
      orderNo: input.orderNo,
    },
    recipients: recipients.filter((userId) => userId !== input.actorUserId),
    sourceId: input.orderNo,
    sourceTable: "orders",
    targetPath: `/admin?panel=orders&orderId=${encodeURIComponent(input.orderNo)}`,
    title: `新订单 ${input.orderNo}`,
  });
}

export async function notifyOrderStatusUpdated(input: {
  actorUserId: string | null;
  customerId: string | null;
  orderNo: string;
  status: string;
  trackingCode?: string | null;
}) {
  const customerUserId = input.customerId
    ? await readCustomerUserId(input.customerId)
    : null;

  if (!customerUserId || customerUserId === input.actorUserId) {
    return { eventCount: 0, pushDeliveredCount: 0, pushFailedCount: 0 };
  }

  const eventType =
    input.status === "shipped" || input.trackingCode
      ? "order_shipping_updated"
      : "order_status_updated";
  const body =
    eventType === "order_shipping_updated"
      ? `订单 ${input.orderNo} 已更新物流状态。`
      : `订单 ${input.orderNo} 状态已更新为 ${input.status}。`;

  return createAndPushNotifications({
    actorUserId: input.actorUserId,
    audience: "customer",
    body,
    eventType,
    payload: {
      orderNo: input.orderNo,
      status: input.status,
      trackingCode: input.trackingCode ?? null,
    },
    recipients: [customerUserId],
    sourceId: input.orderNo,
    sourceTable: "orders",
    targetPath: `/account?section=orders&orderId=${encodeURIComponent(input.orderNo)}`,
    title: `订单 ${input.orderNo} 已更新`,
  });
}

export async function notifySupportCustomerMessage(input: {
  actorUserId: string;
  assignedTo: string | null;
  conversationId: string;
  customerName: string | null;
}) {
  const recipients = input.assignedTo
    ? [input.assignedTo]
    : await listStaffRecipients(["support.read", "support.reply"]);
  const customerName = input.customerName ?? "客户";

  return createAndPushNotifications({
    actorUserId: input.actorUserId,
    audience: "staff",
    body: `${customerName} 发来了新的客服消息。`,
    eventType: "support_customer_message",
    payload: {
      conversationId: input.conversationId,
      customerName,
    },
    recipients: [...new Set(recipients)].filter((userId) => userId !== input.actorUserId),
    sourceId: input.conversationId,
    sourceTable: "support_conversations",
    targetPath: `/admin?panel=support&conversationId=${encodeURIComponent(input.conversationId)}`,
    title: "新的客服消息",
  });
}

export async function notifySupportStaffReply(input: {
  actorUserId: string;
  conversationId: string;
  customerUserId: string;
}) {
  if (input.customerUserId === input.actorUserId) {
    return { eventCount: 0, pushDeliveredCount: 0, pushFailedCount: 0 };
  }

  return createAndPushNotifications({
    actorUserId: input.actorUserId,
    audience: "customer",
    body: "PartsPro 客服回复了你的消息。",
    eventType: "support_staff_reply",
    payload: { conversationId: input.conversationId },
    recipients: [input.customerUserId],
    sourceId: input.conversationId,
    sourceTable: "support_conversations",
    targetPath: `/?support=open&conversationId=${encodeURIComponent(input.conversationId)}`,
    title: "客服已回复",
  });
}

export async function notifySupportAssigned(input: {
  actorUserId: string;
  assignedTo: string | null;
  conversationId: string;
}) {
  if (!input.assignedTo || input.assignedTo === input.actorUserId) {
    return { eventCount: 0, pushDeliveredCount: 0, pushFailedCount: 0 };
  }

  return createAndPushNotifications({
    actorUserId: input.actorUserId,
    audience: "staff",
    body: "有一条客服会话已分配给你。",
    eventType: "support_assigned",
    payload: { conversationId: input.conversationId },
    recipients: [input.assignedTo],
    sourceId: input.conversationId,
    sourceTable: "support_conversations",
    targetPath: `/admin?panel=support&conversationId=${encodeURIComponent(input.conversationId)}`,
    title: "客服会话已分配",
  });
}

async function createAndPushNotifications(input: {
  actorUserId?: string | null;
  audience: NotificationAudience;
  body: string;
  eventType: NotificationEventType;
  payload?: Record<string, unknown>;
  recipients: string[];
  sourceId: string | null;
  sourceTable: string | null;
  targetPath: string;
  title: string;
}) {
  const recipients = [...new Set(input.recipients)].filter(Boolean);

  if (recipients.length === 0) {
    return { eventCount: 0, pushDeliveredCount: 0, pushFailedCount: 0 };
  }

  const client = getNotificationClient();
  const rows = recipients.map((recipientUserId) => ({
    actor_user_id: input.actorUserId ?? null,
    audience: input.audience,
    body: input.body,
    event_type: input.eventType,
    payload: input.payload ?? {},
    recipient_user_id: recipientUserId,
    source_id: input.sourceId,
    source_table: input.sourceTable,
    target_path: input.targetPath,
    title: input.title,
  }));
  const { data, error } = await client
    .from("notification_events")
    .insert(rows)
    .select("*");

  if (error) {
    console.error("[notifications] event insert failed", {
      code: error.code,
      message: error.message,
    });
    return { eventCount: 0, pushDeliveredCount: 0, pushFailedCount: 0 };
  }

  const events = readRows(data);
  let pushDeliveredCount = 0;
  let pushFailedCount = 0;

  for (const event of events) {
    const result = await pushNotificationEvent(client, event);
    pushDeliveredCount += result.delivered;
    pushFailedCount += result.failed;
  }

  return {
    eventCount: events.length,
    pushDeliveredCount,
    pushFailedCount,
  };
}

async function pushNotificationEvent(client: NotificationDbClient, event: DbRow) {
  const config = getNotificationClientConfig();
  const eventId = readRequiredString(event.id, "notification.id");
  const recipientUserId = readRequiredString(
    event.recipient_user_id,
    "notification.recipient_user_id"
  );

  if (!config.configured || !config.publicKey || !configuredPrivateKey) {
    await updateNotificationPushCounters(client, eventId, 0, 0);
    return { delivered: 0, failed: 0 };
  }

  webpush.setVapidDetails(
    configuredSubject,
    config.publicKey,
    configuredPrivateKey
  );

  const { data, error } = await client
    .from("notification_subscriptions")
    .select("*")
    .eq("user_id", recipientUserId)
    .is("revoked_at", null)
    .eq("permission", "granted");

  if (error) {
    console.error("[notifications] subscription read failed", {
      eventId,
      message: error.message,
    });
    await updateNotificationPushCounters(client, eventId, 0, 0);
    return { delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  for (const subscription of readRows(data)) {
    try {
      await webpush.sendNotification(
        toWebPushSubscription(subscription),
        JSON.stringify(toPushPayload(event))
      );
      delivered += 1;
      await client
        .from("notification_subscriptions")
        .update({
          failure_count: 0,
          last_error: null,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", readRequiredString(subscription.id, "subscription.id"));
    } catch (error) {
      failed += 1;
      await markSubscriptionFailure(client, subscription, error);
    }
  }

  await updateNotificationPushCounters(client, eventId, delivered, failed);

  return { delivered, failed };
}

async function listStaffRecipients(requiredPermissions: string[]) {
  const client = getNotificationClient();
  const [profilesResult, rolePermissionsResult, overridesResult] =
    await Promise.all([
      client
        .from("profiles")
        .select("id, email, role, account_type, role_template"),
      client
        .from("admin_role_template_permissions")
        .select("role_template_id, permission_id"),
      client
        .from("admin_user_permission_overrides")
        .select("user_id, permission_id, effect"),
    ]);

  if (profilesResult.error) {
    console.error("[notifications] staff profile read failed", {
      message: profilesResult.error.message,
    });
    return [];
  }

  const rolePermissions = new Map<string, Set<string>>();

  for (const row of readRows(rolePermissionsResult.data)) {
    const roleTemplateId = readString(row.role_template_id);
    const permissionId = readString(row.permission_id);

    if (!roleTemplateId || !permissionId) {
      continue;
    }

    const permissions = rolePermissions.get(roleTemplateId) ?? new Set<string>();
    permissions.add(permissionId);
    rolePermissions.set(roleTemplateId, permissions);
  }

  const overrides = new Map<string, Array<{ effect: string; permission: string }>>();

  for (const row of readRows(overridesResult.data)) {
    const userId = readString(row.user_id);
    const permission = readString(row.permission_id);
    const effect = readString(row.effect);

    if (!userId || !permission || !effect) {
      continue;
    }

    overrides.set(userId, [
      ...(overrides.get(userId) ?? []),
      { effect, permission },
    ]);
  }

  return readRows(profilesResult.data)
    .filter((profile) => isStaffProfile(profile))
    .filter((profile) =>
      requiredPermissions.some((permission) =>
        effectivePermissionsForProfile(profile, rolePermissions, overrides).has(permission)
      )
    )
    .map((profile) => readString(profile.id))
    .filter((userId): userId is string => Boolean(userId));
}

async function readCustomerUserId(customerId: string) {
  const client = getNotificationClient();
  const { data, error } = await client
    .from("customers")
    .select("user_id")
    .eq("id", customerId)
    .maybeSingle();

  if (error || !isRecord(data)) {
    return null;
  }

  return readString(data.user_id);
}

function effectivePermissionsForProfile(
  profile: DbRow,
  rolePermissions: Map<string, Set<string>>,
  overrides: Map<string, Array<{ effect: string; permission: string }>>
) {
  const userId = readString(profile.id);
  const email = readString(profile.email)?.toLowerCase() ?? null;
  const role = readString(profile.role);
  const roleTemplate = readString(profile.role_template);
  const permissions =
    role === "admin" || roleTemplate === "admin" || (email && bootstrapAdminEmails.has(email))
      ? new Set<string>(adminPermissions)
      : new Set<string>();

  for (const candidate of [roleTemplate, role]) {
    if (!candidate) {
      continue;
    }

    for (const permission of rolePermissions.get(candidate) ?? []) {
      permissions.add(permission);
    }

    for (const permission of roleTemplatePermissions[candidate]?.values() ?? []) {
      permissions.add(permission);
    }
  }

  for (const override of userId ? overrides.get(userId) ?? [] : []) {
    if (override.effect === "deny") {
      permissions.delete(override.permission);
    } else if (override.effect === "grant") {
      permissions.add(override.permission);
    }
  }

  return permissions;
}

function isStaffProfile(profile: DbRow) {
  const role = readString(profile.role);
  const roleTemplate = readString(profile.role_template);
  const accountType = readString(profile.account_type);
  const email = readString(profile.email)?.toLowerCase() ?? null;

  return Boolean(
    accountType === "employee" ||
      role === "admin" ||
      roleTemplate === "admin" ||
      (email && bootstrapAdminEmails.has(email))
  );
}

function toPushPayload(event: DbRow) {
  const targetPath = readString(event.target_path) ?? "/";
  const targetUrl = new URL(targetPath, getPartsProSiteUrl()).toString();

  return {
    badge: "/pwa/badge-96.png",
    body: readString(event.body) ?? "PartsPro 有新的通知。",
    data: {
      notificationId: readString(event.id),
      targetPath,
      targetUrl,
    },
    icon: "/pwa/icon-192.png",
    tag: readString(event.id) ?? undefined,
    title: readString(event.title) ?? "PartsPro",
  };
}

function toWebPushSubscription(row: DbRow): WebPushSubscription {
  return {
    endpoint: readRequiredString(row.endpoint, "subscription.endpoint"),
    keys: {
      auth: readRequiredString(row.auth, "subscription.auth"),
      p256dh: readRequiredString(row.p256dh, "subscription.p256dh"),
    },
  };
}

async function markSubscriptionFailure(
  client: NotificationDbClient,
  subscription: DbRow,
  error: unknown
) {
  const statusCode = readWebPushStatusCode(error);
  const revoked = statusCode === 404 || statusCode === 410;
  const failureCount = (readNumber(subscription.failure_count) ?? 0) + 1;

  await client
    .from("notification_subscriptions")
    .update({
      failure_count: failureCount,
      last_error: trimNullable(
        error instanceof Error ? error.message : String(error),
        500
      ),
      revoked_at: revoked ? new Date().toISOString() : null,
    })
    .eq("id", readRequiredString(subscription.id, "subscription.id"));
}

async function updateNotificationPushCounters(
  client: NotificationDbClient,
  eventId: string,
  delivered: number,
  failed: number
) {
  await client
    .from("notification_events")
    .update({
      push_attempted_at: new Date().toISOString(),
      push_delivered_count: delivered,
      push_failed_count: failed,
    })
    .eq("id", eventId);
}

function getNotificationClient() {
  if (!isSupabaseServiceRoleConfigured()) {
    throw new NotificationServiceError(
      503,
      "NOTIFICATION_SERVICE_ROLE_NOT_CONFIGURED",
      "Supabase service role must be configured before notifications can be used."
    );
  }

  return createServiceRoleClient();
}

function assertSubscription(subscription: BrowserPushSubscriptionPayload) {
  if (
    !subscription.endpoint ||
    !subscription.keys?.auth ||
    !subscription.keys?.p256dh
  ) {
    throw new NotificationServiceError(
      400,
      "INVALID_PUSH_SUBSCRIPTION",
      "Push subscription payload is invalid."
    );
  }
}

function toNotificationEventDto(row: DbRow): NotificationEventDto {
  return {
    audience:
      readString(row.audience) === "staff" ? "staff" : "customer",
    body: readString(row.body) ?? "",
    createdAt: readString(row.created_at) ?? new Date().toISOString(),
    eventType: toNotificationEventType(readString(row.event_type)),
    id: readRequiredString(row.id, "notification.id"),
    payload: isRecord(row.payload) ? row.payload : {},
    readAt: readString(row.read_at),
    targetPath: readString(row.target_path) ?? "/",
    title: readString(row.title) ?? "PartsPro",
  };
}

function toNotificationEventType(value: string | null): NotificationEventType {
  switch (value) {
    case "admin_test":
    case "customer_test":
    case "new_order":
    case "order_status_updated":
    case "order_shipping_updated":
    case "support_customer_message":
    case "support_staff_reply":
    case "support_assigned":
      return value;
    default:
      return "customer_test";
  }
}

function readWebPushStatusCode(error: unknown) {
  if (!isRecord(error)) {
    return null;
  }

  const statusCode = readNumber(error.statusCode) ?? readNumber(error.status);

  return statusCode;
}

function readRows(value: unknown): DbRow[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readRequiredString(value: unknown, label: string) {
  const text = readString(value);

  if (!text) {
    throw new NotificationServiceError(
      502,
      "NOTIFICATION_ROW_INVALID",
      `Missing ${label}.`
    );
  }

  return text;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function trimNullable(value: string | null | undefined, maxLength: number) {
  const text = value?.trim();

  if (!text) {
    return null;
  }

  return text.slice(0, maxLength);
}
