import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { adjustAdminOrderShipping } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { toAdminOrderDto } from "../../_dto";
import { orderShippingPatchSchema } from "../../_schemas";

export const dynamic = "force-dynamic";

type OrderShippingParams = { params: Promise<{ orderId: string }> };

export async function PATCH(request: NextRequest, { params }: OrderShippingParams) {
  const admin = await requireAdminApi("orders.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = orderShippingPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ORDER_SHIPPING_PAYLOAD", "Order shipping payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { orderId } = await params;

  try {
    const result = await adjustAdminOrderShipping({
      orderId: decodeURIComponent(orderId),
      shippingAmount: parsed.data.shippingAmount,
      reason: parsed.data.reason,
      note: parsed.data.note,
      metadata: {
        source: "admin_order_shipping_patch",
      },
    });

    return NextResponse.json({
      data: {
        adjustment: result.data.adjustment,
        order: toAdminOrderDto(result.data.order),
      },
      meta: {
        source: result.source,
        paymentLifecycle: "shipping_adjustment_can_create_supplement_due",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ORDER_SHIPPING_ADJUSTMENT_FAILED",
      "Order shipping could not be adjusted at this time."
    );
  }
}
