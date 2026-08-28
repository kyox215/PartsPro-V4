import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/admin";
import {
  customerStageForRmaStatus,
  rmaAttachmentContentTypes,
  rmaMaxAttachmentBytes,
  type CustomerRmaAttachmentDto,
  type CustomerRmaDto,
  type RmaCompleteAttachmentInput,
  type RmaDraftCreateInput,
  type RmaDraftDto,
  type RmaUploadTicketDto,
  type RmaUploadTicketInput,
  type RmaCustomerSubmitInput,
} from "@/lib/partspro-rma-contract";

const rmaEvidenceBucket = "rma-evidence";
const rmaEvidenceSignedUrlTtlSeconds = 15 * 60;

type JsonRecord = Record<string, unknown>;

export class RmaSimpleFlowError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status: number;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "RmaSimpleFlowError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function createRmaDraft(
  input: RmaDraftCreateInput
): Promise<RmaDraftDto> {
  const { client, user } = await requireAuthenticatedClient();
  const { data, error } = await client.rpc("rma_create_draft", {
    p_order_line_id: input.orderLineId,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error) {
    throw mapRpcError(error, "RMA_DRAFT_CREATE_FAILED", "RMA draft could not be created.");
  }

  const draftId = readUuid(data);
  if (!draftId) {
    throw new RmaSimpleFlowError(502, "RMA_DRAFT_CREATE_FAILED", "RMA draft id was not returned.");
  }

  return readDraftDto(user.id, draftId);
}

export async function readRmaDraft(draftId: string): Promise<RmaDraftDto> {
  const { user } = await requireAuthenticatedClient();
  return readDraftDto(user.id, draftId);
}

export async function issueRmaUploadTicket(
  draftId: string,
  input: RmaUploadTicketInput
): Promise<RmaUploadTicketDto> {
  // Fail before the prepare RPC so a missing service-role capability cannot
  // create an attachment quota row that this request is unable to clean up.
  if (!isSupabaseServiceRoleConfigured()) {
    throw new RmaSimpleFlowError(503, "RMA_SERVICE_UNAVAILABLE", "RMA evidence storage is not configured.");
  }

  const { client, user } = await requireAuthenticatedClient();
  let attachmentId: string | null = null;
  let storagePath: string | null = null;
  let service: ReturnType<typeof createServiceRoleClient> | null = null;

  try {
    const { data, error } = await client.rpc("rma_prepare_attachment_upload", {
      p_draft_id: draftId,
      p_original_name: input.originalName,
      p_content_type: input.contentType,
      p_size_bytes: input.sizeBytes,
    });

    if (error) {
      throw mapRpcError(error, "RMA_UPLOAD_TICKET_FAILED", "RMA upload ticket could not be created.");
    }

    attachmentId = readUuid(data);
    if (!attachmentId) {
      throw new RmaSimpleFlowError(502, "RMA_UPLOAD_TICKET_FAILED", "Attachment id was not returned.");
    }

    service = requireServiceRoleClient();
    const { data: attachment, error: attachmentError } = await service
      .from("rma_attachments")
      .select("id,storage_path,expires_at")
      .eq("id", attachmentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (attachmentError || !isRecord(attachment)) {
      throw new RmaSimpleFlowError(502, "RMA_UPLOAD_TICKET_FAILED", "Attachment upload metadata was not available.");
    }

    storagePath = readString(attachment.storage_path);
    if (!storagePath) {
      throw new RmaSimpleFlowError(502, "RMA_UPLOAD_TICKET_FAILED", "Attachment storage capability was not created.");
    }

    const { data: signed, error: signedError } = await service.storage
      .from(rmaEvidenceBucket)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (signedError || !signed?.signedUrl) {
      throw new RmaSimpleFlowError(502, "RMA_UPLOAD_TICKET_FAILED", "A direct upload URL could not be created.");
    }

    const expiresAt = readString(attachment.expires_at) ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    return {
      attachmentId,
      expiresAt,
      uploadUrl: signed.signedUrl,
    };
  } catch (error) {
    if (attachmentId) {
      await cancelRmaAttachmentAfterTicketFailure(
        client,
        draftId,
        attachmentId,
        service,
        storagePath
      );
    }

    if (error instanceof RmaSimpleFlowError) {
      throw error;
    }

    throw new RmaSimpleFlowError(502, "RMA_UPLOAD_TICKET_FAILED", "RMA upload ticket could not be created.");
  }
}

export async function completeRmaAttachment(
  attachmentId: string,
  input: RmaCompleteAttachmentInput,
  draftId?: string
) {
  const { client, user } = await requireAuthenticatedClient();
  const service = requireServiceRoleClient();
  const { data: attachment, error: attachmentError } = await service
    .from("rma_attachments")
    .select("id,bucket,storage_path,verification_token,content_type,size_bytes,status,expires_at")
    .eq("id", attachmentId)
    .eq("user_id", user.id)
    .eq("draft_id", draftId ?? "")
    .maybeSingle();

  if (attachmentError || !isRecord(attachment)) {
    throw new RmaSimpleFlowError(404, "RMA_ATTACHMENT_NOT_FOUND", "RMA attachment was not found.");
  }

  const storagePath = readString(attachment.storage_path);
  const verificationToken = readString(attachment.verification_token);
  const expectedContentType = readString(attachment.content_type);
  const expectedSize = readNumber(attachment.size_bytes);

  if (!storagePath || !verificationToken || !expectedContentType || expectedSize === null) {
    throw new RmaSimpleFlowError(502, "RMA_ATTACHMENT_INVALID", "RMA attachment metadata is invalid.");
  }

  const { data: file, error: downloadError } = await service.storage
    .from(rmaEvidenceBucket)
    .download(storagePath);

  if (downloadError || !file) {
    throw new RmaSimpleFlowError(422, "RMA_ATTACHMENT_NOT_UPLOADED", "Upload the image before completing verification.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > rmaMaxAttachmentBytes || bytes.length !== expectedSize) {
    throw new RmaSimpleFlowError(422, "RMA_ATTACHMENT_SIZE_MISMATCH", "Uploaded image size is invalid.");
  }

  const actualContentType = normalizeContentType(file.type);
  if (actualContentType && actualContentType !== expectedContentType) {
    throw new RmaSimpleFlowError(422, "RMA_ATTACHMENT_MIME_MISMATCH", "Uploaded image MIME type does not match its ticket.");
  }

  const detectedContentType = detectImageContentType(bytes);
  if (!contentTypesMatch(expectedContentType, detectedContentType)) {
    throw new RmaSimpleFlowError(422, "RMA_ATTACHMENT_MAGIC_MISMATCH", "Uploaded file is not a valid image of the declared type.");
  }

  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== input.sha256.toLowerCase()) {
    throw new RmaSimpleFlowError(422, "RMA_ATTACHMENT_HASH_MISMATCH", "Uploaded image hash does not match the verification request.");
  }

  const { data, error } = await client.rpc("rma_complete_attachment", {
    p_attachment_id: attachmentId,
    p_sha256: actualSha256,
    p_size_bytes: bytes.length,
    p_verification_token: verificationToken,
  });

  if (error || data !== true) {
    throw mapRpcError(error, "RMA_ATTACHMENT_VERIFY_FAILED", "RMA attachment could not be verified.");
  }

  return {
    attachmentId,
    status: "verified" as const,
  };
}

export async function cancelRmaAttachment(
  draftId: string,
  attachmentId: string
) {
  const { client, user } = await requireAuthenticatedClient();
  const { data, error } = await client.rpc("rma_cancel_attachment", {
    p_attachment_id: attachmentId,
    p_draft_id: draftId,
  });

  if (error || data !== true) {
    throw mapRpcError(error, "RMA_ATTACHMENT_CANCEL_FAILED", "RMA attachment could not be cancelled.");
  }

  // Database cancellation is the source of truth. Storage deletion is a
  // best-effort compensation and never re-opens a cancelled attachment.
  const service = requireServiceRoleClient();
  const { data: attachment } = await service
    .from("rma_attachments")
    .select("storage_path,bucket")
    .eq("id", attachmentId)
    .eq("draft_id", draftId)
    .eq("user_id", user.id)
    .maybeSingle();
  const storagePath = isRecord(attachment) ? readString(attachment.storage_path) : null;
  const bucket = isRecord(attachment) ? readString(attachment.bucket) : null;

  if (storagePath && bucket === rmaEvidenceBucket) {
    const { error: removeError } = await service.storage
      .from(rmaEvidenceBucket)
      .remove([storagePath]);
    if (removeError) {
      throw new RmaSimpleFlowError(
        502,
        "RMA_ATTACHMENT_STORAGE_CLEANUP_PENDING",
        "The attachment was cancelled, but storage cleanup is pending."
      );
    }
  }

  return { attachmentId, status: "cancelled" as const };
}

export async function submitRmaRequest(
  input: RmaCustomerSubmitInput
): Promise<CustomerRmaDto> {
  const draftId = input.draftId;
  if (!draftId) {
    throw new RmaSimpleFlowError(422, "RMA_DRAFT_REQUIRED", "A draftId is required for the secure RMA submission flow.");
  }

  const { client, user } = await requireAuthenticatedClient();
  const { data, error } = await client.rpc("rma_submit_request", {
    p_draft_id: draftId,
    p_order_line_id: input.orderLineId,
    p_quantity: input.quantity,
    // PostgREST omits undefined JSON properties. Send an explicit null so a
    // statutory B2C withdrawal can intentionally omit a reason.
    p_reason_code: input.reasonCode ?? null,
    p_requested_resolution: input.requestedResolution,
    p_note: input.note ?? null,
    p_attachment_ids: input.attachmentIds,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error) {
    throw mapRpcError(error, "RMA_SUBMIT_FAILED", "RMA request could not be submitted.");
  }

  const rmaId = readUuid(data);
  if (!rmaId) {
    throw new RmaSimpleFlowError(502, "RMA_SUBMIT_FAILED", "RMA request id was not returned.");
  }

  return readCustomerRmaDto(user.id, rmaId);
}

async function requireAuthenticatedClient() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new RmaSimpleFlowError(401, "LOGIN_REQUIRED", "A valid login is required for this RMA action.");
  }

  return { client, user };
}

function requireServiceRoleClient() {
  if (!isSupabaseServiceRoleConfigured()) {
    throw new RmaSimpleFlowError(503, "RMA_SERVICE_UNAVAILABLE", "RMA evidence storage is not configured.");
  }

  return createServiceRoleClient();
}

async function cancelRmaAttachmentAfterTicketFailure(
  client: Awaited<ReturnType<typeof createClient>>,
  draftId: string,
  attachmentId: string,
  service: ReturnType<typeof createServiceRoleClient> | null,
  storagePath: string | null
) {
  let cancellationError: unknown = null;
  try {
    const { error } = await client.rpc("rma_cancel_attachment", {
      p_attachment_id: attachmentId,
      p_draft_id: draftId,
    });
    cancellationError = error;
  } catch {
    cancellationError = new Error("RMA attachment cancellation RPC failed");
  }

  if (cancellationError) {
    // The maintenance GC function is the fallback if the cancellation RPC
    // itself is unavailable; never mask the original ticket error. Keep a
    // structured server-side signal so operators can find orphaned rows.
    console.error("RMA attachment ticket compensation could not cancel the database row", {
      attachmentId,
      draftId,
      error: cancellationError instanceof Error ? cancellationError.message : "rpc_error",
    });
  }

  if (service && storagePath) {
    try {
      await service.storage.from(rmaEvidenceBucket).remove([storagePath]);
    } catch (error) {
      // Storage deletion is compensating cleanup and is intentionally best
      // effort. The database row remains cancelled and cannot be submitted.
      console.error("RMA attachment ticket compensation could not remove storage object", {
        attachmentId,
        draftId,
        error: error instanceof Error ? error.message : "storage_error",
      });
    }
  }
}

async function readDraftDto(userId: string, draftId: string): Promise<RmaDraftDto> {
  const service = requireServiceRoleClient();
  const { data: draft, error } = await service
    .from("rma_drafts")
    .select("id,order_line_id,status,policy_scope,created_at")
    .eq("id", draftId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !isRecord(draft)) {
    throw new RmaSimpleFlowError(404, "RMA_DRAFT_NOT_FOUND", "RMA draft was not found.");
  }

  const { count } = await service
    .from("rma_attachments")
    .select("id", { count: "exact", head: true })
    .eq("draft_id", draftId)
    .eq("user_id", userId)
    .in("status", ["pending", "verified", "committed"]);

  return {
    attachmentCount: count ?? 0,
    createdAt: readString(draft.created_at) ?? new Date(0).toISOString(),
    id: readString(draft.id) ?? draftId,
    orderLineId: readString(draft.order_line_id) ?? "",
    policyScope: normalizePolicyScope(draft.policy_scope),
    status: normalizeDraftStatus(draft.status),
  };
}

async function readCustomerRmaDto(userId: string, rmaId: string): Promise<CustomerRmaDto> {
  const service = requireServiceRoleClient();
  const { data: row, error } = await service
    .from("rma_requests")
    .select("id,rma_no,order_id,order_no,customer_id,order_line_id,sku_code,product_name_snapshot,description,quantity,status,reason_code,problem_type,requested_resolution,policy_scope,eligible_until,created_at,updated_at")
    .eq("id", rmaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !isRecord(row)) {
    throw new RmaSimpleFlowError(404, "RMA_NOT_FOUND", "RMA request was not found.");
  }

  const orderNumber = await readCustomerOrderNumber(service, row);

  const { data: attachmentRows } = await service
    .from("rma_attachments")
    .select("id,original_name,content_type,size_bytes,uploaded_at,verified_at,bucket,storage_path,status")
    .eq("rma_request_id", rmaId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const { data: eventRows } = await service
    .from("rma_request_events")
    .select("id,event_type,note,to_status,created_at")
    .eq("rma_request_id", rmaId)
    .eq("customer_visible", true)
    .order("created_at", { ascending: true });

  const attachments = await Promise.all(
    (Array.isArray(attachmentRows) ? attachmentRows : [])
      .filter(isRecord)
      .map((attachment) => toCustomerAttachmentDto(service, attachment))
  );

  return {
    attachments,
    createdAt: readString(row.created_at) ?? new Date(0).toISOString(),
    customerStage: customerStageForRmaStatus(readString(row.status) ?? "submitted"),
    description: readString(row.description) ?? "",
    eligibleUntil: readString(row.eligible_until),
    events: (Array.isArray(eventRows) ? eventRows : [])
      .filter(isRecord)
      .map((event) => ({
        createdAt: readString(event.created_at) ?? new Date(0).toISOString(),
        eventType: readString(event.event_type) ?? "event",
        id: readString(event.id) ?? "",
        note: readString(event.note) ?? undefined,
        toStatus: readString(event.to_status),
      }))
      .filter((event) => event.id.length > 0),
    id: readString(row.id) ?? rmaId,
    orderId: readString(row.order_id),
    orderNumber,
    orderLineId: readString(row.order_line_id),
    policyScope: readString(row.policy_scope) ?? "legacy_unverified",
    productName: readString(row.product_name_snapshot) ?? readString(row.sku_code) ?? "",
    quantity: readNumber(row.quantity) ?? 0,
    reason: readString(row.reason_code) ?? readString(row.problem_type) ?? "",
    reasonCode: readString(row.reason_code) ?? readString(row.problem_type) ?? "",
    rmaNo: readString(row.rma_no),
    resolution: readString(row.requested_resolution) ?? "",
    requestedResolution: readString(row.requested_resolution) ?? "",
    sku: readString(row.sku_code) ?? "",
    status: readString(row.status) ?? "submitted",
    updatedAt: readString(row.updated_at),
  };
}

/**
 * Resolve the customer-facing order number through the authorized order row.
 * The RMA is already scoped to the authenticated user; matching customer_id
 * here prevents a service-role lookup from ever widening that boundary.
 */
async function readCustomerOrderNumber(
  service: ReturnType<typeof createServiceRoleClient>,
  row: JsonRecord
) {
  const fallback = readString(row.order_no);
  const orderId = readString(row.order_id);
  const customerId = readString(row.customer_id);

  if (!orderId || !customerId) {
    return fallback;
  }

  const { data: order } = await service
    .from("orders")
    .select("id,order_no")
    .eq("id", orderId)
    .eq("customer_id", customerId)
    .maybeSingle();

  return isRecord(order) ? readString(order.order_no) ?? fallback : fallback;
}

async function toCustomerAttachmentDto(
  service: ReturnType<typeof createServiceRoleClient>,
  row: JsonRecord
): Promise<CustomerRmaAttachmentDto> {
  const attachmentId = readString(row.id) ?? "";
  const contentType = normalizeContentType(readString(row.content_type));
  const name = readString(row.original_name) ?? "image";
  const sizeBytes = readNumber(row.size_bytes) ?? 0;
  const uploadedAt = readString(row.uploaded_at);
  const verifiedAt = readString(row.verified_at);
  const storagePath = readString(row.storage_path);
  const bucket = readString(row.bucket) ?? rmaEvidenceBucket;
  let signedUrl: string | undefined;

  if (storagePath && bucket === rmaEvidenceBucket) {
    const { data } = await service.storage
      .from(rmaEvidenceBucket)
      .createSignedUrl(storagePath, rmaEvidenceSignedUrlTtlSeconds);
    signedUrl = data?.signedUrl;
  }

  if (!attachmentId || !isRmaAttachmentContentType(contentType)) {
    return {
      attachmentId,
      contentType: "image/jpeg",
      name,
      sizeBytes,
      uploadedAt,
      verifiedAt,
    };
  }

  return {
    attachmentId,
    contentType,
    name,
    sizeBytes,
    uploadedAt,
    verifiedAt,
    ...(signedUrl ? { signedUrl } : {}),
  };
}

function mapRpcError(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
) {
  const row = isRecord(error) ? error : {};
  const rawCode = readString(row.code);
  const message = readString(row.message) ?? fallbackMessage;
  if (rawCode === "P0001" || (rawCode === "23505" && /idempotency|already submitted|different payload/i.test(message))) {
    return new RmaSimpleFlowError(409, "RMA_IDEMPOTENCY_CONFLICT", "The RMA submission key was already used with a different payload.");
  }
  const status = rpcStatus(rawCode);
  return new RmaSimpleFlowError(status, rawCode ? `RMA_${rawCode}` : fallbackCode, message);
}

function rpcStatus(code: string | null) {
  switch (code) {
    case "28000":
      return 401;
    case "42501":
      return 403;
    case "P0002":
      return 404;
    case "23505":
    case "55P03":
      return 409;
    case "22003":
    case "22023":
    case "23503":
    case "23514":
    case "57014":
      return 422;
    default:
      return 502;
  }
}

function detectImageContentType(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12
    && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") {
    const brand = bytes.toString("ascii", 8, 12).toLowerCase();
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) {
      return "image/heic";
    }
    if (["mif1", "msf1"].includes(brand)) {
      return "image/heif";
    }
  }

  return null;
}

function contentTypesMatch(expected: string, detected: string | null) {
  return detected !== null && detected === expected;
}

function normalizeContentType(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return text || null;
}

function isRmaAttachmentContentType(value: string | null): value is (typeof rmaAttachmentContentTypes)[number] {
  return Boolean(value && (rmaAttachmentContentTypes as readonly string[]).includes(value));
}

function readUuid(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    return readUuid(value[0]);
  }

  if (isRecord(value)) {
    return readUuid(value.id);
  }

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeDraftStatus(value: unknown): RmaDraftDto["status"] {
  switch (value) {
    case "submitted":
    case "abandoned":
    case "expired":
      return value;
    default:
      return "open";
  }
}

function normalizePolicyScope(value: unknown): RmaDraftDto["policyScope"] {
  switch (value) {
    case "statutory_b2c_withdrawal":
    case "b2c_statutory_withdrawal":
    case "b2c_warranty":
    case "b2b_commercial":
      return value;
    default:
      return "legacy_unverified";
  }
}
