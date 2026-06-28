import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readQueryParams } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  listNotificationEvents,
  NotificationServiceError,
} from "@/lib/partspro-notifications";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
const queryKeys = new Set(Object.keys(querySchema.shape));

export async function GET(request: NextRequest) {
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated || !account.userId) {
    return apiError(401, "LOGIN_REQUIRED", "Login is required before reading notifications.");
  }

  const params = readQueryParams(request.nextUrl.searchParams, queryKeys);

  if (!params.ok) {
    return apiError(400, "INVALID_QUERY", "Notification query parameters are invalid.", params.details);
  }

  const parsed = querySchema.safeParse(params.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_QUERY", "Notification query parameters are invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const data = await listNotificationEvents({
      limit: parsed.data.limit,
      userId: account.userId,
    });

    return NextResponse.json({
      data,
      meta: {
        source: "notification_events",
      },
    });
  } catch (error) {
    if (error instanceof NotificationServiceError) {
      return apiError(error.status, error.code, error.message, error.details);
    }

    return apiError(500, "NOTIFICATIONS_READ_FAILED", "Notifications could not be read.");
  }
}
