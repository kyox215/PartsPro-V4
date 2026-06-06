import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { voidAndSoftDeleteAdminOrder } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { toAdminOrderDto } from "../../_dto";
import { orderDangerActionSchema } from "../../_schemas";

export const dynamic = "force-dynamic";

type OrderDangerActionParams = { params: Promise<{ orderId: string }> };

export async function POST(request: NextRequest, { params }: OrderDangerActionParams) {
  const admin = await requireAdminApi("orders.danger");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = orderDangerActionSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ORDER_DANGER_PAYLOAD", "Order danger action payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { orderId } = await params;

  try {
    const result = await voidAndSoftDeleteAdminOrder({
      orderId: decodeURIComponent(orderId),
      confirmOrderNo: parsed.data.confirmOrderNo,
      reason: parsed.data.reason,
      metadata: {
        action: parsed.data.action,
        source: "admin_order_danger_action",
      },
    });

    return NextResponse.json({
      data: {
        order: toAdminOrderDto(result.data.order),
        dangerAction: result.data.transition,
      },
      meta: {
        source: result.source,
        dangerAction: result.data.transition,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ORDER_DANGER_ACTION_FAILED",
      "Order could not be voided at this time."
    );
  }
}
