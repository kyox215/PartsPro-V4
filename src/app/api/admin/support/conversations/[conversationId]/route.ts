import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readJsonBody,
} from "@/lib/partspro-api";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import {
  getAdminSupportConversationDetail,
  SupportServiceError,
  updateAdminSupportConversation,
} from "@/lib/partspro-support";
import { requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

type SupportConversationParams = {
  params: Promise<{ conversationId: string }>;
};

const supportActionSchema = z
  .object({
    action: z.enum(["assign", "claim", "mark_read", "reopen", "resolve"]),
    assignedTo: z.string().trim().uuid().nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  context: SupportConversationParams
) {
  const admin = await requireAdminApi("support.read");

  if (!admin.ok) {
    return admin.response;
  }

  const { conversationId } = await context.params;

  try {
    const data = await getAdminSupportConversationDetail({ conversationId });

    return NextResponse.json({
      data,
      meta: {
        source: "support_conversations",
      },
    });
  } catch (error) {
    return supportErrorResponse(error, "ADMIN_SUPPORT_CONVERSATION_UNAVAILABLE");
  }
}

export async function PATCH(
  request: NextRequest,
  context: SupportConversationParams
) {
  const admin = await requireAdminApi("support.read");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = supportActionSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_SUPPORT_ACTION", "Support action payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const permission = requiredPermissionForAction(parsed.data.action);

  if (!hasAdminPermission(admin.authState, permission)) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission,
      role: admin.authState.role,
    });
  }

  const { conversationId } = await context.params;

  try {
    const data = await updateAdminSupportConversation({
      action: parsed.data.action,
      assignedTo: parsed.data.assignedTo,
      conversationId,
      note: parsed.data.note,
      userId: admin.authState.userId,
    });

    return NextResponse.json({
      data,
      meta: {
        action: parsed.data.action,
        source: "support_conversations",
      },
    });
  } catch (error) {
    return supportErrorResponse(error, "ADMIN_SUPPORT_CONVERSATION_UPDATE_FAILED");
  }
}

function requiredPermissionForAction(action: z.infer<typeof supportActionSchema>["action"]) {
  switch (action) {
    case "assign":
    case "claim":
      return "support.assign";
    case "reopen":
    case "resolve":
      return "support.resolve";
    case "mark_read":
      return "support.read";
  }
}

function supportErrorResponse(error: unknown, fallbackCode: string) {
  if (error instanceof SupportServiceError) {
    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, "Support conversation is temporarily unavailable.");
}
