import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { reconcileAdminOrderPayment } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { toAdminOrderDto } from "../../_dto";
import { orderPaymentPatchSchema } from "../../_schemas";

export const dynamic = "force-dynamic";

type OrderPaymentParams = { params: Promise<{ orderId: string }> };

export async function PATCH(request: NextRequest, { params }: OrderPaymentParams) {
  const admin = await requireAdminApi("orders.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = orderPaymentPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ORDER_PAYMENT_PAYLOAD", "Order payment payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { orderId } = await params;

  try {
    const result = await reconcileAdminOrderPayment({
      orderId: decodeURIComponent(orderId),
      paymentMethod: parsed.data.paymentMethod,
      paymentStatus: parsed.data.paymentStatus,
      receivedAmount: parsed.data.receivedAmount,
      receivedAt: parsed.data.receivedAt,
      reference: parsed.data.reference,
      note: parsed.data.note,
      metadata: {
        source: "admin_order_payment_patch",
      },
    });

    return NextResponse.json({
      data: {
        order: toAdminOrderDto(result.data.order),
        reconciliation: result.data.reconciliation,
      },
      meta: {
        source: result.source,
        paymentLifecycle: "explicit_payment_reconciliation",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ORDER_PAYMENT_UPDATE_FAILED",
      "Order payment could not be updated at this time."
    );
  }
}
