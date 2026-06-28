import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  NotificationServiceError,
  sendNotificationTest,
} from "@/lib/partspro-notifications";

export const dynamic = "force-dynamic";

export async function POST() {
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated || !account.userId) {
    return apiError(401, "LOGIN_REQUIRED", "Login is required before testing notifications.");
  }

  try {
    const data = await sendNotificationTest({
      audience: account.accountType === "employee" ? "staff" : "customer",
      userId: account.userId,
    });

    return NextResponse.json({
      data,
      meta: {
        action: "notification_test",
        source: "notification_events",
      },
    });
  } catch (error) {
    if (error instanceof NotificationServiceError) {
      return apiError(error.status, error.code, error.message, error.details);
    }

    return apiError(500, "NOTIFICATION_TEST_FAILED", "Notification test could not be sent.");
  }
}
