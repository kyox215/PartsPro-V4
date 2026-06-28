import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  rmaEvidenceBucket,
  rmaEvidenceSignedUrlTtlSeconds,
} from "@/lib/partspro-rma-evidence";
import {
  createServiceRoleClient,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const maxEvidenceBytes = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated || !account.userId) {
    return apiError(401, "LOGIN_REQUIRED", "Login is required to upload RMA evidence.");
  }

  if (account.accountType !== "customer" && account.accountType !== "employee") {
    return apiError(403, "RMA_ACCOUNT_NOT_ALLOWED", "Only customer accounts can upload RMA evidence.");
  }

  if (!isSupabaseServiceRoleConfigured()) {
    return apiError(503, "RMA_EVIDENCE_STORAGE_UNAVAILABLE", "RMA evidence storage is not configured.");
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return apiError(400, "INVALID_FORM_DATA", "Evidence upload must use multipart form data.");
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return apiError(400, "INVALID_RMA_EVIDENCE_FILE", "A file field is required.");
  }

  if (file.size <= 0 || file.size > maxEvidenceBytes) {
    return apiError(400, "INVALID_RMA_EVIDENCE_FILE", "Evidence file size is invalid.", {
      maxBytes: maxEvidenceBytes,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const evidenceType = detectRmaEvidenceType(bytes, file.type, file.name);

  if (!evidenceType) {
    return apiError(
      415,
      "UNSUPPORTED_RMA_EVIDENCE_TYPE",
      "Evidence must be JPEG, PNG, WebP, HEIC, HEIF, MP4, or MOV."
    );
  }

  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const storagePath = `rma/${account.userId}/${today}/${crypto.randomUUID()}.${evidenceType.extension}`;
  const supabase = createServiceRoleClient();
  const { error: uploadError } = await supabase.storage
    .from(rmaEvidenceBucket)
    .upload(storagePath, bytes, {
      cacheControl: "3600",
      contentType: evidenceType.contentType,
      upsert: false,
    });

  if (uploadError) {
    return apiError(409, "RMA_EVIDENCE_UPLOAD_FAILED", "Evidence upload failed.", {
      message: uploadError.message,
    });
  }

  const { data: signed } = await supabase.storage
    .from(rmaEvidenceBucket)
    .createSignedUrl(storagePath, rmaEvidenceSignedUrlTtlSeconds);

  return NextResponse.json(
    {
      data: {
        bucket: rmaEvidenceBucket,
        contentType: evidenceType.contentType,
        name: sanitizeFileName(file.name),
        path: storagePath,
        signedUrl: signed?.signedUrl,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      },
      meta: {
        maxBytes: maxEvidenceBytes,
      },
    },
    { status: 201 }
  );
}

function detectRmaEvidenceType(
  bytes: Uint8Array,
  reportedType: string,
  fileName: string
) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  const isoBrand = readIsoBrand(bytes);

  if (isoBrand) {
    if (["heic", "heix", "hevc", "hevx"].includes(isoBrand)) {
      return { contentType: "image/heic", extension: "heic" };
    }

    if (["mif1", "msf1"].includes(isoBrand)) {
      return { contentType: "image/heif", extension: "heif" };
    }

    if (isoBrand === "qt  ") {
      return { contentType: "video/quicktime", extension: "mov" };
    }

    if (
      reportedType === "video/mp4" ||
      isoBrand.startsWith("mp4") ||
      isoBrand === "isom" ||
      isoBrand === "iso2"
    ) {
      return { contentType: "video/mp4", extension: "mp4" };
    }
  }

  const lowerName = fileName.toLowerCase();

  if (
    (reportedType === "image/heic" || lowerName.endsWith(".heic")) &&
    isoBrand
  ) {
    return { contentType: "image/heic", extension: "heic" };
  }

  if (
    (reportedType === "image/heif" || lowerName.endsWith(".heif")) &&
    isoBrand
  ) {
    return { contentType: "image/heif", extension: "heif" };
  }

  return null;
}

function readIsoBrand(bytes: Uint8Array) {
  if (
    bytes.length < 12 ||
    bytes[4] !== 0x66 ||
    bytes[5] !== 0x74 ||
    bytes[6] !== 0x79 ||
    bytes[7] !== 0x70
  ) {
    return null;
  }

  return String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ");

  return cleaned || "rma-evidence";
}
