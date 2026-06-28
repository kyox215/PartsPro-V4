import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readJsonBody,
} from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  markNotificationEventsRead,
  NotificationServiceError,
} from "@/lib/partspro-notifications";

export const dynamic = "force-dynamic";

const markReadSchema = z
  .object({
    ids: z.array(z.string().uuid()).max(50).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated || !account.userId) {
    return apiError(401, "LOGIN_REQUIRED", "Login is required before updating notifications.");
  }

  const body = await readJsonBody(request);
  const parsed = body.ok
    ? markReadSchema.safeParse(body.data)
    : markReadSchema.safeParse({});

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_NOTIFICATION_READ_PAYLOAD",
      "Notification read payload is invalid.",
      { issues: formatZodIssues(parsed.error) }
    );
  }

  try {
    const data = await markNotificationEventsRead({
      ids: parsed.data.ids,
      userId: account.userId,
    });

    return NextResponse.json({
      data,
      meta: {
        action: "notifications_mark_read",
        source: "notification_events",
      },
    });
  } catch (error) {
    if (error instanceof NotificationServiceError) {
      return apiError(error.status, error.code, error.message, error.details);
    }

    return apiError(500, "NOTIFICATIONS_MARK_READ_FAILED", "Notifications could not be marked as read.");
  }
}
