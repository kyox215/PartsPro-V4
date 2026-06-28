import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/partspro-api";
import {
  listAdminSupportConversations,
  SupportServiceError,
} from "@/lib/partspro-support";
import { parseAdminQuery, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

const supportConversationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    scope: z.enum(["all", "mine", "unassigned"]).default("all"),
    status: z.enum(["all", "open", "resolved", "archived"]).default("open"),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("support.read");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, supportConversationQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const data = await listAdminSupportConversations({
      currentUserId: admin.authState.userId,
      limit: query.data.limit,
      offset: query.data.offset,
      scope: query.data.scope,
      status: query.data.status,
    });

    return NextResponse.json({
      data: data.conversations,
      meta: {
        limit: query.data.limit,
        offset: query.data.offset,
        returned: data.conversations.length,
        source: "support_conversations",
        total: data.total,
      },
    });
  } catch (error) {
    return supportErrorResponse(error, "ADMIN_SUPPORT_CONVERSATIONS_UNAVAILABLE");
  }
}

function supportErrorResponse(error: unknown, fallbackCode: string) {
  if (error instanceof SupportServiceError) {
    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, "Support conversations are temporarily unavailable.");
}
