import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readJsonBody,
} from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  NotificationServiceError,
  revokeNotificationSubscription,
  upsertNotificationSubscription,
} from "@/lib/partspro-notifications";

export const dynamic = "force-dynamic";

const subscriptionSchema = z
  .object({
    endpoint: z.string().trim().min(20).max(2048),
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        auth: z.string().trim().min(8).max(512),
        p256dh: z.string().trim().min(16).max(512),
      })
      .strict(),
  })
  .strict();

const subscribeSchema = z
  .object({
    browser: z.string().trim().max(80).nullable().optional(),
    platform: z.string().trim().max(80).nullable().optional(),
    scope: z.string().trim().max(120).nullable().optional(),
    subscription: subscriptionSchema,
  })
  .strict();

const unsubscribeSchema = z
  .object({
    endpoint: z.string().trim().min(20).max(2048).nullable().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const account = await requireNotificationAccount();

  if (!account.ok) {
    return account.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = subscribeSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_NOTIFICATION_SUBSCRIPTION",
      "Notification subscription payload is invalid.",
      { issues: formatZodIssues(parsed.error) }
    );
  }

  try {
    const data = await upsertNotificationSubscription({
      ...parsed.data,
      userAgent: request.headers.get("user-agent"),
      userId: account.userId,
    });

    return NextResponse.json({
      data,
      meta: {
        action: "notification_subscription_upsert",
        source: "notification_subscriptions",
      },
    });
  } catch (error) {
    return notificationErrorResponse(
      error,
      "NOTIFICATION_SUBSCRIPTION_SAVE_FAILED",
      "Notification subscription could not be saved."
    );
  }
}

export async function DELETE(request: NextRequest) {
  const account = await requireNotificationAccount();

  if (!account.ok) {
    return account.response;
  }

  const body = await readJsonBody(request);
  const parsed = body.ok
    ? unsubscribeSchema.safeParse(body.data)
    : unsubscribeSchema.safeParse({});

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_NOTIFICATION_UNSUBSCRIBE",
      "Notification unsubscribe payload is invalid.",
      { issues: formatZodIssues(parsed.error) }
    );
  }

  try {
    const data = await revokeNotificationSubscription({
      endpoint: parsed.data.endpoint ?? null,
      userId: account.userId,
    });

    return NextResponse.json({
      data,
      meta: {
        action: "notification_subscription_revoke",
        source: "notification_subscriptions",
      },
    });
  } catch (error) {
    return notificationErrorResponse(
      error,
      "NOTIFICATION_SUBSCRIPTION_REVOKE_FAILED",
      "Notification subscription could not be revoked."
    );
  }
}

async function requireNotificationAccount() {
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated || !account.userId) {
    return {
      ok: false as const,
      response: apiError(401, "LOGIN_REQUIRED", "Login is required before enabling notifications."),
    };
  }

  return { ok: true as const, userId: account.userId };
}

function notificationErrorResponse(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
) {
  if (error instanceof NotificationServiceError) {
    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, fallbackMessage);
}
