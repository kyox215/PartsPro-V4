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
  type RmaCustomerShippedInput,
} from "@/lib/partspro-rma-contract";
import {
  assertRmaWorkflowReady,
  RmaWorkflowNotReadyError,
} from "@/lib/partspro-rma-workflow-readiness";
import { isRmaEvidencePathOwnedByUser } from "@/lib/partspro-rma-evidence";
import { normalizeCustomerOrderNumber } from "@/lib/partspro-rma-customer-order.mjs";

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
  await ensureRmaSimpleFlowReady(client);
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
  const { client, user } = await requireAuthenticatedClient();
  await ensureRmaSimpleFlowReady(client);
  return readDraftDto(user.id, draftId);
}

export async function issueRmaUploadTicket(
  draftId: string,
  input: RmaUploadTicketInput
): Promise<RmaUploadTicketDto> {
  const { client, user } = await requireAuthenticatedClient();
  let attachmentId: string | null = null;
  let storagePath: string | null = null;
  let service: ReturnType<typeof createServiceRoleClient> | null = await ensureRmaSimpleFlowReady(client);

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
        user.id,
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
  const service = await ensureRmaSimpleFlowReady(client);
  const { data: attachment, error: attachmentError } = await service
    .from("rma_attachments")
    .select("id,bucket,storage_path,verification_token,content_type,size_bytes,status,sha256,expires_at")
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
  const attachmentStatus = readString(attachment.status);
  const persistedSha256 = readString(attachment.sha256)?.toLowerCase();

  if (!storagePath || !verificationToken || !expectedContentType || expectedSize === null) {
    throw new RmaSimpleFlowError(502, "RMA_ATTACHMENT_INVALID", "RMA attachment metadata is invalid.");
  }

  // A verified/committed row is immutable. A matching hash is a safe replay
  // and can use the idempotent RPC without touching Storage; a mismatched
  // retry is a conflict and must never enter the automatic cancellation path.
  if (attachmentStatus === "verified" || attachmentStatus === "committed") {
    if (!persistedSha256 || persistedSha256 !== input.sha256.toLowerCase()) {
      throw new RmaSimpleFlowError(
        409,
        "RMA_ATTACHMENT_ALREADY_VERIFIED",
        "This RMA attachment was already verified with a different hash."
      );
    }

    const { data, error } = await client.rpc("rma_complete_attachment", {
      p_attachment_id: attachmentId,
      p_sha256: persistedSha256,
      p_size_bytes: expectedSize,
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
  const service = await ensureRmaSimpleFlowReady(client);
  const { data, error } = await client.rpc("rma_cancel_attachment", {
    p_attachment_id: attachmentId,
    p_draft_id: draftId,
  });

  if (error || data !== true) {
    throw mapRpcError(error, "RMA_ATTACHMENT_CANCEL_FAILED", "RMA attachment could not be cancelled.");
  }

  // Database cancellation is the source of truth. Storage deletion is a
  // best-effort compensation and never re-opens a cancelled attachment.
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
  await ensureRmaSimpleFlowReady(client);
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

export async function markRmaShipped(
  requestId: string,
  input: RmaCustomerShippedInput
): Promise<CustomerRmaDto> {
  const { client, user } = await requireAuthenticatedClient();
  await ensureRmaSimpleFlowReady(client);
  const { error } = await client.rpc("rma_mark_customer_shipped", {
    p_request_id: requestId,
    p_return_carrier: input.carrier ?? null,
    p_return_tracking_code: input.tracking ?? null,
  });

  if (error) {
    throw mapRpcError(error, "RMA_SHIPPED_FAILED", "The return shipment could not be recorded.");
  }

  // The RPC has already checked active membership/employee-self ownership.
  // Allow that same customer to receive the canonical result even when a
  // different active member originally submitted the RMA.
  return readCustomerRmaDto(user.id, requestId, { allowCustomerMember: true });
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

/**
 * Every secure RMA write is followed by a server-role hydration read. Probe
 * both capabilities before the write so an A-only or misconfigured rollout
 * cannot commit a row and then fail while constructing the response.
 */
async function ensureRmaSimpleFlowReady(
  client: Awaited<ReturnType<typeof createClient>>
) {
  const service = requireServiceRoleClient();

  try {
    await assertRmaWorkflowReady(client);
  } catch (error) {
    if (error instanceof RmaWorkflowNotReadyError) {
      throw new RmaSimpleFlowError(error.status, error.code, error.message);
    }

    throw error;
  }

  return service;
}

async function cancelRmaAttachmentAfterTicketFailure(
  client: Awaited<ReturnType<typeof createClient>>,
  draftId: string,
  attachmentId: string,
  userId: string,
  service: ReturnType<typeof createServiceRoleClient> | null,
  storagePath: string | null
) {
  let cancellationSucceeded = false;
  try {
    const { data, error } = await client.rpc("rma_cancel_attachment", {
      p_attachment_id: attachmentId,
      p_draft_id: draftId,
    });
    cancellationSucceeded = !error && data === true;
  } catch {
    cancellationSucceeded = false;
  }

  if (!cancellationSucceeded) {
    // The maintenance GC function is the fallback if the cancellation RPC
    // itself is unavailable; never mask the original ticket error. Keep a
    // structured server-side signal so operators can find orphaned rows.
    console.error("RMA attachment ticket compensation could not cancel the database row", {
      attachmentId,
      draftId,
      error: "rpc_error",
    });
    return;
  }

  // A successful cancellation RPC is not enough to authorize object
  // deletion. Re-read through the service role and prove that the row still
  // refers to this user's draft, the exact ticket path and the fixed private
  // bucket, and that the row is cancelled. A concurrent complete can win the
  // row lock and move the attachment to verified/committed; in that case the
  // evidence is immutable and must be left for retention/GC handling.
  if (!service || !storagePath) {
    console.error("RMA attachment ticket compensation could not verify storage cleanup", {
      attachmentId,
      draftId,
      error: "verification_unavailable",
    });
    return;
  }

  let attachment: unknown = null;
  let attachmentReadError: unknown = null;
  try {
    const result = await service
      .from("rma_attachments")
      .select("id,user_id,draft_id,status,bucket,storage_path")
      .eq("id", attachmentId)
      .maybeSingle();
    attachment = result.data;
    attachmentReadError = result.error;
  } catch {
    attachmentReadError = new Error("attachment verification failed");
  }

  const canRemoveStorage =
    !attachmentReadError &&
    isRecord(attachment) &&
    readString(attachment.id) === attachmentId &&
    readString(attachment.user_id) === userId &&
    readString(attachment.draft_id) === draftId &&
    readString(attachment.bucket) === rmaEvidenceBucket &&
    readString(attachment.storage_path) === storagePath &&
    readString(attachment.status) === "cancelled";

  if (!canRemoveStorage) {
    console.error("RMA attachment ticket compensation skipped uncertain storage cleanup", {
      attachmentId,
      draftId,
      error: "attachment_state_mismatch",
    });
    return;
  }

  try {
    const { error: removeError } = await service.storage
      .from(rmaEvidenceBucket)
      .remove([storagePath]);
    if (removeError) {
      throw removeError;
    }
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

async function readCustomerRmaDto(
  userId: string,
  rmaId: string,
  options: { allowCustomerMember?: boolean } = {}
): Promise<CustomerRmaDto> {
  const service = requireServiceRoleClient();
  let requestQuery = service
    .from("rma_requests")
    .select("id,rma_no,order_id,order_no,customer_id,user_id,order_line_id,sku_code,product_name_snapshot,description,quantity,status,reason_code,problem_type,requested_resolution,policy_scope,eligible_until,customer_shipped_at,return_carrier,return_tracking_code,customer_visible_note,created_at,updated_at")
    .eq("id", rmaId);

  if (!options.allowCustomerMember) {
    requestQuery = requestQuery.eq("user_id", userId);
  }

  const { data: row, error } = await requestQuery.maybeSingle();

  if (error || !isRecord(row)) {
    throw new RmaSimpleFlowError(404, "RMA_NOT_FOUND", "RMA request was not found.");
  }

  const orderNumber = normalizeCustomerOrderNumber(await readCustomerOrderNumber(service, row));
  // `order_id` is an internal UUID. Keep the legacy alias only as a
  // customer-visible order number after the server has resolved and checked
  // the business order number above; never return the UUID to the browser.
  const status = readString(row.status) ?? "submitted";
  const customerShippedAt = readString(row.customer_shipped_at);

  let attachmentQuery = service
    .from("rma_attachments")
    .select("id,user_id,customer_id,order_line_id,original_name,content_type,size_bytes,uploaded_at,verified_at,committed_at,bucket,storage_path,status")
    .eq("rma_request_id", rmaId)
    .eq("status", "committed")
    .not("verified_at", "is", null);

  if (!options.allowCustomerMember) {
    attachmentQuery = attachmentQuery.eq("user_id", userId);
  }

  const { data: attachmentRows } = await attachmentQuery.order("created_at", { ascending: true });

  const { data: eventRows } = await service
    .from("rma_request_events")
    .select("id,event_type,note,to_status,created_at")
    .eq("rma_request_id", rmaId)
    .eq("customer_visible", true)
    .order("created_at", { ascending: true });

  const requestUserId = readString(row.user_id);
  const requestCustomerId = readString(row.customer_id);
  const requestOrderLineId = readString(row.order_line_id);
  const attachments = await Promise.all(
    (Array.isArray(attachmentRows) ? attachmentRows : [])
      .filter(isRecord)
      .filter((attachment) => isCustomerAttachmentBoundToRequest(
        attachment,
        requestUserId,
        requestCustomerId,
        requestOrderLineId
      ))
      .map((attachment) => toCustomerAttachmentDto(service, attachment))
  );

  return {
    attachments: attachments.filter((attachment): attachment is CustomerRmaAttachmentDto => attachment !== null),
    createdAt: readString(row.created_at) ?? new Date(0).toISOString(),
    customerStage: status === "approved" && customerShippedAt
      ? "return_in_transit"
      : customerStageForRmaStatus(status),
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
    orderId: orderNumber,
    orderNumber,
    policyScope: readString(row.policy_scope) ?? "legacy_unverified",
    productName: readString(row.product_name_snapshot) ?? readString(row.sku_code) ?? "",
    quantity: readNumber(row.quantity) ?? 0,
    reason: readString(row.reason_code) ?? readString(row.problem_type) ?? "",
    reasonCode: readString(row.reason_code) ?? readString(row.problem_type) ?? "",
    rmaNo: readString(row.rma_no),
    resolution: readString(row.requested_resolution) ?? "",
    requestedResolution: readString(row.requested_resolution) ?? "",
    sku: readString(row.sku_code) ?? "",
    status,
    updatedAt: readString(row.updated_at),
    customerShippedAt,
    canMarkShipped:
      status === "approved" && !customerShippedAt,
    ...(readString(row.return_carrier)
      ? { carrier: readString(row.return_carrier) as string }
      : {}),
    ...(readString(row.return_tracking_code)
      ? { tracking: readString(row.return_tracking_code) as string }
      : {}),
    ...(readString(row.customer_visible_note)
      ? { customerVisibleNote: readString(row.customer_visible_note) as string }
      : {}),
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
): Promise<CustomerRmaAttachmentDto | null> {
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

  if (
    !attachmentId ||
    !isRmaAttachmentContentType(contentType) ||
    !storagePath ||
    bucket !== rmaEvidenceBucket ||
    !signedUrl ||
    !verifiedAt ||
    !Number.isFinite(Date.parse(verifiedAt))
  ) {
    return null;
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

function isCustomerAttachmentBoundToRequest(
  attachment: JsonRecord,
  requestUserId: string | null,
  requestCustomerId: string | null,
  requestOrderLineId: string | null
) {
  const uploaderUserId = readString(attachment.user_id);
  const customerId = readString(attachment.customer_id);
  const orderLineId = readString(attachment.order_line_id);
  const bucket = readString(attachment.bucket);
  const path = readString(attachment.storage_path);
  const verifiedAt = readString(attachment.verified_at);
  const committedAt = readString(attachment.committed_at);

  return Boolean(
    requestUserId &&
      requestCustomerId &&
      requestOrderLineId &&
      uploaderUserId &&
      uploaderUserId === requestUserId &&
      customerId === requestCustomerId &&
      orderLineId === requestOrderLineId &&
      bucket === rmaEvidenceBucket &&
      path &&
      isRmaEvidencePathOwnedByUser(path, uploaderUserId) &&
      verifiedAt &&
      Number.isFinite(Date.parse(verifiedAt)) &&
      committedAt &&
      Number.isFinite(Date.parse(committedAt))
  );
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
  // A concurrent completion can observe the row after another request has
  // verified it. Treat that immutable-state race as a conflict so the route
  // does not enter its 422-only pending-ticket cancellation compensation.
  if (rawCode === "23514" && /not awaiting verification|already verified/i.test(message)) {
    return new RmaSimpleFlowError(
      409,
      "RMA_ATTACHMENT_ALREADY_VERIFIED",
      "This RMA attachment was already verified with a different upload state."
    );
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
