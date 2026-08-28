/**
 * Browser-safe RMA image preparation and upload orchestration.
 *
 * This module deliberately has no Supabase client or service-role dependency.
 * The server issues the opaque ticket and signed upload URL; the browser only
 * uploads the prepared Blob and sends its SHA-256 to the complete endpoint.
 */

/** @type {readonly ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]} */
export const rmaAttachmentContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const rmaMaxAttachments = 6;
export const rmaMaxAttachmentBytes = 4 * 1024 * 1024;
export const rmaMaxImageDimension = 2200;

const heicContentTypes = new Set(["image/heic", "image/heif"]);
const extensionContentTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["jpe", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
]);

/**
 * @typedef {Blob & {name?: string, type?: string, size?: number, lastModified?: number}} RmaImageFileLike
 */

/**
 * @typedef {Record<string, unknown>} RmaSubmitPayload
 */

/**
 * A browser-memory checkpoint. It contains only opaque attachment IDs and the
 * final allowlisted submit payload; it never contains Storage paths or URLs.
 * @typedef {Object} RmaUploadCheckpoint
 * @property {1} version
 * @property {"active"|"abandoning"} phase
 * @property {string|null} draftId
 * @property {Record<string, string>} verifiedAttachmentIds
 * @property {string[]} pendingCancellationIds
 * @property {string} inputFingerprint
 * @property {RmaSubmitPayload|null} payload
 */

/** @typedef {(checkpoint: RmaUploadCheckpoint|null) => void} RmaCheckpointCallback */

/** @typedef {{file: RmaImageFileLike, reason: string}} RmaRejectedImage */

/**
 * @param {string=} type
 * @param {string=} name
 * @returns {string|null}
 */
export function inferRmaImageContentType(type = "", name = "") {
  const normalizedType = String(type || "").trim().toLowerCase().split(";", 1)[0];
  if (normalizedType) {
    return rmaAttachmentContentTypes.includes(/** @type {any} */ (normalizedType))
      ? normalizedType
      : null;
  }

  const extension = String(name || "")
    .split(/[\\/]/)
    .pop()
    ?.split(".")
    .pop()
    ?.toLowerCase();

  return extensionContentTypes.get(extension || "") ?? null;
}

/**
 * @param {RmaImageFileLike} file
 * @returns {boolean}
 */
export function isRmaImageFile(file) {
  return Boolean(file && inferRmaImageContentType(file.type, file.name));
}

/**
 * @param {number} bytes
 * @param {number=} maxBytes
 */
export function isRmaImageSizeAllowed(bytes, maxBytes = rmaMaxAttachmentBytes) {
  return Number.isInteger(bytes) && bytes > 0 && bytes <= maxBytes;
}

/**
 * An oversized raster image can still be selected because the browser may
 * compress it. HEIC/HEIF has no reliable browser decoder, so an oversized
 * HEIC/HEIF is rejected at selection time with a useful reason.
 *
 * @param {RmaImageFileLike[]} currentFiles
 * @param {RmaImageFileLike[]} incomingFiles
 * @param {number=} maxCount
 * @returns {{accepted: RmaImageFileLike[], rejected: RmaRejectedImage[], remainingSlots: number}}
 */
export function selectRmaImageFiles(
  currentFiles = [],
  incomingFiles = [],
  maxCount = rmaMaxAttachments
) {
  const accepted = [...currentFiles];
  /** @type {RmaRejectedImage[]} */
  const rejected = [];
  const identities = new Set(accepted.map(rmaImageIdentity));

  for (const file of incomingFiles) {
    if (!isRmaImageFile(file)) {
      rejected.push({ file, reason: "unsupported_image_type" });
      continue;
    }

    const type = inferRmaImageContentType(file.type, file.name);
    if (heicContentTypes.has(type || "") && !isRmaImageSizeAllowed(Number(file.size))) {
      rejected.push({ file, reason: "heic_image_over_4mb" });
      continue;
    }

    const identity = rmaImageIdentity(file);
    if (identities.has(identity)) {
      rejected.push({ file, reason: "duplicate_image" });
      continue;
    }

    if (accepted.length >= maxCount) {
      rejected.push({ file, reason: "max_images" });
      continue;
    }

    accepted.push(file);
    identities.add(identity);
  }

  return {
    accepted,
    rejected,
    remainingSlots: Math.max(0, maxCount - accepted.length),
  };
}

/**
 * @param {RmaImageFileLike} file
 * @returns {string}
 */
export function rmaImageIdentity(file) {
  return [file?.name || "", file?.size || 0, file?.lastModified || 0, file?.type || ""].join("\u001f");
}

/**
 * @param {string} contentType
 * @returns {string}
 */
function fileExtensionForContentType(contentType) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

/**
 * @param {string=} name
 * @param {string} contentType
 */
function filenameForContentType(name, contentType) {
  const safeName = String(name || "rma-photo").split(/[\\/]/).pop() || "rma-photo";
  const withoutExtension = safeName.replace(/\.[^.]+$/, "");
  return `${withoutExtension || "rma-photo"}.${fileExtensionForContentType(contentType)}`;
}

/**
 * @param {Blob|RmaImageFileLike} source
 * @param {string} name
 * @param {string} contentType
 * @returns {Blob|File|RmaImageFileLike}
 */
function createPreparedFile(source, name, contentType) {
  if (typeof File !== "undefined") {
    return new File([source], name, {
      type: contentType,
      lastModified: Date.now(),
    });
  }

  if (source instanceof Blob) {
    return source;
  }

  return {
    ...source,
    name,
    type: contentType,
  };
}

/**
 * Keep the user's filename where no transcoding was needed, while normalizing
 * an empty browser MIME value from a file extension for the signed ticket.
 *
 * @param {Blob & RmaImageFileLike} file
 * @param {string} contentType
 */
function preserveOriginalFile(file, contentType) {
  const originalName = String(file.name || "").split(/[\\/]/).pop() || filenameForContentType("rma-photo", contentType);
  if (String(file.type || "").toLowerCase() === contentType && file.name === originalName) {
    return file;
  }
  return createPreparedFile(file, originalName, contentType);
}

/**
 * @param {RmaImageFileLike} file
 * @returns {Promise<{width:number,height:number,image:CanvasImageSource,close?:()=>void}>}
 */
async function decodeRmaImage(file) {
  if (typeof globalThis.createImageBitmap === "function") {
    const image = await globalThis.createImageBitmap(/** @type {Blob} */ (file));
    return { width: image.width, height: image.height, image, close: () => image.close() };
  }

  if (
    typeof globalThis.Image !== "function" ||
    typeof globalThis.URL?.createObjectURL !== "function"
  ) {
    throw new Error("Browser image decoding is unavailable.");
  }

  const objectUrl = globalThis.URL.createObjectURL(/** @type {Blob} */ (file));
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The image could not be decoded."));
      element.src = objectUrl;
    });
    return {
      width: /** @type {HTMLImageElement} */ (image).naturalWidth,
      height: /** @type {HTMLImageElement} */ (image).naturalHeight,
      image: /** @type {HTMLImageElement} */ (image),
    };
  } finally {
    globalThis.URL.revokeObjectURL(objectUrl);
  }
}

/**
 * @param {CanvasImageSource} image
 * @param {number} width
 * @param {number} height
 * @param {string} contentType
 * @param {number} quality
 * @returns {Promise<Blob|null>}
 */
async function canvasToBlob(image, width, height, contentType, quality) {
  const canvas =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(width, height)
      : typeof document !== "undefined"
        ? document.createElement("canvas")
        : null;

  if (!canvas) {
    return null;
  }

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);

  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: contentType, quality });
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), contentType, quality);
  });
}

/**
 * Prepare an image for the new ticket contract. Raster images are decoded and
 * reduced without upscaling when needed. HEIC/HEIF remains unchanged only if
 * it is already within the server's 4 MiB limit.
 *
 * @param {Blob & RmaImageFileLike} file
 * @param {{maxBytes?:number,maxDimension?:number}=} options
 * @returns {Promise<Blob|File|RmaImageFileLike>}
 */
export async function prepareRmaImage(file, options = {}) {
  const maxBytes = options.maxBytes ?? rmaMaxAttachmentBytes;
  const maxDimension = options.maxDimension ?? rmaMaxImageDimension;
  const contentType = inferRmaImageContentType(file?.type, file?.name);

  if (!contentType) {
    throw new RmaUploadClientError("UNSUPPORTED_IMAGE", "Only JPEG, PNG, WebP, HEIC or HEIF images are supported.");
  }

  const size = Number(file?.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new RmaUploadClientError("EMPTY_IMAGE", "The selected image is empty.");
  }

  const isHeic = heicContentTypes.has(contentType);
  if (isHeic && isRmaImageSizeAllowed(size, maxBytes)) {
    return preserveOriginalFile(file, contentType);
  }

  let decoded;
  try {
    decoded = await decodeRmaImage(file);
  } catch (error) {
    if (!isHeic && isRmaImageSizeAllowed(size, maxBytes)) {
      return preserveOriginalFile(file, contentType);
    }

    throw new RmaUploadClientError(
      isHeic ? "HEIC_TOO_LARGE" : "IMAGE_COMPRESSION_UNAVAILABLE",
      isHeic
        ? "This HEIC/HEIF image is over 4 MB and this browser cannot decode it. Choose a smaller photo."
        : "This image is over 4 MB and could not be compressed in this browser.",
      error
    );
  }

  try {
    const longestSide = Math.max(decoded.width, decoded.height);
    if (isRmaImageSizeAllowed(size, maxBytes) && longestSide <= maxDimension) {
      return preserveOriginalFile(file, contentType);
    }

    const initialScale = Math.min(1, maxDimension / Math.max(1, longestSide));
    const scales = [1, 0.92, 0.84, 0.76, 0.68, 0.6].map((factor) => initialScale * factor);
    const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
    const outputType = contentType === "image/png" ? "image/webp" : contentType;

    for (const scale of scales) {
      const width = Math.max(1, Math.round(decoded.width * Math.min(1, scale)));
      const height = Math.max(1, Math.round(decoded.height * Math.min(1, scale)));

      for (const quality of qualities) {
        const blob = await canvasToBlob(decoded.image, width, height, outputType, quality);
        if (blob && isRmaImageSizeAllowed(blob.size, maxBytes)) {
          return createPreparedFile(
            blob,
            filenameForContentType(file.name, outputType),
            outputType
          );
        }
      }
    }
  } finally {
    decoded.close?.();
  }

  throw new RmaUploadClientError(
    "IMAGE_TOO_LARGE",
    "This image could not be reduced below the 4 MB upload limit. Choose a smaller photo."
  );
}

/**
 * @param {Blob|ArrayBuffer|ArrayBufferView} value
 * @returns {Promise<string>}
 */
export async function sha256Hex(value) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new RmaUploadClientError("SHA256_UNAVAILABLE", "This browser cannot verify the image upload.");
  }

  let bytes;
  if (value instanceof ArrayBuffer) {
    bytes = value;
  } else if (ArrayBuffer.isView(value)) {
    bytes = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  } else {
    bytes = await value.arrayBuffer();
  }

  const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * @typedef {{method?:string,headers?:Record<string,string>,body?:unknown}} RmaFetchOptions
 * @typedef {(input:RequestInfo|URL, init?:RmaFetchOptions)=>Promise<Response>} RmaFetch
 * @typedef {{index:number,total:number,status:"preparing"|"uploading"|"verifying"|"retrying",name:string}} RmaUploadProgress
 */

export class RmaUploadClientError extends Error {
  /** @param {string} code @param {string} message @param {unknown=} cause */
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "RmaUploadClientError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/** @param {Response} response */
async function readResponseBody(response) {
  return response.json().catch(() => null);
}

/**
 * @param {Response} response
 * @param {string} fallback
 */
async function assertResponse(response, fallback) {
  const body = await readResponseBody(response);
  if (!response.ok) {
    const message = isRecord(body) && isRecord(body.error) && typeof body.error.message === "string"
      ? body.error.message
      : fallback;
    throw new RmaUploadClientError(`HTTP_${response.status}`, message);
  }
  return body;
}

/** @param {unknown} body @returns {Record<string, any>} */
function readData(body) {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new RmaUploadClientError("INVALID_RESPONSE", "The RMA service returned an invalid response.");
  }
  return body.data;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function readRequiredString(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RmaUploadClientError("INVALID_RESPONSE", "The RMA service did not return the required upload identifier.");
  }
  return value;
}

/**
 * This is the only final submit payload constructor. Keep it explicit so
 * bucket, path and signed URL data can never leak into the customer request.
 */
export function buildRmaSubmitPayload({
  draftId,
  orderLineId,
  quantity,
  reasonCode,
  requestedResolution,
  note,
  attachmentIds,
  idempotencyKey,
}) {
  const payload = {
    draftId,
    orderLineId,
    quantity,
    reasonCode,
    requestedResolution,
    attachmentIds: [...attachmentIds],
    idempotencyKey,
  };

  if (note?.trim()) {
    payload.note = note.trim();
  }

  return payload;
}

/**
 * Build a stable browser-only binding for a checkpoint. File contents are not
 * persisted; the selected file identity and form values are enough to prevent
 * a resumed upload from silently attaching evidence to a changed request.
 * @param {{orderLineId:string,quantity:number,reasonCode?:string|null,requestedResolution:string,note?:string|null,files?:RmaImageFileLike[]}} input
 * @returns {string}
 */
export function rmaUploadInputFingerprint({
  orderLineId,
  quantity,
  reasonCode = null,
  requestedResolution,
  note = null,
  files = [],
}) {
  return JSON.stringify({
    attachmentIdentities: files.map(rmaImageIdentity).sort(),
    note: note?.trim() || "",
    orderLineId,
    quantity,
    reasonCode: reasonCode || null,
    requestedResolution,
  });
}

/**
 * @param {RmaUploadCheckpoint} checkpoint
 * @returns {RmaUploadCheckpoint}
 */
function cloneRmaUploadCheckpoint(checkpoint) {
  return {
    version: 1,
    phase: checkpoint.phase,
    draftId: checkpoint.draftId,
    verifiedAttachmentIds: { ...checkpoint.verifiedAttachmentIds },
    pendingCancellationIds: [...checkpoint.pendingCancellationIds],
    inputFingerprint: checkpoint.inputFingerprint,
    payload: checkpoint.payload ? { ...checkpoint.payload } : null,
  };
}

/**
 * @param {unknown} value
 * @returns {RmaUploadCheckpoint|null}
 */
function normalizeRmaUploadCheckpoint(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value) || value.version !== 1) {
    throw new RmaUploadClientError("INVALID_CHECKPOINT", "The saved RMA upload state is invalid. Restart the upload.");
  }

  const phase = value.phase === "abandoning" ? "abandoning" : "active";
  const verifiedAttachmentIds = isRecord(value.verifiedAttachmentIds)
    ? Object.fromEntries(
        Object.entries(value.verifiedAttachmentIds).filter(
          ([identity, attachmentId]) => identity && typeof attachmentId === "string" && attachmentId.trim()
        )
      )
    : {};
  const pendingCancellationIds = Array.isArray(value.pendingCancellationIds)
    ? value.pendingCancellationIds.filter((attachmentId) => typeof attachmentId === "string" && attachmentId.trim())
    : [];
  const draftId = typeof value.draftId === "string" && value.draftId.trim() ? value.draftId : null;
  const inputFingerprint = typeof value.inputFingerprint === "string" ? value.inputFingerprint : "";
  const payload = phase === "abandoning"
    ? null
    : value.payload === null || value.payload === undefined
    ? null
    : isRecord(value.payload)
      ? { ...value.payload }
      : null;

  if (!draftId && (Object.keys(verifiedAttachmentIds).length > 0 || pendingCancellationIds.length > 0 || payload)) {
    throw new RmaUploadClientError("INVALID_CHECKPOINT", "The saved RMA upload state has no draft. Restart the upload.");
  }

  return {
    version: 1,
    phase,
    draftId,
    verifiedAttachmentIds,
    pendingCancellationIds,
    inputFingerprint,
    payload,
  };
}

/**
 * Move a checkpoint into the one-way cleanup phase. Clearing payload before
 * the first DELETE prevents a later retry from replaying a request that the
 * server may already have committed.
 * @param {RmaUploadCheckpoint} checkpoint
 */
function queueCheckpointAbandonment(checkpoint) {
  checkpoint.phase = "abandoning";
  checkpoint.payload = null;
  checkpoint.pendingCancellationIds = [
    ...new Set([
      ...checkpoint.pendingCancellationIds,
      ...Object.values(checkpoint.verifiedAttachmentIds),
    ]),
  ];
}

/**
 * @param {RmaCheckpointCallback|undefined} onCheckpoint
 * @param {RmaUploadCheckpoint|null} checkpoint
 */
function emitRmaUploadCheckpoint(onCheckpoint, checkpoint) {
  onCheckpoint?.(checkpoint ? cloneRmaUploadCheckpoint(checkpoint) : null);
}

/**
 * @param {RmaUploadCheckpoint} checkpoint
 * @param {{orderLineId:string,quantity:number,reasonCode?:string|null,requestedResolution:string,note?:string|null,files?:RmaImageFileLike[]}} input
 */
function assertCheckpointMatchesInput(checkpoint, input) {
  if (!checkpoint.inputFingerprint || input.files?.length === 0) {
    return;
  }

  if (checkpoint.inputFingerprint !== rmaUploadInputFingerprint(input)) {
    throw new RmaUploadClientError(
      "CHECKPOINT_INPUT_MISMATCH",
      "The selected order, reason, or photos changed. Restart the upload before submitting."
    );
  }
}

/**
 * @param {RmaFetch} fetchImpl
 * @param {string} draftId
 * @param {string} attachmentId
 * @returns {Promise<boolean>}
 */
async function cancelRmaTicket(fetchImpl, draftId, attachmentId) {
  try {
    const response = await fetchImpl(`/api/rma/drafts/${draftId}/attachments/${attachmentId}/complete`, {
      method: "DELETE",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Confirm all previously failed ticket cancellations before issuing another
 * ticket. A failed cancellation stops the resume before any new upload.
 * @param {RmaUploadCheckpoint} checkpoint
 * @param {RmaFetch} fetchImpl
 * @param {RmaCheckpointCallback|undefined} onCheckpoint
 */
async function settlePendingCancellations(checkpoint, fetchImpl, onCheckpoint) {
  for (const attachmentId of [...checkpoint.pendingCancellationIds]) {
    const cancelled = await cancelRmaTicket(fetchImpl, checkpoint.draftId, attachmentId);
    if (!cancelled) {
      emitRmaUploadCheckpoint(onCheckpoint, checkpoint);
      throw new RmaUploadClientError(
        "RMA_ATTACHMENT_CANCEL_FAILED",
        "A previous upload could not be cancelled. Try again before uploading another image."
      );
    }

    checkpoint.pendingCancellationIds = checkpoint.pendingCancellationIds.filter(
      (pendingId) => pendingId !== attachmentId
    );
    for (const [identity, verifiedId] of Object.entries(checkpoint.verifiedAttachmentIds)) {
      if (verifiedId === attachmentId) {
        delete checkpoint.verifiedAttachmentIds[identity];
      }
    }
    emitRmaUploadCheckpoint(onCheckpoint, checkpoint);
  }
}

/**
 * Safely abandon a resumable upload. The checkpoint is cleared only after all
 * verified or pending attachment rows have confirmed cancellation (2xx).
 * @param {{checkpoint:RmaUploadCheckpoint,fetchImpl?:RmaFetch,onCheckpoint?:RmaCheckpointCallback}} input
 * @returns {Promise<null>}
 */
export async function cancelRmaUploadCheckpoint({
  checkpoint,
  fetchImpl = globalThis.fetch.bind(globalThis),
  onCheckpoint,
}) {
  const normalized = normalizeRmaUploadCheckpoint(checkpoint);
  if (!normalized) {
    onCheckpoint?.(null);
    return null;
  }

  if (!normalized.draftId) {
    emitRmaUploadCheckpoint(onCheckpoint, normalized);
    throw new RmaUploadClientError("INVALID_CHECKPOINT", "The saved RMA upload state has no draft. Restart the upload.");
  }

  queueCheckpointAbandonment(normalized);
  emitRmaUploadCheckpoint(onCheckpoint, normalized);
  await settlePendingCancellations(normalized, fetchImpl, onCheckpoint);
  emitRmaUploadCheckpoint(onCheckpoint, null);
  return null;
}

/**
 * Create a draft, upload/verify every image and finally submit opaque IDs.
 * Each image retries its complete ticket flow once; every failed ticket is
 * cancelled best-effort before the original error is rethrown.
 * @param {{orderLineId:string,quantity:number,reasonCode?:string|null,requestedResolution:string,note?:string|null,files:RmaImageFileLike[],idempotencyKey:string,draftIdempotencyKey?:string,checkpoint?:RmaUploadCheckpoint|null,fetchImpl?:RmaFetch,onProgress?:(progress:RmaUploadProgress)=>void,onCheckpoint?:RmaCheckpointCallback,prepareImage?:typeof prepareRmaImage}} input
 */
export async function submitRmaWithAttachments({
  orderLineId,
  quantity,
  reasonCode,
  requestedResolution,
  note,
  files,
  idempotencyKey,
  draftIdempotencyKey = idempotencyKey,
  checkpoint: inputCheckpoint = null,
  fetchImpl = globalThis.fetch.bind(globalThis),
  onProgress,
  onCheckpoint,
  prepareImage = prepareRmaImage,
}) {
  const checkpoint = normalizeRmaUploadCheckpoint(inputCheckpoint);
  const selectedFiles = Array.isArray(files) ? files : [];
  const input = {
    orderLineId,
    quantity,
    reasonCode,
    requestedResolution,
    note,
    files: selectedFiles,
  };

  if (checkpoint?.phase === "abandoning") {
    // Abandonment is one-way: never inspect or replay a final payload once
    // cleanup has started. A retry may only finish the outstanding DELETEs.
    queueCheckpointAbandonment(checkpoint);
    emitRmaUploadCheckpoint(onCheckpoint, checkpoint);
    if (checkpoint.draftId) {
      await settlePendingCancellations(checkpoint, fetchImpl, onCheckpoint);
    }
    emitRmaUploadCheckpoint(onCheckpoint, null);
    throw new RmaUploadClientError(
      "RMA_UPLOAD_ABANDONED",
      "The previous RMA upload was abandoned after cleanup. Start a new upload."
    );
  }

  if (checkpoint?.payload) {
    assertCheckpointMatchesInput(checkpoint, input);
    return submitCheckpointPayload({ checkpoint, fetchImpl, onCheckpoint });
  }

  if (selectedFiles.length < 1 || selectedFiles.length > rmaMaxAttachments) {
    throw new RmaUploadClientError("INVALID_IMAGE_COUNT", `Choose between 1 and ${rmaMaxAttachments} images.`);
  }

  for (const file of selectedFiles) {
    if (!isRmaImageFile(file)) {
      throw new RmaUploadClientError("UNSUPPORTED_IMAGE", "Only JPEG, PNG, WebP, HEIC or HEIF images are supported.");
    }
  }

  if (checkpoint) {
    assertCheckpointMatchesInput(checkpoint, input);
  }

  const uploadCheckpoint = checkpoint ?? {
    version: 1,
    phase: "active",
    draftId: null,
    verifiedAttachmentIds: {},
    pendingCancellationIds: [],
    inputFingerprint: rmaUploadInputFingerprint(input),
    payload: null,
  };
  if (!uploadCheckpoint.inputFingerprint) {
    uploadCheckpoint.inputFingerprint = rmaUploadInputFingerprint(input);
  }

  let draftId = uploadCheckpoint.draftId;
  if (!draftId) {
    let draftBody;
    try {
      const draftResponse = await fetchImpl("/api/rma/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderLineId, idempotencyKey: draftIdempotencyKey }),
      });
      draftBody = await assertResponse(draftResponse, "The RMA draft could not be created.");
      const draft = readData(draftBody);
      draftId = readRequiredString(draft.id);
    } catch (error) {
      throw attachRmaUploadError(error, {
        code: "RMA_DRAFT_CREATE_FAILED",
        message: "The RMA draft could not be created.",
        checkpoint: uploadCheckpoint,
      });
    }
    uploadCheckpoint.draftId = draftId;
    emitRmaUploadCheckpoint(onCheckpoint, uploadCheckpoint);
  }

  await settlePendingCancellations(uploadCheckpoint, fetchImpl, onCheckpoint);

  /** @type {string[]} */
  const attachmentIds = [];

  for (let index = 0; index < selectedFiles.length; index += 1) {
    const file = selectedFiles[index];
    const identity = rmaImageIdentity(file);
    const verifiedAttachmentId = uploadCheckpoint.verifiedAttachmentIds[identity];
    if (verifiedAttachmentId) {
      attachmentIds.push(verifiedAttachmentId);
      continue;
    }

    let lastError;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      // A prior failed ticket must be confirmed cancelled before another
      // ticket can be issued, otherwise a retry would consume quota forever.
      await settlePendingCancellations(uploadCheckpoint, fetchImpl, onCheckpoint);

      if (attempt > 0) {
        onProgress?.({ index, total: selectedFiles.length, status: "retrying", name: file.name || "image" });
      }

      try {
        const attachmentId = await uploadOneRmaImage({
          draftId,
          file,
          index,
          total: selectedFiles.length,
          fetchImpl,
          onProgress,
          prepareImage,
        });
        attachmentIds.push(attachmentId);
        uploadCheckpoint.verifiedAttachmentIds[identity] = attachmentId;
        emitRmaUploadCheckpoint(onCheckpoint, uploadCheckpoint);
        lastError = undefined;
        break;
      } catch (error) {
        const errorRecord = isRecord(error) ? error : null;
        const failedAttachmentId = errorRecord && typeof errorRecord.attachmentId === "string"
          ? errorRecord.attachmentId
          : null;
        if (failedAttachmentId && errorRecord?.cancellationConfirmed !== true) {
          if (!uploadCheckpoint.pendingCancellationIds.includes(failedAttachmentId)) {
            uploadCheckpoint.pendingCancellationIds.push(failedAttachmentId);
          }
        }
        emitRmaUploadCheckpoint(onCheckpoint, uploadCheckpoint);
        lastError = error;
      }
    }

    if (lastError) {
      throw attachRmaUploadError(lastError, {
        code: "RMA_IMAGE_UPLOAD_FAILED",
        message: "The image upload failed.",
        checkpoint: uploadCheckpoint,
        draftId,
        attachmentIds,
      });
    }
  }

  const payload = buildRmaSubmitPayload({
    draftId,
    orderLineId,
    quantity,
    reasonCode,
    requestedResolution,
    note,
    attachmentIds,
    idempotencyKey,
  });
  uploadCheckpoint.payload = payload;
  emitRmaUploadCheckpoint(onCheckpoint, uploadCheckpoint);
  return submitCheckpointPayload({ checkpoint: uploadCheckpoint, fetchImpl, onCheckpoint });
}

/**
 * @param {{checkpoint:RmaUploadCheckpoint,fetchImpl:RmaFetch,onCheckpoint?:RmaCheckpointCallback}} input
 */
async function submitCheckpointPayload({ checkpoint, fetchImpl, onCheckpoint }) {
  const payload = checkpoint.payload;
  if (!payload) {
    throw new RmaUploadClientError("INVALID_CHECKPOINT", "The saved RMA upload has no final payload. Restart the upload.");
  }

  const draftId = checkpoint.draftId ?? (typeof payload.draftId === "string" ? payload.draftId : "");
  const attachmentIds = Array.isArray(payload.attachmentIds)
    ? payload.attachmentIds.filter((attachmentId) => typeof attachmentId === "string")
    : [];

  try {
    const submitResponse = await fetchImpl("/api/rma/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const submitBody = await assertResponse(submitResponse, "The RMA request could not be submitted.");
    const data = readData(submitBody);
    emitRmaUploadCheckpoint(onCheckpoint, null);
    return {
      data,
      draftId,
      attachmentIds,
      payload,
      checkpoint: null,
    };
  } catch (error) {
    throw attachRmaUploadError(error, {
      code: "RMA_SUBMIT_FAILED",
      message: "The RMA request could not be submitted.",
      checkpoint,
      draftId,
      attachmentIds,
      payload,
    });
  }
}

/**
 * @param {unknown} error
 * @param {{code:string,message:string,checkpoint?:RmaUploadCheckpoint,draftId?:string,attachmentIds?:string[],payload?:RmaSubmitPayload}} details
 */
function attachRmaUploadError(error, details) {
  const result = error instanceof RmaUploadClientError
    ? error
    : new RmaUploadClientError(details.code, details.message, error);
  if (details.draftId) {
    result.draftId = details.draftId;
  }
  if (details.attachmentIds) {
    result.attachmentIds = [...details.attachmentIds];
  }
  if (details.payload) {
    result.payload = details.payload;
  }
  if (details.checkpoint) {
    result.checkpoint = cloneRmaUploadCheckpoint(details.checkpoint);
  }
  return result;
}

/**
 * @param {{draftId:string,file:Blob & RmaImageFileLike,index:number,total:number,fetchImpl:RmaFetch,onProgress?: (progress:RmaUploadProgress)=>void,prepareImage:typeof prepareRmaImage}} input
 */
async function uploadOneRmaImage({ draftId, file, index, total, fetchImpl, onProgress, prepareImage }) {
  onProgress?.({ index, total, status: "preparing", name: file.name || "image" });
  const prepared = await prepareImage(file);
  const preparedType = inferRmaImageContentType(prepared.type, prepared.name);
  if (!preparedType || !isRmaImageSizeAllowed(Number(prepared.size))) {
    throw new RmaUploadClientError("IMAGE_TOO_LARGE", "The prepared image is not within the 4 MB upload limit.");
  }

  let attachmentId = null;

  try {
    const ticketResponse = await fetchImpl(`/api/rma/drafts/${draftId}/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        originalName: prepared.name || file.name || "rma-photo.jpg",
        contentType: preparedType,
        sizeBytes: prepared.size,
      }),
    });
    const ticketBody = await readResponseBody(ticketResponse);
    if (!ticketResponse.ok) {
      if (isRecord(ticketBody) && isRecord(ticketBody.data) && typeof ticketBody.data.attachmentId === "string") {
        attachmentId = ticketBody.data.attachmentId;
      }
      throw new RmaUploadClientError(`HTTP_${ticketResponse.status}`, "The image upload ticket could not be created.");
    }

    const ticket = readData(ticketBody);
    attachmentId = readRequiredString(ticket.attachmentId);
    const uploadUrl = readRequiredString(ticket.uploadUrl);

    onProgress?.({ index, total, status: "uploading", name: file.name || "image" });
    const formData = new FormData();
    formData.append("cacheControl", "3600");
    formData.append("", /** @type {Blob} */ (prepared), prepared.name || file.name || "rma-photo.jpg");
    const uploadResponse = await fetchImpl(uploadUrl, {
      method: "PUT",
      headers: { "x-upsert": "false" },
      body: formData,
    });
    if (!uploadResponse.ok) {
      throw new RmaUploadClientError(`HTTP_${uploadResponse.status}`, "The image could not be uploaded.");
    }

    onProgress?.({ index, total, status: "verifying", name: file.name || "image" });
    const sha256 = await sha256Hex(prepared);
    const completeResponse = await fetchImpl(
      `/api/rma/drafts/${draftId}/attachments/${attachmentId}/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sha256 }),
      }
    );
    await assertResponse(completeResponse, "The image upload could not be verified.");
    return attachmentId;
  } catch (error) {
    const cancellationConfirmed = await cancelFailedRmaTicket(fetchImpl, draftId, attachmentId);
    const result = error instanceof RmaUploadClientError
      ? error
      : new RmaUploadClientError("RMA_IMAGE_UPLOAD_FAILED", "The image upload failed.", error);
    if (attachmentId) {
      result.attachmentId = attachmentId;
      result.cancellationConfirmed = cancellationConfirmed;
    }
    throw result;
  }
}

/**
 * @param {RmaFetch} fetchImpl
 * @param {string} draftId
 * @param {string|null} attachmentId
 */
async function cancelFailedRmaTicket(fetchImpl, draftId, attachmentId) {
  if (!attachmentId) {
    return true;
  }

  try {
    const response = await fetchImpl(`/api/rma/drafts/${draftId}/attachments/${attachmentId}/complete`, {
      method: "DELETE",
    });
    return response.ok;
  } catch {
    // Cancellation is best-effort. The original upload/verification error is
    // more actionable and the server-side GC remains the final backstop.
    return false;
  }
}
