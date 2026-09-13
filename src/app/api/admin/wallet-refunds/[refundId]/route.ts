import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  deliverPendingRmaNotifications,
  type RmaNotificationPushStatus,
} from "@/lib/partspro-notifications";
import { approveAdminWalletRefundRequest } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

type WalletRefundParams = { params: Promise<{ refundId: string }> };

const walletRefundReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]).default("approve"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function PATCH(request: NextRequest, { params }: WalletRefundParams) {
  const admin = await requireAdminApi("wallet_refunds.approve");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = walletRefundReviewSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_WALLET_REFUND_REVIEW", "Wallet refund review payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { refundId } = await params;

  try {
    const result = await approveAdminWalletRefundRequest({
      decision: parsed.data.decision,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        source: "admin_wallet_refund_review_api",
      },
      note: parsed.data.note,
      refundId: decodeURIComponent(refundId),
    });
    const rmaRequestId = readRmaRequestId(result.data);
    let notification: RmaNotificationPushStatus = "not_applicable";
    let notificationWarning: string | undefined;

    if (rmaRequestId) {
      try {
        const delivery = await deliverPendingRmaNotifications({
          requestId: rmaRequestId,
          sourceAction: "wallet_refund_approved",
          status: "refunded",
        });
        notification = delivery.pushStatus;
        notificationWarning = pushDeliveryWarning(notification);
      } catch (error) {
        notification = "failed";
        notificationWarning = "RMA refund notification processing failed.";
        console.error("[admin:wallet-refund] RMA notification failed", {
          message: error instanceof Error ? error.message : String(error),
          requestId: rmaRequestId,
        });
      }
    }

    return NextResponse.json({
      data: result.data,
      meta: {
        notification,
        notificationWarning,
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_WALLET_REFUND_REVIEW_FAILED",
      "Wallet refund request could not be reviewed."
    );
  }
}

function readRmaRequestId(refund: {
  requestType: string;
  rmaRequestId: string | null;
}) {
  if (refund.requestType !== "rma_return") {
    return null;
  }

  const parsed = z.string().uuid().safeParse(refund.rmaRequestId);
  return parsed.success ? parsed.data : null;
}

function pushDeliveryWarning(status: RmaNotificationPushStatus) {
  return status === "failed" || status === "partial"
    ? "The in-app notification was recorded, but browser push delivery was incomplete."
    : undefined;
}
