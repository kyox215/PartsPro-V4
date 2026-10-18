import { z } from "zod";
import { financeDateSchema } from "@/lib/admin-finance-input.mjs";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";

export const financeQuerySchema = z
  .object({
    type: z.enum(["sale","receivable","purchase","cogs","expense","supplier_payment"]).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    confidence: z.enum(["exact", "estimated", "unmatched"]).optional(),
    dateFrom: financeDateSchema.optional(),
    dateMode: z
      .enum(["created", "paid", "received", "invoice", "recognized", "occurred"])
      .default("created"),
    dateTo: financeDateSchema.optional(),
    ledgerView: z.enum(["margin", "purchases", "expenses"]).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).max(50000).default(0),
    q: z.string().trim().min(1).max(160).optional(),
    supplierKey: z.string().trim().min(1).max(200).optional(),
    supplier: z.string().trim().min(1).max(160).optional(),
  })
  .strict().refine(value => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, { message: "Start date must not exceed end date.", path: ["dateTo"] });

export { financeExpenseCreateSchema, financeExpensePatchSchema, supplierPaymentCreateSchema, supplierPaymentPatchSchema } from "@/lib/admin-finance-input.mjs";

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
