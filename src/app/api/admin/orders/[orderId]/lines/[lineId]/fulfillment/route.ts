import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { recordAdminOrderLinePick } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../../../_shared";
import { toAdminOrderDto } from "../../../../_dto";
import { orderLineFulfillmentSchema } from "../../../../_schemas";

export const dynamic = "force-dynamic";

type OrderLineFulfillmentParams = {
  params: Promise<{ lineId: string; orderId: string }>;
};

export async function POST(request: NextRequest, { params }: OrderLineFulfillmentParams) {
  const admin = await requireAdminApi("orders.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = orderLineFulfillmentSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ORDER_LINE_FULFILLMENT", "Order line fulfillment payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { lineId, orderId } = await params;

  try {
    const result = await recordAdminOrderLinePick({
      actualQuantity: parsed.data.actualQuantity,
      lineId: decodeURIComponent(lineId),
      orderId: decodeURIComponent(orderId),
      reason: parsed.data.reason,
      metadata: {
        source: "admin_order_line_fulfillment_api",
      },
    });

    return NextResponse.json({
      data: toAdminOrderDto(result.data.order),
      meta: {
        result: result.data.result,
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ORDER_LINE_FULFILLMENT_FAILED",
      "Order line fulfillment could not be updated."
    );
  }
}
