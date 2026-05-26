import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  getAdminProduct,
  setAdminProductImages,
} from "@/lib/partspro-repository";
import { createClient } from "@/lib/supabase/server";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { toAdminProductDto } from "../../_dto";
import { productImagesSchema } from "../../_schemas";

export const dynamic = "force-dynamic";

const productImagesBucket = "product-images";
const maxImageBytes = 10 * 1024 * 1024;

type ProductParams = { params: Promise<{ sku: string }> };

export async function PATCH(request: NextRequest, { params }: ProductParams) {
  const admin = await requireAdminApi("product.image_manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = productImagesSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_IMAGES", "Product image payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { sku } = await params;

  try {
    const result = await setAdminProductImages({
      ...parsed.data,
      sku: decodeURIComponent(sku),
    });

    return NextResponse.json({
      data: toAdminProductDto(result.data),
      meta: { action: "images_update", source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_IMAGES_UPDATE_FAILED",
      "Product images could not be updated."
    );
  }
}

export async function POST(request: NextRequest, { params }: ProductParams) {
  const admin = await requireAdminApi("product.image_manage");

  if (!admin.ok) {
    return admin.response;
  }

  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);

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

  const normalizedSku = decodedSku.trim().toUpperCase();
  const storagePath = `products/${normalizedSku.toLowerCase()}/${crypto.randomUUID()}.${imageType.extension}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(productImagesBucket)
    .upload(storagePath, bytes, {
      cacheControl: "31536000",
      contentType: imageType.contentType,
      upsert: false,
    });

  if (uploadError) {
    return apiError(409, "ADMIN_PRODUCT_IMAGE_UPLOAD_FAILED", "Image upload failed.", {
      message: uploadError.message,
    });
  }

  try {
    const current = await getAdminProduct(normalizedSku);

    if (!current.data) {
      return apiError(404, "ADMIN_PRODUCT_NOT_FOUND", "Product was not found.", {
        sku: normalizedSku,
      });
    }

    const setPrimary = formData.get("setPrimary") !== "false";
    const gallery = mergeGallery(current.data.galleryImagePaths, storagePath);
    const result = await setAdminProductImages({
      galleryImagePaths: gallery,
      imageAlt: readFormString(formData.get("imageAlt")) ?? current.data.imageAlt ?? current.data.name,
      imagePath: setPrimary ? storagePath : current.data.imagePath,
      reason: readFormString(formData.get("reason")) ?? "Uploaded product image from admin API.",
      sku: normalizedSku,
    });

    return NextResponse.json(
      {
        data: toAdminProductDto(result.data),
        meta: {
          action: "image_upload",
          imagePath: storagePath,
          source: result.source,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_IMAGE_ATTACH_FAILED",
      "Image uploaded but could not be attached to the product."
    );
  }
}

function mergeGallery(paths: string[], nextPath: string) {
  return Array.from(new Set([nextPath, ...paths])).slice(0, 100);
}

function readFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
