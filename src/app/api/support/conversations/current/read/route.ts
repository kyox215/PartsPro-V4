import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  markCustomerSupportConversationRead,
  SupportServiceError,
} from "@/lib/partspro-support";

export const dynamic = "force-dynamic";

const readSchema = z
  .object({
    conversationId: z.string().trim().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated || !account.userId) {
    return apiError(401, "SUPPORT_LOGIN_REQUIRED", "Login is required before contacting support.");
  }

  if (account.accountType !== "customer") {
    return apiError(403, "SUPPORT_CUSTOMER_REQUIRED", "Only customer accounts can use the support widget.");
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = readSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_SUPPORT_READ", "Support read payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const data = await markCustomerSupportConversationRead({
      conversationId: parsed.data.conversationId,
      userId: account.userId,
    });

    return NextResponse.json({
      data,
      meta: {
        action: "customer_support_mark_read",
      },
    });
  } catch (error) {
    return supportErrorResponse(error, "SUPPORT_READ_FAILED");
  }
}

function supportErrorResponse(error: unknown, fallbackCode: string) {
  if (error instanceof SupportServiceError) {
    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, "Support conversation could not be marked as read.");
}
