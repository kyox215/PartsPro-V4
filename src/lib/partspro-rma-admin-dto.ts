import type {
  RmaAttachment,
  RmaEvent,
  RmaRequest,
} from "@/lib/partspro-data";
import {
  hasExactAdminPermission,
  hasAdminPermission,
  type AdminAuthState,
} from "@/lib/partspro-admin-auth";
import {
  projectAdminRmaWorkflow,
  type RmaAdminCapabilities,
  type RmaAdminWorkflowResult,
} from "@/lib/partspro-rma-workflow-rules";

/**
 * Staff RMA responses are still an allowlist. In particular, attachment
 * storage paths and uploader identities are server-only signing inputs, not
 * an admin UI contract. The admin UI receives the same short-lived capability
 * URL as the customer UI plus descriptive metadata.
 */
export type AdminRmaAttachmentDto = {
  attachmentId: string | null;
  contentType: string | null;
  name: string;
  signedUrl?: string;
  sizeBytes: number | null;
  uploadedAt: string | null;
};

export type AdminRmaEventDto = Omit<RmaEvent, "metadata">;

export type AdminRmaDto = Omit<
  RmaRequest,
  "attachments" | "events" | "ownerUserId"
> & {
  attachments: AdminRmaAttachmentDto[];
  events: AdminRmaEventDto[];
  workflowQueue: RmaAdminWorkflowResult["workflowQueue"];
  availableActions: RmaAdminWorkflowResult["availableActions"];
  recommendedAction: RmaAdminWorkflowResult["recommendedAction"];
  blockedReason: RmaAdminWorkflowResult["blockedReason"];
};

export type { RmaAdminCapabilities };

export function getAdminRmaCapabilities(
  authState: AdminAuthState
): RmaAdminCapabilities {
  return {
    manage: hasAdminPermission(authState, "rma.manage"),
    inventory: hasAdminPermission(authState, "rma.inventory"),
    refund: hasAdminPermission(authState, "rma.refund"),
    adjustStock: hasExactAdminPermission(authState, "product.adjust_stock"),
  };
}

export function countAdminRmaQueues(
  requests: RmaRequest[],
  capabilities: RmaAdminCapabilities
) {
  const counts = {
    review: 0,
    awaiting_return: 0,
    receiving: 0,
    qc: 0,
    resolution: 0,
    inventory_close: 0,
    archive: 0,
  };

  for (const request of requests) {
    const queue = projectAdminRmaWorkflow(request, capabilities).workflowQueue;
    counts[queue] += 1;
  }

  return counts;
}

export function toAdminRmaDto(
  request: RmaRequest,
  capabilities: RmaAdminCapabilities
): AdminRmaDto {
  const workflow = projectAdminRmaWorkflow(request, capabilities);
  const {
    attachments: sourceAttachments,
    events: sourceEvents,
    ownerUserId: _ownerUserId,
    ...staffFields
  } = request;
  void _ownerUserId;

  return {
    ...staffFields,
    attachments: (sourceAttachments ?? []).map(toAdminAttachmentDto),
    events: (sourceEvents ?? []).map(toAdminEventDto),
    ...workflow,
  };
}

function toAdminAttachmentDto(attachment: RmaAttachment): AdminRmaAttachmentDto {
  return {
    attachmentId: attachment.attachmentId ?? null,
    contentType: attachment.contentType ?? null,
    name: attachment.name,
    ...(attachment.signedUrl ? { signedUrl: attachment.signedUrl } : {}),
    sizeBytes: attachment.size ?? null,
    uploadedAt: attachment.uploadedAt ?? null,
  };
}

function toAdminEventDto(event: RmaEvent): AdminRmaEventDto {
  const { metadata: _metadata, ...safeEvent } = event;
  void _metadata;
  return safeEvent;
}
