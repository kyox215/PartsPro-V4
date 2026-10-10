import { z } from "zod";

export const MAX_FINANCE_AMOUNT = 1_000_000_000;

// Never coerce JSON null, blank text or booleans into a booked zero.
export const financeMoneySchema = z.number().finite().nonnegative().max(MAX_FINANCE_AMOUNT)
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(String(value)), {
    message: "MONEY_MAX_TWO_DECIMALS",
  });

export function parseFinanceMoney(value) {
  if (typeof value !== "string") return { ok: false, error: "MONEY_REQUIRED" };
  const text = value.trim();
  if (!text) return { ok: false, error: "MONEY_REQUIRED" };
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return { ok: false, error: "MONEY_INVALID" };
  const amount = Number(text.replace(",", "."));
  if (!financeMoneySchema.safeParse(amount).success) return { ok: false, error: "MONEY_INVALID" };
  return { ok: true, value: amount, cents: Math.round(amount * 100) };
}

export function financeGross(amountNet, vatAmount) {
  return (Math.round(amountNet * 100) + Math.round(vatAmount * 100)) / 100;
}

export function localFinanceDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localFinanceDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${localFinanceDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isFinanceDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1000 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function financeLocalDateTimeToIso(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !isFinanceDate(value.slice(0, 10))) return null;
  const date = new Date(value);
  // Reject invalid hours and nonexistent local wall times during DST jumps.
  if (!Number.isFinite(date.getTime()) || localFinanceDateTime(date) !== value) return null;
  return date.toISOString();
}

export function financeEditableId(type, id) {
  if (!["expense", "supplier_payment"].includes(type) || typeof id !== "string") return null;
  const prefix = `${type}:`;
  const candidate = id.startsWith(prefix) ? id.slice(prefix.length) : "";
  return z.string().uuid().safeParse(candidate).success ? candidate : null;
}

export const financeDateSchema = z.string().trim().refine(isFinanceDate, { message: "DATE_INVALID" });
export const expenseCategories = ["rent", "salary", "shipping", "platform_fee", "utilities", "tax", "supplier_fee", "bank_fee", "other"];
const status = z.enum(["pending", "paid", "cancelled"]);
const nullableText = z.string().trim().max(500).nullable().optional();
export const financeExpenseCreateSchema = z.object({
  amountNet: financeMoneySchema,
  category: z.enum(expenseCategories),
  counterpartyName: nullableText,
  description: z.string().trim().min(1).max(240),
  evidenceUrl: z.string().trim().url().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  notes: nullableText,
  occurredAt: financeDateSchema.optional(),
  paidAt: z.string().trim().datetime().nullable().optional(),
  paymentMethod: nullableText,
  reference: nullableText,
  status: status.default("paid"),
  vatAmount: financeMoneySchema.default(0),
}).strict();

export const financeExpensePatchSchema = financeExpenseCreateSchema.omit({ vatAmount: true, status: true }).partial()
  .extend({ vatAmount: financeMoneySchema.optional(), status: status.optional(), correctionReason: z.string().trim().min(1).max(500), expectedUpdatedAt: z.string().trim().min(1).max(100) })
  .refine((value) => Object.keys(value).some((key) => !["correctionReason", "expectedUpdatedAt"].includes(key)), { message: "At least one change is required." });

const supplierPaymentBaseSchema = z.object({
  amountGross: financeMoneySchema.optional(),
  amountNet: financeMoneySchema,
  batchId: z.string().trim().uuid().nullable().optional(),
  dueAt: financeDateSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  note: nullableText,
  paidAt: z.string().trim().datetime().nullable().optional(),
  paymentMethod: nullableText,
  reference: nullableText,
  status: status.default("paid"),
  supplierId: z.string().trim().uuid().nullable().optional(),
  vatAmount: financeMoneySchema.default(0),
}).strict();

function checkGross(value, context) {
  if (value.amountGross !== undefined && value.amountNet !== undefined && value.vatAmount !== undefined && Math.round(value.amountGross * 100) !== Math.round(financeGross(value.amountNet, value.vatAmount) * 100)) {
    context.addIssue({ code: "custom", path: ["amountGross"], message: "GROSS_MUST_EQUAL_NET_PLUS_VAT" });
  }
}
export const supplierPaymentCreateSchema = supplierPaymentBaseSchema
  .refine((value) => value.batchId || value.supplierId, { path: ["batchId"], message: "batchId or supplierId is required." })
  .superRefine(checkGross);
export const supplierPaymentPatchSchema = supplierPaymentBaseSchema.omit({ vatAmount: true, status: true }).partial()
  .extend({ vatAmount: financeMoneySchema.optional(), status: status.optional(), correctionReason: z.string().trim().min(1).max(500), expectedUpdatedAt: z.string().trim().min(1).max(100) })
  .refine((value) => Object.keys(value).some((key) => !["correctionReason", "expectedUpdatedAt"].includes(key)), { message: "At least one change is required." })
  .superRefine(checkGross);
