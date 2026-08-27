import "server-only";

import type { RmaAttachment, RmaRequest } from "@/lib/partspro-data";
import {
  createServiceRoleClient,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/admin";

export const rmaEvidenceBucket = "rma-evidence";
export const rmaEvidenceSignedUrlTtlSeconds = 15 * 60;

const uuidSegment = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const legacyEvidenceExtension = "(?:jpg|jpeg|png|webp|heic|heif|mp4|mov)";

/**
 * Only paths produced by our legacy upload route or the opaque draft flow may
 * be signed for a customer. This keeps old JSON compatibility without making
 * a client-provided path a storage oracle.
 */
export function isRmaEvidencePathOwnedByUser(path: string, userId: string) {
  if (!isUuid(userId) || path.includes("..") || path.startsWith("/")) {
    return false;
  }

  const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^rma/${escapedUserId}/`, "i").test(path) && isRmaEvidencePathShapeValid(path);
}

function isRmaEvidencePathShapeValid(path: string) {
  return new RegExp(
    `^rma/${uuidSegment}/(?:legacy/${uuidSegment}\\.${legacyEvidenceExtension}|[0-9]{8}/${uuidSegment}\\.${legacyEvidenceExtension}|${uuidSegment}/${uuidSegment}\\.(?:jpg|png|webp|heic|heif))$`,
    "i"
  ).test(path);
}

export function normalizeLegacyRmaAttachments(
  value: unknown,
  userId: string
): RmaAttachment[] | null {
  if (!Array.isArray(value) || value.length > 8) {
    return null;
  }

  const attachments: RmaAttachment[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }

    const bucket = typeof item.bucket === "string" ? item.bucket.trim() : "rma-evidence";
    const path = typeof item.path === "string" ? item.path.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const contentType = typeof item.contentType === "string" ? item.contentType.trim().toLowerCase() : undefined;
    const size = typeof item.size === "number" && Number.isInteger(item.size) ? item.size : undefined;

    if (
      bucket !== rmaEvidenceBucket ||
      !isRmaEvidencePathOwnedByUser(path, userId) ||
      !name ||
      name.length > 180 ||
      /[\\/]/.test(name) ||
      (size !== undefined && (size < 1 || size > 20 * 1024 * 1024)) ||
      (contentType && ![...legacyImageTypes, ...legacyVideoTypes].includes(contentType as LegacyEvidenceContentType))
    ) {
      return null;
    }

    // Deliberately drop client signedUrl and all unknown properties. The
    // server signs an approved path again when it returns the record.
    attachments.push({
      bucket,
      contentType,
      name,
      path,
      size,
      uploadedAt: typeof item.uploadedAt === "string" ? item.uploadedAt : undefined,
    });
  }

  return attachments;
}

const legacyImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
const legacyVideoTypes = ["video/mp4", "video/quicktime"] as const;
type LegacyEvidenceContentType = (typeof legacyImageTypes)[number] | (typeof legacyVideoTypes)[number];

export async function signRmaRequestAttachments(
  requests: RmaRequest[],
  ownerUserId?: string
): Promise<RmaRequest[]> {
  if (!isSupabaseServiceRoleConfigured()) {
    // Never echo a persisted/client-provided signed URL when the server
    // cannot re-authorize it. The opaque attachment record remains readable,
    // but no download capability is returned.
    return requests.map((request) => ({
      ...request,
      attachments: (request.attachments ?? []).map(stripSignedUrl),
    }));
  }

  const supabase = createServiceRoleClient();

  return Promise.all(
    requests.map(async (request) => ({
      ...request,
      attachments: await signRmaAttachments(
        request.attachments ?? [],
        supabase,
        request.ownerUserId ?? ownerUserId
      ),
    }))
  );
}

export async function signSingleRmaRequestAttachments(
  request: RmaRequest,
  ownerUserId?: string
): Promise<RmaRequest> {
  const [signed] = await signRmaRequestAttachments([request], ownerUserId);
  return signed ?? request;
}

/**
 * Hydrate the new relation-table attachments for the customer GET path. The
 * legacy JSON column remains readable, but verified/committed rows are the
 * source of truth for the new opaque-ID flow.
 */
export async function hydrateCustomerRmaAttachments(
  requests: RmaRequest[],
  ownerUserId: string
): Promise<RmaRequest[]> {
  if (!isSupabaseServiceRoleConfigured() || requests.length === 0 || !isUuid(ownerUserId)) {
    return requests;
  }

  const requestIds = requests.map((request) => request.id).filter(isUuid);
  if (requestIds.length === 0) {
    return requests;
  }

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("rma_attachments")
    .select("id,rma_request_id,user_id,original_name,content_type,size_bytes,uploaded_at,verified_at,bucket,storage_path,status")
    .in("rma_request_id", requestIds)
    .in("status", ["verified", "committed"]);

  const byRequestId = new Map<string, RmaAttachment[]>();
  for (const row of Array.isArray(data) ? data : []) {
    if (!isRecord(row)) continue;
    const requestId = typeof row.rma_request_id === "string" ? row.rma_request_id : "";
    const path = typeof row.storage_path === "string" ? row.storage_path : "";
    const bucket = typeof row.bucket === "string" ? row.bucket : "";
    const attachmentId = typeof row.id === "string" ? row.id : "";
    const uploaderUserId = typeof row.user_id === "string" ? row.user_id : "";
    const name = typeof row.original_name === "string" ? row.original_name : "image";
    const contentType = typeof row.content_type === "string" ? row.content_type : undefined;
    if (
      !requestId ||
      !attachmentId ||
      !isUuid(uploaderUserId) ||
      bucket !== rmaEvidenceBucket ||
      !isRmaEvidencePathOwnedByUser(path, uploaderUserId)
    ) {
      continue;
    }

    const { data: signed } = await supabase.storage
      .from(rmaEvidenceBucket)
      .createSignedUrl(path, rmaEvidenceSignedUrlTtlSeconds);
    const attachment: RmaAttachment = {
      attachmentId,
      bucket,
      contentType,
      name,
      path,
      signedUrl: signed?.signedUrl,
      size: typeof row.size_bytes === "number" ? row.size_bytes : undefined,
      uploadedAt: typeof row.uploaded_at === "string" ? row.uploaded_at : undefined,
      // Internal-only signer hint; the customer DTO never exposes it.
      ownerUserId: uploaderUserId,
    };
    const existing = byRequestId.get(requestId) ?? [];
    byRequestId.set(requestId, [...existing, attachment]);
  }

  return requests.map((request) => ({
    ...request,
    attachments: [...(request.attachments ?? []), ...(byRequestId.get(request.id) ?? [])],
  }));
}

async function signRmaAttachments(
  attachments: RmaAttachment[],
  supabase: ReturnType<typeof createServiceRoleClient>,
  ownerUserId?: string
) {
  return Promise.all(
    attachments.map(async (attachment) => {
      const attachmentOwnerUserId = attachment.ownerUserId ?? ownerUserId;
      const safeAttachment = stripSignedUrl(attachment);
      if (
        !safeAttachment.path ||
        safeAttachment.bucket !== rmaEvidenceBucket ||
        !isRmaEvidencePathShapeValid(safeAttachment.path) ||
        !attachmentOwnerUserId ||
        !isRmaEvidencePathOwnedByUser(safeAttachment.path, attachmentOwnerUserId)
      ) {
        return safeAttachment;
      }

      const { data, error } = await supabase.storage
        .from(rmaEvidenceBucket)
        .createSignedUrl(safeAttachment.path, rmaEvidenceSignedUrlTtlSeconds);

      if (error || !data?.signedUrl) {
        return safeAttachment;
      }

      return {
        ...safeAttachment,
        signedUrl: data.signedUrl,
      };
    })
  );
}

function stripSignedUrl(attachment: RmaAttachment): RmaAttachment {
  const safeAttachment = { ...attachment };
  delete safeAttachment.signedUrl;
  delete safeAttachment.ownerUserId;
  return safeAttachment;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
