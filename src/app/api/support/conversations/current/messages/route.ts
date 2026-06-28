import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  createCustomerSupportMessage,
  SupportServiceError,
} from "@/lib/partspro-support";

export const dynamic = "force-dynamic";

const messageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
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

  const parsed = messageSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_SUPPORT_MESSAGE", "Support message payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const data = await createCustomerSupportMessage({
      body: parsed.data.body,
      customerId: account.customer?.id ?? null,
      userId: account.userId,
    });

    return NextResponse.json(
      {
        data,
        meta: {
          action: "customer_support_message_create",
          source: "support_conversations",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return supportErrorResponse(error, "SUPPORT_MESSAGE_SEND_FAILED");
  }
}

function supportErrorResponse(error: unknown, fallbackCode: string) {
  if (error instanceof SupportServiceError) {
    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, "Support message could not be sent.");
}
