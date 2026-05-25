import { z } from "zod";

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const stringArray = z.array(z.string().trim().min(1).max(120)).max(100);

export const productQuerySchema = z
  .object({
    brand: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    q: z.string().trim().min(2).max(80).optional(),
    warehouse: z.enum(["Milano", "Roma", "Shenzhen"]).optional(),
    stockStatus: z.enum(["In Stock", "Low Stock", "Out of Stock"]).optional(),
    catalogStatus: z.enum(["active", "draft", "hidden", "blocked"]).optional(),
    grade: z.enum(["A+", "A", "B", "Refurbished"]).optional(),
    sort: z.enum(["name", "stock_desc", "updated_desc", "created_desc"]).default("updated_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
  })
  .strict();

export const productWriteSchema = z
  .object({
    sku: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
    name: z.string().trim().min(2).max(180),
    category: z.string().trim().min(2).max(80),
    brand: z.string().trim().min(1).max(80),
    grade: z.enum(["A+", "A", "B", "Refurbished"]),
    price: z.coerce.number().min(0).max(100000),
    retailPrice: z.coerce.number().min(0).max(100000).optional(),
    costPrice: z.coerce.number().min(0).max(100000).optional(),
    stock: z.coerce.number().int().min(0).max(100000),
    moq: z.coerce.number().int().min(1).max(10000),
    warehouse: z.enum(["Milano", "Roma", "Shenzhen"]),
    compatibleWith: stringArray.optional(),
    tags: stringArray.optional(),
    catalogStatus: z.enum(["active", "draft", "hidden", "blocked"]).default("active"),
    stockStatus: z.enum(["In Stock", "Low Stock", "Out of Stock"]).optional(),
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
  .passthrough();

export const productPatchSchema = productWriteSchema.partial().passthrough();

export type ProductWritePayload = z.infer<typeof productWriteSchema>;
export type ProductPatchPayload = z.infer<typeof productPatchSchema>;
