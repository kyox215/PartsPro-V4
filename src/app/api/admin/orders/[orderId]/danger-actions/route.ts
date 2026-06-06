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
  const decodedOrderId = decodeURIComponent(orderId);

  try {
    const result = await voidAndSoftDeleteAdminOrder({
      orderId: decodedOrderId,
      confirmOrderNo: parsed.data.confirmOrderNo,
      reason: parsed.data.reason,
      metadata: {
        action: parsed.data.action,
        source: "admin_order_danger_action",
      },
    });
    const dangerAction = isRecord(result.data.transition)
      ? result.data.transition
      : {};
    const nestedWalletRefundRequest = isRecord(dangerAction.wallet_refund_request)
      ? dangerAction.wallet_refund_request
      : isRecord(dangerAction.walletRefundRequest)
        ? dangerAction.walletRefundRequest
        : null;
    const walletRefundAmount =
      readNumber(dangerAction.wallet_refund_amount) ??
      readNumber(dangerAction.walletRefundAmount) ??
      readNumber(readRecordValue(nestedWalletRefundRequest, ["amount"])) ??
      0;
    const walletRefundRequestId =
      readString(dangerAction.wallet_refund_request_id) ??
      readString(dangerAction.walletRefundRequestId) ??
      readString(readRecordValue(nestedWalletRefundRequest, ["request_id", "requestId", "id"]));

    return NextResponse.json({
      data: {
        order: toAdminOrderDto(result.data.order),
        dangerAction: result.data.transition,
      },
      meta: {
        source: result.source,
        dangerAction: {
          ...dangerAction,
          wallet_refund_amount: walletRefundAmount,
          wallet_refund_request_id: walletRefundRequestId,
        },
        walletRefundRequest: walletRefundRequestId ? { id: walletRefundRequestId } : null,
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

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readString(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readRecordValue(
  value: Record<string, unknown> | null,
  keys: string[]
) {
  if (!value) {
    return undefined;
  }

  for (const key of keys) {
    if (value[key] !== undefined) {
      return value[key];
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
