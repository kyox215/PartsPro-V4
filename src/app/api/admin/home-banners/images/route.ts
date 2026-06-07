import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { resolveProductImageUrl } from "@/lib/partspro-product-images";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

const bannerImagesBucket = "product-images";
const maxImageBytes = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("product.image_manage");

  if (!admin.ok) {
    return admin.response;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return apiError(400, "INVALID_FORM_DATA", "Image upload must use multipart form data.");
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return apiError(400, "INVALID_IMAGE_FILE", "A file field is required.");
  }

  if (file.size <= 0 || file.size > maxImageBytes) {
    return apiError(400, "INVALID_IMAGE_FILE", "Image file size is invalid.", {
      maxBytes: maxImageBytes,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const imageType = detectImageType(bytes, file.type);

  if (!imageType) {
    return apiError(415, "UNSUPPORTED_IMAGE_TYPE", "Image must be JPEG, PNG, or WebP.");
  }

  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const storagePath = `banners/${today}/${crypto.randomUUID()}.${imageType.extension}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(bannerImagesBucket)
    .upload(storagePath, bytes, {
      cacheControl: "31536000",
      contentType: imageType.contentType,
      upsert: false,
    });

  if (uploadError) {
    return apiError(409, "ADMIN_HOME_BANNER_IMAGE_UPLOAD_FAILED", "Image upload failed.", {
      message: uploadError.message,
    });
  }

  return NextResponse.json(
    {
      data: {
        imagePath: storagePath,
        imageUrl: resolveProductImageUrl(storagePath),
      },
      meta: {
        action: "home_banner_image_upload",
      },
    },
    { status: 201 }
  );
}

function detectImageType(bytes: Uint8Array, reportedType: string) {
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

  if (reportedType === "image/jpeg" || reportedType === "image/png" || reportedType === "image/webp") {
    return null;
  }

  return null;
}
