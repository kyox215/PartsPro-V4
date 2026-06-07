import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  createAdminHomeBanner,
  listAdminHomeBanners,
} from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

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

const bannerCreateSchema = z
  .object({
    endsAt: optionalNullableDate,
    imageAlt: z.string().trim().min(1).max(160),
    imagePath: z.string().trim().min(1).max(300),
    isActive: z.boolean().default(true),
    position: z.coerce.number().int().min(0).max(99).default(0),
    startsAt: optionalNullableDate,
    target: bannerTargetSchema.default({}),
    title: z.string().trim().min(1).max(120),
  })
  .strict();

export async function GET() {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const result = await listAdminHomeBanners();

    return NextResponse.json({
      data: result.data,
      meta: {
        maxActive: 8,
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_HOME_BANNERS_READ_FAILED",
      "Homepage banners could not be read."
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("product.image_manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = bannerCreateSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_HOME_BANNER", "Homepage banner payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await createAdminHomeBanner(parsed.data);

    return NextResponse.json(
      {
        data: result.data,
        meta: {
          action: "home_banner_create",
          source: result.source,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_HOME_BANNER_CREATE_FAILED",
      "Homepage banner could not be created."
    );
  }
}
