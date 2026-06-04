import { z } from "zod";

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const stringArray = z.array(z.string().trim().min(1).max(120)).max(100);
const catalogStatusSchema = z.enum(["active", "draft", "hidden", "blocked"]);
const stockStatusSchema = z.enum(["In Stock", "Low Stock", "Out of Stock"]);
const warehouseSchema = z.literal("Milano");

export const productQuerySchema = z
  .object({
    brand: z.string().trim().min(1).max(80).optional(),
    batchCode: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    model: z.string().trim().min(2).max(120).optional(),
    modelSeries: z.string().trim().min(1).max(120).optional(),
    q: z.string().trim().min(2).max(80).optional(),
    stockStatus: stockStatusSchema.optional(),
    status: catalogStatusSchema.optional(),
    catalogStatus: catalogStatusSchema.optional(),
    grade: z.enum(["A+", "A", "B", "Refurbished"]).optional(),
    supplier: z.string().trim().min(1).max(120).optional(),
    sort: z.enum(["name", "stock_desc", "updated_desc", "created_desc"]).default("updated_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
  })
  .strict();

export const productWriteSchema = z
  .object({
    sku: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_+.-]+$/).optional(),
    name: z.string().trim().min(2).max(180),
    category: z.string().trim().min(2).max(80),
    brand: z.string().trim().min(1).max(80),
    grade: z.enum(["A+", "A", "B", "Refurbished"]),
    price: z.coerce.number().min(0).max(100000),
    retailPrice: z.coerce.number().min(0).max(100000).optional(),
    costPrice: z.coerce.number().min(0).max(100000).optional(),
    stock: z.coerce.number().int().min(0).max(100000),
    moq: z.coerce.number().int().min(1).max(10000),
    warehouse: warehouseSchema,
    compatibleWith: stringArray.optional(),
    tags: stringArray.optional(),
    catalogStatus: catalogStatusSchema.default("draft"),
    stockStatus: stockStatusSchema.optional(),
    vatMode: optionalTrimmedString(40),
    rmaDays: z.coerce.number().int().min(0).max(3650).optional(),
    weightGram: z.coerce.number().int().min(0).max(100000).optional(),
    model: optionalTrimmedString(120),
    modelCode: optionalTrimmedString(120),
    modelCodes: stringArray.optional(),
    batchCode: optionalTrimmedString(80),
    supplier: optionalTrimmedString(120),
    imagePath: optionalTrimmedString(300),
    imageAlt: optionalTrimmedString(160),
    galleryImagePaths: stringArray.optional(),
  })
  .strict();

export const productPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(180).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    brand: z.string().trim().min(1).max(80).optional(),
    grade: z.enum(["A+", "A", "B", "Refurbished"]).optional(),
    price: z.coerce.number().min(0).max(100000).optional(),
    retailPrice: z.coerce.number().min(0).max(100000).optional(),
    costPrice: z.coerce.number().min(0).max(100000).optional(),
    moq: z.coerce.number().int().min(1).max(10000).optional(),
    compatibleWith: stringArray.optional(),
    tags: stringArray.optional(),
    vatMode: optionalTrimmedString(40),
    rmaDays: z.coerce.number().int().min(0).max(3650).optional(),
    weightGram: z.coerce.number().int().min(0).max(100000).optional(),
    model: optionalTrimmedString(120),
    modelCode: optionalTrimmedString(120),
    modelCodes: stringArray.optional(),
    batchCode: optionalTrimmedString(80),
    supplier: optionalTrimmedString(120),
    imagePath: optionalTrimmedString(300),
    imageAlt: optionalTrimmedString(160),
    galleryImagePaths: stringArray.optional(),
    reason: optionalTrimmedString(500),
  })
  .strict();

export const productActionSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const productStockAdjustmentSchema = z
  .object({
    action: z.enum(["receive", "cycle_count", "release", "scrap", "rma_return"]),
    quantity: z.coerce.number().int().min(0).max(100000),
    reason: z.string().trim().min(1).max(500),
    batchCode: optionalTrimmedString(80),
    supplier: optionalTrimmedString(120),
  })
  .strict();

export const productImagesSchema = z
  .object({
    imagePath: optionalTrimmedString(300),
    imageAlt: optionalTrimmedString(160),
    galleryImagePaths: stringArray.default([]),
    reason: optionalTrimmedString(500),
  })
  .strict();

export type ProductWritePayload = z.infer<typeof productWriteSchema>;
export type ProductQueryPayload = z.infer<typeof productQuerySchema>;
export type ProductPatchPayload = z.infer<typeof productPatchSchema>;
export type ProductStockAdjustmentPayload = z.infer<
  typeof productStockAdjustmentSchema
>;
export type ProductImagesPayload = z.infer<typeof productImagesSchema>;
