import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readJsonBody,
} from "@/lib/partspro-api";
import {
  createAdminSupportMessage,
  SupportServiceError,
} from "@/lib/partspro-support";
import { requireAdminApi } from "../../../../_shared";

export const dynamic = "force-dynamic";

type SupportConversationParams = {
  params: Promise<{ conversationId: string }>;
};

const messageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: SupportConversationParams
) {
  const admin = await requireAdminApi("support.reply");

  if (!admin.ok) {
    return admin.response;
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

  const { conversationId } = await context.params;

  try {
    const data = await createAdminSupportMessage({
      body: parsed.data.body,
      conversationId,
      userId: admin.authState.userId,
    });

    return NextResponse.json(
      {
        data,
        meta: {
          action: "admin_support_message_create",
          source: "support_conversations",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return supportErrorResponse(error, "ADMIN_SUPPORT_MESSAGE_SEND_FAILED");
  }
}

function supportErrorResponse(error: unknown, fallbackCode: string) {
  if (error instanceof SupportServiceError) {
    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, "Support message could not be sent.");
}
