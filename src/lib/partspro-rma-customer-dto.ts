import type { RmaRequest } from "@/lib/partspro-data";
import {
  customerStageForRmaStatus,
  rmaAttachmentContentTypes,
  type CustomerRmaDto,
} from "@/lib/partspro-rma-contract";

/**
 * One customer DTO for both the new and legacy POST/GET paths. Internal
 * assignees, notes, wallet ids, inventory fields and storage paths never cross
 * this boundary; attachment capability is represented only by an opaque id
 * and a short-lived signed URL.
 */
export function toCustomerRmaDto(request: RmaRequest): CustomerRmaDto {
  const isReturnInTransit =
    request.status === "approved" && Boolean(request.customerShippedAt);
  const attachments = (request.attachments ?? []).map((attachment, index) => {
    const contentType = (rmaAttachmentContentTypes as readonly string[]).includes(
      attachment.contentType ?? ""
    )
      ? (attachment.contentType as CustomerRmaDto["attachments"][number]["contentType"])
      : "image/jpeg";

    return {
      attachmentId: attachment.attachmentId ?? `legacy-${request.id}-${index}`,
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
    customerShippedAt: request.customerShippedAt ?? null,
    customerStage: isReturnInTransit
      ? "return_in_transit"
      : customerStageForRmaStatus(request.status),
    description: request.description ?? "",
    eligibleUntil: request.eligibleUntil ?? null,
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
    // Legacy requests only have the already-safe display value in orderId;
    // the canonical server flow supplies the order number separately.
    orderNumber: request.orderNumber ?? request.orderId ?? null,
    orderLineId: request.orderLineId ?? null,
    policyScope: request.policyScope ?? "legacy_unverified",
    productName: request.productName,
    quantity: request.quantity ?? 0,
    reason: request.reasonCode ?? request.reason,
    reasonCode: request.reasonCode ?? request.reason,
    rmaNo: request.rmaNo ?? null,
    resolution: request.resolution,
    requestedResolution: request.requestedResolution ?? request.resolution,
    sku: request.sku,
    status: request.status,
    updatedAt: request.updatedAt ?? null,
    canMarkShipped: request.status === "approved" && !request.customerShippedAt,
    ...(request.returnCarrier ? { carrier: request.returnCarrier } : {}),
    ...(request.returnTrackingCode ? { tracking: request.returnTrackingCode } : {}),
    ...(request.customerVisibleNote ? { customerVisibleNote: request.customerVisibleNote } : {}),
    ...(request.labResult ? { labResult: request.labResult } : {}),
    ...(request.refundAmount !== undefined ? { refundAmount: request.refundAmount } : {}),
    ...(request.resolutionNote ? { resolutionNote: request.resolutionNote } : {}),
  };
}
