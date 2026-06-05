import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { syncMarketplaceFulfillmentForOrder } from "@/lib/partspro-marketplace";
import {
  forceCancelAdminShippedOrder,
  getAdminOrder,
  rollbackAdminOrderStatus,
  transitionAdminOrderStatus,
  updateAdminOrderOperations,
} from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { toAdminOrderDto } from "../_dto";
import { orderPatchSchema } from "../_schemas";

export const dynamic = "force-dynamic";

type OrderParams = { params: Promise<{ orderId: string }> };

export async function GET(_request: NextRequest, { params }: OrderParams) {
  const admin = await requireAdminApi("orders.read");

  if (!admin.ok) {
    return admin.response;
  }

  const { orderId } = await params;

  try {
    const result = await getAdminOrder(decodeURIComponent(orderId));

    if (!result.data) {
      return apiError(404, "ADMIN_ORDER_NOT_FOUND", "Order was not found.", {
        orderId,
      });
    }

    return NextResponse.json({
      data: toAdminOrderDto(result.data),
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ORDER_UNAVAILABLE",
      "Order data is temporarily unavailable."
    );
  }
}

export async function PATCH(request: NextRequest, { params }: OrderParams) {
  const admin = await requireAdminApi("orders.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = orderPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ORDER_PAYLOAD", "Order payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { orderId } = await params;
  const decodedOrderId = decodeURIComponent(orderId);

  if (parsed.data.paymentStatus !== undefined) {
    return apiError(
      400,
      "ADMIN_ORDER_PAYMENT_RECONCILIATION_REQUIRED",
      "Payment status updates must use the order payment reconciliation endpoint.",
      { orderId }
    );
  }

  if (parsed.data.rollback && (parsed.data.status || hasOperationsPatch(parsed.data))) {
    return apiError(
      400,
      "ADMIN_ORDER_ROLLBACK_PAYLOAD_INVALID",
      "Rollback must be submitted as a standalone order status action.",
      { orderId }
    );
  }

  if (parsed.data.forceCancel) {
    if (
      parsed.data.rollback ||
      parsed.data.status !== "cancelled" ||
      parsed.data.fulfillmentStatus ||
      hasOperationsPatch(parsed.data)
    ) {
      return apiError(
        400,
        "ADMIN_ORDER_FORCE_CANCEL_PAYLOAD_INVALID",
        "Shipped order force cancellation must be submitted as a standalone cancellation with a reason.",
        { orderId }
      );
    }

    if (!parsed.data.note?.trim()) {
      return apiError(
        400,
        "ADMIN_ORDER_FORCE_CANCEL_REASON_REQUIRED",
        "A reason is required before a shipped order can be force-cancelled.",
        { orderId }
      );
    }

    if (admin.authState.role !== "admin") {
      return apiError(
        403,
        "ADMIN_ORDER_FORCE_CANCEL_ADMIN_REQUIRED",
        "Only administrators can force-cancel shipped orders.",
        { orderId, role: admin.authState.role }
      );
    }
  }

  try {
    if (!parsed.data.rollback && !parsed.data.forceCancel && parsed.data.status === "shipped") {
      const currentOrder = (await getAdminOrder(decodedOrderId)).data;

      if (!currentOrder) {
        return apiError(404, "ADMIN_ORDER_NOT_FOUND", "Order was not found.", {
          orderId,
        });
      }

      const carrier = parsed.data.carrier ?? currentOrder.carrier;
      const tracking = parsed.data.tracking ?? currentOrder.trackingCode;

      if (!hasRequiredShipmentInfo(carrier, tracking)) {
        return apiError(
          400,
          "ADMIN_ORDER_LOGISTICS_REQUIRED",
          "Delivery service is required before an order can be shipped. Tracking is required for carrier shipments.",
          { orderId }
        );
      }
    }

    const forceCancelResult = parsed.data.forceCancel
      ? await forceCancelAdminShippedOrder({
          orderId: decodedOrderId,
          note: parsed.data.note ?? "",
          metadata: {
            forceCancel: true,
            source: "admin_order_patch",
          },
        })
      : null;
    const preTransitionOperationsResult =
      !forceCancelResult &&
      !parsed.data.rollback &&
      parsed.data.status === "shipped" &&
      hasOperationsPatch(parsed.data)
        ? await updateAdminOrderOperations({
          orderId: decodedOrderId,
          carrier: parsed.data.carrier,
          note: parsed.data.note,
          paymentMethod: parsed.data.paymentMethod,
          paymentStatus: parsed.data.paymentStatus,
          staffNote: parsed.data.staffNote,
          tracking: parsed.data.tracking,
          })
        : null;
    const rollbackResult = !forceCancelResult && parsed.data.rollback
      ? await rollbackAdminOrderStatus({
          orderId: decodedOrderId,
          note: parsed.data.note ?? "Admin order status rollback",
          metadata: {
            rollback: true,
          },
        })
      : null;
    const transitionResult = !forceCancelResult && !parsed.data.rollback && parsed.data.status
      ? await transitionAdminOrderStatus({
          orderId: decodedOrderId,
          status: parsed.data.status,
          note: parsed.data.note ?? "Admin order update",
          metadata: {
            carrier: parsed.data.carrier ?? null,
            fulfillmentStatus: parsed.data.fulfillmentStatus ?? null,
            paymentMethod: parsed.data.paymentMethod ?? null,
            paymentStatus: parsed.data.paymentStatus ?? null,
            tracking: parsed.data.tracking ?? null,
          },
        })
      : null;
    const operationsResult =
      !forceCancelResult &&
      !preTransitionOperationsResult &&
      !parsed.data.rollback &&
      hasOperationsPatch(parsed.data)
        ? await updateAdminOrderOperations({
            orderId: decodedOrderId,
            carrier: parsed.data.carrier,
            note: parsed.data.note,
            paymentMethod: parsed.data.paymentMethod,
            paymentStatus: parsed.data.paymentStatus,
            staffNote: parsed.data.staffNote,
            tracking: parsed.data.tracking,
          })
        : null;
    const result =
      operationsResult ??
      forceCancelResult ??
      rollbackResult ??
      transitionResult ??
      preTransitionOperationsResult ?? {
        data: {
          order: (await getAdminOrder(decodedOrderId)).data,
          transition: null,
        },
        source: "supabase" as const,
      };

    const order = result.data.order;

    if (!order) {
      return apiError(404, "ADMIN_ORDER_NOT_FOUND", "Order was not found.", {
        orderId,
      });
    }

    const marketplaceFulfillment =
      order.status === "shipped" && order.carrier && order.trackingCode
        ? await syncMarketplaceFulfillment(order)
        : null;

    return NextResponse.json({
      data: toAdminOrderDto(order, {
        ...(parsed.data.carrier !== undefined ? { carrier: parsed.data.carrier } : {}),
        ...(parsed.data.tracking !== undefined ? { tracking: parsed.data.tracking } : {}),
        ...(parsed.data.paymentMethod !== undefined
          ? { paymentMethod: parsed.data.paymentMethod }
          : {}),
        ...(parsed.data.paymentStatus
          ? { paymentStatus: toUiPaymentStatus(parsed.data.paymentStatus) }
          : {}),
        ...(parsed.data.staffNote !== undefined ? { staffNote: parsed.data.staffNote } : {}),
        ...(parsed.data.fulfillmentStatus
          ? { fulfillmentStatus: parsed.data.fulfillmentStatus }
          : {}),
      }),
      meta: {
        source: result.source,
        marketplaceFulfillment,
        transition:
          rollbackResult?.data.transition ??
          forceCancelResult?.data.transition ??
          transitionResult?.data.transition ??
          null,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ORDER_UPDATE_FAILED",
      "Order could not be updated at this time."
    );
  }
}

async function syncMarketplaceFulfillment(
  order: Awaited<ReturnType<typeof getAdminOrder>>["data"]
) {
  if (!order) {
    return null;
  }

  try {
    return await syncMarketplaceFulfillmentForOrder(order);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "eBay fulfillment sync failed.",
      synced: false,
    };
  }
}

function toUiPaymentStatus(status: string) {
  if (status === "paid") {
    return "paid";
  }

  if (status === "authorized" || status === "bank_waiting") {
    return "authorized";
  }

  if (status === "refunded" || status === "failed") {
    return "refunded";
  }

  return "unpaid";
}

function hasOperationsPatch(patch: {
  carrier?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  staffNote?: string;
  tracking?: string;
}) {
  return (
    patch.carrier !== undefined ||
    patch.paymentMethod !== undefined ||
    patch.paymentStatus !== undefined ||
    patch.staffNote !== undefined ||
    patch.tracking !== undefined
  );
}

function hasRequiredShipmentInfo(carrier: string | undefined, tracking: string | undefined) {
  const deliveryService = carrier?.trim();

  if (!deliveryService || isUnassignedDeliveryService(deliveryService)) {
    return false;
  }

  if (deliveryService === "Ritiro in sede") {
    return true;
  }

  return Boolean(tracking?.trim());
}

function isUnassignedDeliveryService(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "unassigned" ||
    normalized === "none" ||
    normalized === "nessuno" ||
    value.trim() === "未选择"
  );
}
