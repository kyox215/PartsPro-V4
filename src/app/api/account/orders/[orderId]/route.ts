import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { apiError } from "@/lib/partspro-api";
import {
  getCurrentCustomerOrder,
  getCurrentEmployeeSelfOrder,
  recordCustomerActivity,
} from "@/lib/partspro-repository";
import { repositoryErrorResponse } from "../../../admin/_shared";
import { toAdminOrderDto } from "../../../admin/orders/_dto";

export const dynamic = "force-dynamic";

type OrderParams = { params: Promise<{ orderId: string }> };

export async function GET(_request: NextRequest, { params }: OrderParams) {
  const { orderId } = await params;
  const decodedOrderId = decodeURIComponent(orderId);

  try {
    const account = await getCurrentAccountContext({ ensure: true });
    const result =
      account.accountType === "employee"
        ? await getCurrentEmployeeSelfOrder(decodedOrderId)
        : await getCurrentCustomerOrder(decodedOrderId);

    if (!result.data) {
      return apiError(404, "CUSTOMER_ORDER_NOT_FOUND", "Order was not found.", {
        orderId,
      });
    }

    void recordCustomerActivity({
      eventType: "order_detail_view",
      metadata: {
        orderId: result.data.id,
        orderNo: result.data.orderNo,
      },
      searchQuery: result.data.orderNo,
    }).catch(() => {
      // Reading an order should not fail if activity logging is unavailable.
    });

    return NextResponse.json({
      data: toAdminOrderDto(result.data),
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "CUSTOMER_ORDER_UNAVAILABLE",
      "Order data is temporarily unavailable."
    );
  }
}
