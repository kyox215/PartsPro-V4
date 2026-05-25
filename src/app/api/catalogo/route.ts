import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readQueryParams,
} from "@/lib/partspro-api";
import { listCatalogProducts } from "@/lib/partspro-repository";
import { type PartProduct } from "@/lib/partspro-data";

const catalogQuerySchema = z
  .object({
    brand: z.string().trim().min(1).max(40).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    q: z.string().trim().min(2).max(80).optional(),
    model: z.string().trim().min(2).max(80).optional(),
    warehouse: z.enum(["Milano", "Roma", "Shenzhen"]).optional(),
    status: z.enum(["In Stock", "Low Stock", "Out of Stock"]).optional(),
    grade: z.enum(["A+", "A", "B", "Refurbished"]).optional(),
    minStock: z.coerce.number().int().min(0).max(10000).optional(),
    sort: z.enum(["name", "stock_desc", "updated_desc"]).default("name"),
    limit: z.coerce.number().int().min(1).max(50).default(24),
    offset: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .strict();

const allowedQueryKeys = new Set(Object.keys(catalogQuerySchema.shape));

type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export async function GET(request: NextRequest) {
  try {
    const parsedParams = readQueryParams(request.nextUrl.searchParams, allowedQueryKeys);

    if (!parsedParams.ok) {
      return apiError(400, "INVALID_QUERY", "Catalog query parameters are invalid.", parsedParams.details);
    }

    const result = catalogQuerySchema.safeParse(parsedParams.data);

    if (!result.success) {
      return apiError(400, "INVALID_QUERY", "Catalog query parameters are invalid.", {
        issues: formatZodIssues(result.error),
      });
    }

    const repositoryResult = await listCatalogProducts();
    const filtered = filterProducts(repositoryResult.data, result.data);
    const sorted = sortProducts(filtered, result.data.sort);
    const page = sorted.slice(result.data.offset, result.data.offset + result.data.limit);

    return NextResponse.json({
      data: page.map(toCatalogProduct),
      meta: {
        source: repositoryResult.source,
        total: filtered.length,
        limit: result.data.limit,
        offset: result.data.offset,
        returned: page.length,
        currency: "EUR",
        priceVisibility: "hidden_until_approved_b2b_login",
        vatMode: "net_prices_plus_iva",
      },
    });
  } catch {
    return apiError(500, "CATALOG_UNAVAILABLE", "Catalog data is temporarily unavailable.");
  }
}

function filterProducts(items: PartProduct[], query: CatalogQuery) {
  const normalizedSearch = query.q?.toLowerCase();
  const normalizedModel = query.model?.toLowerCase();

  return items.filter((product) => {
    const matchesBrand = query.brand ? product.brand === query.brand : true;
    const matchesCategory = query.category ? product.category === query.category : true;
    const matchesWarehouse = query.warehouse ? product.warehouse === query.warehouse : true;
    const matchesStatus = query.status ? product.status === query.status : true;
    const matchesGrade = query.grade ? product.grade === query.grade : true;
    const matchesMinStock = query.minStock === undefined ? true : product.stock >= query.minStock;
    const matchesModel = normalizedModel
      ? product.compatibleWith.some((model) => model.toLowerCase().includes(normalizedModel))
      : true;
    const matchesSearch = normalizedSearch
      ? [product.name, product.sku, product.brand, product.category, product.grade, ...product.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      : true;

    return (
      matchesBrand &&
      matchesCategory &&
      matchesWarehouse &&
      matchesStatus &&
      matchesGrade &&
      matchesMinStock &&
      matchesModel &&
      matchesSearch
    );
  });
}

function sortProducts(items: PartProduct[], sort: CatalogQuery["sort"]) {
  return [...items].sort((a, b) => {
    switch (sort) {
      case "stock_desc":
        return b.stock - a.stock;
      case "updated_desc":
        return b.updatedAt.localeCompare(a.updatedAt);
      case "name":
      default:
        return a.name.localeCompare(b.name, "it");
    }
  });
}

function toCatalogProduct(product: PartProduct) {
  return {
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    category: product.category,
    brand: product.brand,
    grade: product.grade,
    stock: product.stock,
    status: product.status,
    warehouse: product.warehouse,
    moq: product.moq,
    rmaDays: product.rmaDays,
    leadTime: product.leadTime,
    updatedAt: product.updatedAt,
    compatibleWith: product.compatibleWith,
    tags: product.tags,
    priceGate: {
      visible: false,
      reason: "approved_b2b_login_required",
      vatMode: "net_prices_plus_iva",
    },
  };
}
