import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  getAdminOrder,
  transitionAdminOrderStatus,
  updateAdminOrderOperations,
} from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { toAdminOrderDto } from "../_dto";
import { orderPatchSchema } from "../_schemas";

export const dynamic = "force-dynamic";

type OrderParams = { params: Promise<{ orderId: string }> };

export async function GET(_request: NextRequest, { params }: OrderParams) {
  const admin = await requireAdminApi();

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
  const admin = await requireAdminApi();

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

  try {
    const transitionResult = parsed.data.status
      ? await transitionAdminOrderStatus({
          orderId: decodedOrderId,
          status: parsed.data.status,
          note: parsed.data.note ?? "Admin order update",
          metadata: {
            carrier: parsed.data.carrier ?? null,
            fulfillmentStatus: parsed.data.fulfillmentStatus ?? null,
            paymentStatus: parsed.data.paymentStatus ?? null,
            tracking: parsed.data.tracking ?? null,
            warehouse: parsed.data.warehouse ?? null,
          },
        })
      : null;
    const operationsResult = hasOperationsPatch(parsed.data)
      ? await updateAdminOrderOperations({
          orderId: decodedOrderId,
          carrier: parsed.data.carrier,
          note: parsed.data.note,
          paymentStatus: parsed.data.paymentStatus,
          tracking: parsed.data.tracking,
          warehouse: parsed.data.warehouse,
        })
      : null;
    const result =
      operationsResult ??
      transitionResult ?? {
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

    return NextResponse.json({
      data: toAdminOrderDto(order, {
        ...(parsed.data.carrier ? { carrier: parsed.data.carrier } : {}),
        ...(parsed.data.tracking !== undefined ? { tracking: parsed.data.tracking } : {}),
        ...(parsed.data.warehouse ? { warehouse: parsed.data.warehouse } : {}),
        ...(parsed.data.paymentStatus
          ? { paymentStatus: toUiPaymentStatus(parsed.data.paymentStatus) }
          : {}),
        ...(parsed.data.fulfillmentStatus
          ? { fulfillmentStatus: parsed.data.fulfillmentStatus }
          : {}),
      }),
      meta: {
        source: result.source,
        transition: transitionResult?.data.transition ?? null,
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

function toUiPaymentStatus(status: string) {
  return status === "paid" ? "paid" : "unpaid";
}

function hasOperationsPatch(patch: {
  carrier?: string;
  paymentStatus?: string;
  tracking?: string;
  warehouse?: string;
}) {
  return (
    patch.carrier !== undefined ||
    patch.paymentStatus !== undefined ||
    patch.tracking !== undefined ||
    patch.warehouse !== undefined
  );
}
