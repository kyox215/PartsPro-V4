import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  listCurrentCustomerRmaOrderOptions,
  listCurrentCustomerRmaRequests,
  listCurrentEmployeeSelfRmaOrderOptions,
  listCurrentEmployeeSelfRmaRequests,
} from "@/lib/partspro-repository";
import type { RmaRequest } from "@/lib/partspro-data";
import {
  customerStageForRmaStatus,
  rmaAttachmentContentTypes,
  type CustomerRmaDto,
} from "@/lib/partspro-rma-contract";
import {
  signRmaRequestAttachments,
} from "@/lib/partspro-rma-evidence";
import { handleRmaSubmit, noStore } from "@/lib/partspro-rma-http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await getCurrentAccountContext({ ensure: true });

    if (!account.authenticated) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required to read after-sales requests.");
    }

    const [requestsResult, orderOptionsResult] =
      account.accountType === "employee"
        ? await Promise.all([
            listCurrentEmployeeSelfRmaRequests(),
            listCurrentEmployeeSelfRmaOrderOptions(),
          ])
        : await Promise.all([
            listCurrentCustomerRmaRequests(),
            listCurrentCustomerRmaOrderOptions(),
          ]);

    const signedRequests = await signRmaRequestAttachments(requestsResult.data);
    const customerRequests = toCustomerRmaRequests(signedRequests);

    return noStore(NextResponse.json({
      data: customerRequests,
      meta: {
        orderOptions: orderOptionsResult.data,
        source: requestsResult.source,
        total: customerRequests.length,
        flow: "rma_simple_v1",
        policyScope: "legacy_unverified",
        uploadPolicy: "photos_only_v1",
        warnings: [requestsResult.warning, orderOptionsResult.warning].filter(Boolean),
      },
    }));
  } catch {
    return apiError(500, "RMA_UNAVAILABLE", "After-sales request data is temporarily unavailable.");
  }
}

export async function POST(request: NextRequest) {
  return handleRmaSubmit(request);
}

function toCustomerRmaRequests(requests: RmaRequest[]) {
  return requests.map(toCustomerRmaRequest);
}

function toCustomerRmaRequest(request: RmaRequest): CustomerRmaDto {
  const attachments = (request.attachments ?? []).map((attachment, index) => {
    const contentType = (rmaAttachmentContentTypes as readonly string[]).includes(
      attachment.contentType ?? ""
    )
      ? (attachment.contentType as CustomerRmaDto["attachments"][number]["contentType"])
      : "image/jpeg";

    return {
      attachmentId: `legacy-${request.id}-${index}`,
      contentType,
      name: attachment.name,
      sizeBytes: attachment.size ?? 0,
      uploadedAt: attachment.uploadedAt ?? null,
      verifiedAt: null,
      ...(attachment.signedUrl ? { signedUrl: attachment.signedUrl } : {}),
    };
  });

  return {
    attachments,
    createdAt: request.createdAt,
    customerStage: customerStageForRmaStatus(request.status),
    description: request.description ?? "",
    eligibleUntil: null,
    events: (request.events ?? [])
      .filter((event) => event.metadata?.customer_visible === true)
      .map((event) => ({
        createdAt: event.createdAt,
        eventType: event.eventType,
        id: event.id,
        note: event.note,
        toStatus: event.toStatus ?? null,
      })),
    id: request.id,
    orderId: request.orderId ?? null,
    orderLineId: request.orderLineId ?? null,
    policyScope: "legacy_unverified",
    productName: request.productName,
    quantity: request.quantity ?? 0,
    reasonCode: request.reason,
    rmaNo: null,
    resolution: request.resolution,
    requestedResolution: request.requestedResolution ?? request.resolution,
    sku: request.sku,
    status: request.status,
    updatedAt: request.updatedAt ?? null,
    ...(request.customerVisibleNote ? { customerVisibleNote: request.customerVisibleNote } : {}),
    ...(request.labResult ? { labResult: request.labResult } : {}),
    ...(request.refundAmount !== undefined ? { refundAmount: request.refundAmount } : {}),
    ...(request.resolutionNote ? { resolutionNote: request.resolutionNote } : {}),
  };
}
