import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";

export const financeQuerySchema = z
  .object({
    category: z.string().trim().min(1).max(80).optional(),
    confidence: z.enum(["exact", "estimated", "unmatched"]).optional(),
    dateFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateMode: z
      .enum(["created", "paid", "received", "invoice", "recognized", "occurred"])
      .default("created"),
    dateTo: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    q: z.string().trim().min(1).max(160).optional(),
    supplier: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const expenseCategorySchema = z.enum([
  "rent",
  "salary",
  "shipping",
  "platform_fee",
  "utilities",
  "tax",
  "supplier_fee",
  "bank_fee",
  "other",
]);

const financeStatusSchema = z.enum(["pending", "paid", "cancelled"]);
const nullableTextSchema = z.string().trim().max(500).nullable().optional();

export const financeExpenseCreateSchema = z
  .object({
    amountNet: z.coerce.number().nonnegative(),
    category: expenseCategorySchema,
    counterpartyName: nullableTextSchema,
    description: z.string().trim().min(1).max(240),
    evidenceUrl: z.string().trim().url().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    notes: nullableTextSchema,
    occurredAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    paidAt: z.string().trim().datetime().nullable().optional(),
    paymentMethod: nullableTextSchema,
    reference: nullableTextSchema,
    status: financeStatusSchema.default("paid"),
    vatAmount: z.coerce.number().nonnegative().default(0),
  })
  .strict();

export const financeExpensePatchSchema = financeExpenseCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

const supplierPaymentBaseSchema = z
  .object({
    amountGross: z.coerce.number().nonnegative().optional(),
    amountNet: z.coerce.number().nonnegative(),
    batchId: z.string().trim().uuid().nullable().optional(),
    dueAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    note: nullableTextSchema,
    paidAt: z.string().trim().datetime().nullable().optional(),
    paymentMethod: nullableTextSchema,
    reference: nullableTextSchema,
    status: financeStatusSchema.default("paid"),
    supplierId: z.string().trim().uuid().nullable().optional(),
    vatAmount: z.coerce.number().nonnegative().default(0),
  })
  .strict();

export const supplierPaymentCreateSchema = supplierPaymentBaseSchema
  .refine((value) => value.batchId || value.supplierId, {
    message: "batchId or supplierId is required.",
  });

export const supplierPaymentPatchSchema = supplierPaymentBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const idParamSchema = z.object({ id: z.string().trim().uuid() }).strict();

export async function parseAdminJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: ReturnType<typeof apiError> }
> {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return {
      ok: false,
      response: apiError(400, "INVALID_BODY", "Request body must be valid JSON."),
    };
  }

  const parsed = schema.safeParse(body.data);

  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(400, "INVALID_BODY", "Request body is invalid.", {
        issues: formatZodIssues(parsed.error),
      }),
    };
  }

  return { ok: true, data: parsed.data };
}
