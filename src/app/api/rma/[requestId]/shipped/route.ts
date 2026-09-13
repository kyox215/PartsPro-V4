import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues } from "@/lib/partspro-api";
import {
  markRmaShipped,
  RmaSimpleFlowError,
} from "@/lib/partspro-rma-simple-flow";
import { rmaCustomerShippedSchema } from "@/lib/partspro-rma-contract";
import {
  notifyRmaCustomerShipped,
  type RmaNotificationPushStatus,
} from "@/lib/partspro-notifications";

export const dynamic = "force-dynamic";

type ShippedParams = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, { params }: ShippedParams) {
  const { requestId } = await params;
  if (!z.string().uuid().safeParse(requestId).success) {
    return noStore(apiError(400, "INVALID_RMA_REQUEST_ID", "RMA request id is invalid."));
  }

  const rawBody = await request.text();
  let payload: unknown = {};
  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      return noStore(apiError(400, "INVALID_JSON", "Request body must be valid JSON."));
    }
  }

  const parsed = rmaCustomerShippedSchema.safeParse(payload);
  if (!parsed.success) {
    return noStore(apiError(400, "INVALID_RMA_SHIPPED_PAYLOAD", "Return shipment payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    }));
  }

  try {
    const data = await markRmaShipped(requestId, parsed.data);
    let notification: RmaNotificationPushStatus = "not_applicable";
    let notificationWarning: string | undefined;

    if (data.status === "approved" && data.customerShippedAt) {
      try {
        const delivery = await notifyRmaCustomerShipped({
          requestId,
          rmaNo: data.rmaNo,
        });
        notification = delivery.pushStatus;
        notificationWarning = pushDeliveryWarning(notification);
      } catch (error) {
        notification = "failed";
        notificationWarning = "RMA receiving notification processing failed.";
        console.error("[rma:customer-shipped] notification failed", {
          message: error instanceof Error ? error.message : String(error),
          requestId,
        });
      }
    }

    return noStore(NextResponse.json({
      data,
      meta: {
        flow: "rma_simple_v1",
        idempotent: true,
        notification,
        notificationWarning,
      },
    }));
  } catch (error) {
    if (error instanceof RmaSimpleFlowError) {
      return noStore(apiError(error.status, error.code, error.message, error.details));
    }
    return noStore(apiError(500, "RMA_SHIPPED_FAILED", "The return shipment could not be recorded."));
  }
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function pushDeliveryWarning(status: RmaNotificationPushStatus) {
  return status === "failed" || status === "partial"
    ? "The staff notification was recorded, but browser push delivery was incomplete."
    : undefined;
}
