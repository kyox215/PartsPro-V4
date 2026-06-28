import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  getCustomerCurrentSupportConversation,
  SupportServiceError,
} from "@/lib/partspro-support";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated || !account.userId) {
    return apiError(401, "SUPPORT_LOGIN_REQUIRED", "Login is required before contacting support.");
  }

  if (account.accountType !== "customer") {
    return apiError(403, "SUPPORT_CUSTOMER_REQUIRED", "Only customer accounts can use the support widget.");
  }

  try {
    const data = await getCustomerCurrentSupportConversation({
      userId: account.userId,
    });

    return NextResponse.json({
      data,
      meta: {
        source: "support_conversations",
      },
    });
  } catch (error) {
    return supportErrorResponse(error, "SUPPORT_CONVERSATION_UNAVAILABLE");
  }
}

function supportErrorResponse(error: unknown, fallbackCode: string) {
  if (error instanceof SupportServiceError) {
    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, "Support conversation is temporarily unavailable.");
}
