import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { notifyOrderStatusUpdated } from "@/lib/partspro-notifications";
import { transitionAdminOrderStatus } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { toAdminOrderDto } from "../../_dto";
import { orderStatusPatchSchema } from "../../_schemas";

export const dynamic = "force-dynamic";

type OrderStatusParams = { params: Promise<{ orderId: string }> };

export async function PATCH(request: NextRequest, { params }: OrderStatusParams) {
  const admin = await requireAdminApi("orders.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = orderStatusPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ORDER_STATUS_PAYLOAD", "Order status payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { orderId } = await params;

  try {
    const result = await transitionAdminOrderStatus({
      orderId: decodeURIComponent(orderId),
      ...parsed.data,
    });
    let notificationWarning: string | undefined;

    try {
      await notifyOrderStatusUpdated({
        actorUserId: admin.authState.userId,
        customerId: result.data.order.customer.id,
        orderNo: result.data.order.orderNo,
        status: result.data.order.status,
        trackingCode: result.data.order.trackingCode,
      });
    } catch (error) {
      notificationWarning =
        error instanceof Error
          ? error.message
          : "Order status notification could not be sent.";
      console.error("[admin:orders:status] notification failed", {
        message: notificationWarning,
        orderId,
      });
    }

    return NextResponse.json({
      data: {
        order: toAdminOrderDto(result.data.order),
        transition: result.data.transition,
      },
      meta: {
        source: result.source,
        inventoryLifecycle:
          "reserved_on_order_create, released_on_pre_ship_cancel, consumed_on_completed",
        paymentLifecycle: "explicit_payment_status_updates_only",
        notification: notificationWarning ? "failed" : "sent",
        notificationWarning,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ORDER_STATUS_UPDATE_FAILED",
      "Order status could not be updated at this time."
    );
  }
}
