import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  createAdminProduct,
  hideAdminProduct,
  listAdminProducts,
  updateAdminProduct,
  type AdminProductQueryInput,
} from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";
import { toAdminProductDto } from "./_dto";
import { missingProductPatchPermissions } from "./_permissions";
import {
  productPatchSchema,
  productQuerySchema,
  productWriteSchema,
  type ProductQueryPayload,
} from "./_schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, productQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  const resolvedQuery = resolveProductQuery(query.data);

  if (!resolvedQuery.ok) {
    return resolvedQuery.response;
  }

  try {
    const result = await listAdminProducts(resolvedQuery.data);

    return NextResponse.json({
      data: result.data.products.map(toAdminProductDto),
      meta: {
        source: result.source,
        summary: result.data.summary,
        total: result.data.total,
        limit: resolvedQuery.data.limit,
        offset: resolvedQuery.data.offset,
        returned: result.data.products.length,
        storefrontLinkage: "products -> catalog_public_summary/catalog_buyer_prices",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCTS_UNAVAILABLE",
      "Admin product data is temporarily unavailable."
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("product.create_draft");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const payload = readProductPayload(body.data);
  const parsed = productWriteSchema.safeParse(payload);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "Product payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await createAdminProduct({
      ...parsed.data,
      catalogStatus: "draft",
    });

    return NextResponse.json(
      {
        data: toAdminProductDto(result.data),
        meta: {
          source: result.source,
          storefrontVisible: false,
          storefrontLinkage: "products -> catalog_public_summary/catalog_buyer_prices",
          workflow: "draft_created_requires_publish_action",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_CREATE_FAILED",
      "Product could not be created at this time."
    );
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const sku = readSkuPayload(body.data);

  if (!sku) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "Product SKU is required.");
  }

  const payload = readProductPayload(body.data);
  const parsed = productPatchSchema.safeParse(payload);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "Product payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  if (!hasWritableProductPatch(parsed.data)) {
    return apiError(400, "ADMIN_PRODUCT_PATCH_EMPTY", "Product update payload is empty.");
  }

  const missingPermissions = missingProductPatchPermissions(admin.authState, parsed.data);

  if (missingPermissions.length > 0) {
    return apiError(403, "ADMIN_PRODUCT_PERMISSION_DENIED", "Missing product edit permission.", {
      missing: missingPermissions,
      role: admin.authState.role,
    });
  }

  try {
    const result = await updateAdminProduct(sku, parsed.data);

    return NextResponse.json({
      data: toAdminProductDto(result.data),
      meta: {
        source: result.source,
        storefrontVisible: result.data.catalogStatus === "active",
        storefrontLinkage: "products -> catalog_public_summary/catalog_buyer_prices",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_UPDATE_FAILED",
      "Product could not be updated at this time."
    );
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminApi("product.hide");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const skus = readSkusPayload(body.data);

  if (skus.length === 0) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "At least one SKU is required.");
  }

  try {
    const products = [];

    for (const sku of skus) {
      const result = await hideAdminProduct(sku, "Hidden through bulk admin products API.");
      products.push(toAdminProductDto(result.data));
    }

    return NextResponse.json({
      data: products,
      meta: {
        source: "supabase",
        deleted: false,
        action: "hidden",
        count: products.length,
        storefrontVisible: false,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_DELETE_FAILED",
      "Products could not be hidden at this time."
    );
  }
}

function resolveProductQuery(
  query: ProductQueryPayload
):
  | { ok: true; data: AdminProductQueryInput }
  | { ok: false; response: ReturnType<typeof apiError> } {
  if (query.status && query.catalogStatus && query.status !== query.catalogStatus) {
    return {
      ok: false,
      response: apiError(400, "INVALID_QUERY", "Product status filters conflict.", {
        status: query.status,
        catalogStatus: query.catalogStatus,
      }),
    };
  }

  const { status, ...rest } = query;

  return {
    ok: true,
    data: {
      ...rest,
      catalogStatus: query.catalogStatus ?? status,
    },
  };
}

function hasWritableProductPatch(payload: Record<string, unknown>) {
  return Object.keys(payload).some((key) => key !== "reason");
}

function readProductPayload(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.product)) {
    return payload.product;
  }

  return payload;
}

function readSkuPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  const directSku = readString(payload.sku);

  if (directSku) {
    return directSku;
  }

  return isRecord(payload.product) ? readString(payload.product.sku) : null;
}

function readSkusPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.skus)) {
    return payload.skus.map(readString).filter((sku): sku is string => Boolean(sku));
  }

  const sku = readString(payload.sku);
  return sku ? [sku] : [];
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
