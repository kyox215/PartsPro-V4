import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  deleteAdminHomeBanner,
  updateAdminHomeBanner,
} from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

type HomeBannerParams = { params: Promise<{ id: string }> };

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .optional();

const optionalNullableDate = z
  .union([z.string().trim().max(40), z.null()])
  .optional()
  .transform((value) =>
    typeof value === "string" && value.length > 0 ? value : value ?? undefined
  );

const bannerTargetSchema = z
  .object({
    brand: optionalTrimmedString(80),
    category: optionalTrimmedString(80),
    minStock: z.coerce.number().int().min(0).max(10000).optional(),
    model: optionalTrimmedString(120),
    modelSeries: optionalTrimmedString(120),
    q: optionalTrimmedString(80),
    sort: z.enum(["name", "stock_desc", "updated_desc"]).optional(),
  })
  .strict();

const bannerPatchSchema = z
  .object({
    endsAt: optionalNullableDate,
    imageAlt: optionalTrimmedString(160),
    imagePath: optionalTrimmedString(300),
    isActive: z.boolean().optional(),
    position: z.coerce.number().int().min(0).max(99).optional(),
    startsAt: optionalNullableDate,
    target: bannerTargetSchema.optional(),
    title: optionalTrimmedString(120),
  })
  .strict();

const idSchema = z.string().trim().uuid();

export async function PATCH(request: NextRequest, { params }: HomeBannerParams) {
  const admin = await requireAdminApi("product.image_manage");

  if (!admin.ok) {
    return admin.response;
  }

  const idResult = idSchema.safeParse((await params).id);

  if (!idResult.success) {
    return apiError(400, "INVALID_HOME_BANNER_ID", "Homepage banner id is invalid.");
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = bannerPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_HOME_BANNER", "Homepage banner payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await updateAdminHomeBanner(idResult.data, parsed.data);

    return NextResponse.json({
      data: result.data,
      meta: {
        action: "home_banner_update",
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_HOME_BANNER_UPDATE_FAILED",
      "Homepage banner could not be updated."
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: HomeBannerParams) {
  const admin = await requireAdminApi("product.image_manage");

  if (!admin.ok) {
    return admin.response;
  }

  const idResult = idSchema.safeParse((await params).id);

  if (!idResult.success) {
    return apiError(400, "INVALID_HOME_BANNER_ID", "Homepage banner id is invalid.");
  }

  try {
    const result = await deleteAdminHomeBanner(idResult.data);

    return NextResponse.json({
      data: result.data,
      meta: {
        action: "home_banner_delete",
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_HOME_BANNER_DELETE_FAILED",
      "Homepage banner could not be deleted."
    );
  }
}
