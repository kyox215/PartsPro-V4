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
 * @typedef {Object} RmaImageFileLike
 * @property {string=} name
 * @property {string=} type
 * @property {number=} size
 * @property {number=} lastModified
 */

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
 * Create a draft, upload/verify every image and finally submit opaque IDs.
 * Each image retries its complete ticket flow once; every failed ticket is
 * cancelled best-effort before the original error is rethrown.
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
  fetchImpl = globalThis.fetch.bind(globalThis),
  onProgress,
  prepareImage = prepareRmaImage,
}) {
  if (!Array.isArray(files) || files.length < 1 || files.length > rmaMaxAttachments) {
    throw new RmaUploadClientError("INVALID_IMAGE_COUNT", `Choose between 1 and ${rmaMaxAttachments} images.`);
  }

  for (const file of files) {
    if (!isRmaImageFile(file)) {
      throw new RmaUploadClientError("UNSUPPORTED_IMAGE", "Only JPEG, PNG, WebP, HEIC or HEIF images are supported.");
    }
  }

  const draftResponse = await fetchImpl("/api/rma/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderLineId, idempotencyKey: draftIdempotencyKey }),
  });
  const draftBody = await assertResponse(draftResponse, "The RMA draft could not be created.");
  const draft = readData(draftBody);
  const draftId = readRequiredString(draft.id);
  /** @type {string[]} */
  const attachmentIds = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let lastError;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        onProgress?.({ index, total: files.length, status: "retrying", name: file.name || "image" });
      }

      try {
        const attachmentId = await uploadOneRmaImage({
          draftId,
          file,
          index,
          total: files.length,
          fetchImpl,
          onProgress,
          prepareImage,
        });
        attachmentIds.push(attachmentId);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      if (lastError instanceof RmaUploadClientError) {
        lastError.draftId = draftId;
        lastError.attachmentIds = [...attachmentIds];
      }
      throw lastError;
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
  let submitBody;
  try {
    const submitResponse = await fetchImpl("/api/rma/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    submitBody = await assertResponse(submitResponse, "The RMA request could not be submitted.");
  } catch (error) {
    if (error instanceof RmaUploadClientError) {
      error.draftId = draftId;
      error.attachmentIds = [...attachmentIds];
      error.payload = payload;
    }
    throw error;
  }

  return {
    data: readData(submitBody),
    draftId,
    attachmentIds,
    payload,
  };
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
  let originalError;

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
    originalError = error;
    await cancelFailedRmaTicket(fetchImpl, draftId, attachmentId);
  }

  throw originalError instanceof RmaUploadClientError
    ? originalError
    : new RmaUploadClientError("RMA_IMAGE_UPLOAD_FAILED", "The image upload failed.", originalError);
}

/**
 * @param {RmaFetch} fetchImpl
 * @param {string} draftId
 * @param {string|null} attachmentId
 */
async function cancelFailedRmaTicket(fetchImpl, draftId, attachmentId) {
  if (!attachmentId) {
    return;
  }

  try {
    await fetchImpl(`/api/rma/drafts/${draftId}/attachments/${attachmentId}/complete`, {
      method: "DELETE",
    });
  } catch {
    // Cancellation is best-effort. The original upload/verification error is
    // more actionable and the server-side GC remains the final backstop.
  }
}
