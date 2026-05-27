import { type AdminProduct } from "@/lib/partspro-repository";
import { sanitizeSupplierText, toPublicSku } from "@/lib/partspro-sku";

export function toAdminProductDto(product: AdminProduct) {
  const catalogUrl = buildCatalogUrl(product);
  const storefrontVisible = product.catalogStatus === "active";
  const sku = toPublicSku(product.sku);

  return {
    id: product.id,
    sku,
    slug: product.slug,
    name: product.name,
    category: product.category,
    brand: product.brand,
    grade: product.grade,
    b2bPrice: product.b2bPrice,
    price: product.b2bPrice,
    retailPrice: product.retailPrice,
    costPrice: product.costPrice,
    margin: product.margin,
    stock: product.stockQty,
    stockQty: product.stockQty,
    availableQty: product.availableQty,
    lockedQty: product.lockedQty,
    actualQty: product.actualQty,
    stockStatus: product.stockStatus,
    catalogStatus: product.catalogStatus,
    visual: product.visual,
    warehouse: product.warehouse,
    moq: product.moq,
    vatMode: product.vatMode,
    vatRate: product.vatRate,
    rmaDays: product.rmaDays,
    warrantyDays: product.warrantyDays,
    leadTime: product.leadTime,
    weightGram: product.weightGram,
    model: product.model ?? null,
    modelSeries: product.modelSeries ?? null,
    modelCode: product.modelCode ?? null,
    modelCodes: product.modelCodes,
    batchCode: sanitizeNullableSupplierText(product.batchCode),
    supplier: sanitizeNullableSupplierText(product.supplier),
    compatibleWith: product.compatibleWith,
    tags: product.tags.map(sanitizeSupplierText).filter(Boolean),
    imagePath: product.imagePath ?? null,
    imageUrl: product.imageUrl ?? null,
    imageAlt: product.imageAlt ?? null,
    galleryImagePaths: product.galleryImagePaths,
    galleryImageUrls: product.galleryImageUrls ?? [],
    catalogUrl,
    storefrontUrl: storefrontVisible ? `/prodotto/${encodeURIComponent(sku)}` : null,
    storefrontVisible,
    updatedAt: product.updatedAt,
    createdAt: product.createdAt,
    storefront: {
      visible: storefrontVisible,
      source: "products",
    },
  };
}

function buildCatalogUrl(product: AdminProduct) {
  const params = new URLSearchParams();
  const model = product.compatibleWith[0];

  if (product.brand) {
    params.set("brand", product.brand);
  }

  if (model) {
    params.set("model", model);
  }

  const query = params.toString();

  return query ? `/catalogo?${query}` : "/catalogo";
}

function sanitizeNullableSupplierText(value: string | null | undefined) {
  return sanitizeSupplierText(value) || null;
}
