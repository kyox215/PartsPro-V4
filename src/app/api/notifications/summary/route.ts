import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  getNotificationSummary,
  NotificationServiceError,
} from "@/lib/partspro-notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getCurrentAccountContext();

  if (!account.authenticated || !account.userId) {
    return apiError(401, "LOGIN_REQUIRED", "Login is required before reading notifications.");
  }

  try {
    const data = await getNotificationSummary({ userId: account.userId });

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

    return apiError(500, "NOTIFICATION_SUMMARY_READ_FAILED", "Notification summary could not be read.");
  }
}
