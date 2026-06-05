import { z } from "zod";

export const adminOrderDbStatuses = [
  "submitted",
  "accepted",
  "picking",
  "packed",
  "shipped",
  "completed",
  "cancelled",
] as const;

export const adminPaymentStatuses = [
  "pending",
  "paid",
  "bank_waiting",
  "failed",
] as const;

export const adminPaymentMethods = [
  "bank_transfer",
  "cash",
] as const;

export const orderQuerySchema = z
  .object({
    customerId: z.string().trim().uuid().optional(),
    dateFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    paymentStatus: z.enum(adminPaymentStatuses).optional(),
    q: z.string().trim().min(2).max(100).optional(),
    sort: z
      .enum(["operations_queue", "date_desc", "date_asc", "total_desc", "total_asc"])
      .default("operations_queue"),
    status: z.enum(adminOrderDbStatuses).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
  })
  .strict();

export const orderPatchSchema = z
  .object({
    status: z.enum(adminOrderDbStatuses).optional(),
    paymentMethod: z.enum(adminPaymentMethods).optional(),
    paymentStatus: z
      .enum(["unpaid", "authorized", "paid", "refunded", ...adminPaymentStatuses] as const)
      .optional(),
    fulfillmentStatus: z
      .enum(["queued", "allocated", "picking", "packed", "shipped", "delivered", "blocked"])
      .optional(),
    carrier: z.string().trim().max(80).optional(),
    tracking: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
    staffNote: z.string().trim().max(1000).optional(),
    forceCancel: z.boolean().optional(),
    rollback: z.boolean().optional(),
  })
  .strict();

export const orderStatusPatchSchema = z
  .object({
    status: z.enum(adminOrderDbStatuses),
    note: z.string().trim().max(1000).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const orderPaymentPatchSchema = z
  .object({
    paymentMethod: z.enum(adminPaymentMethods).optional(),
    paymentStatus: z.enum(["unpaid", "authorized", "paid", "refunded", ...adminPaymentStatuses] as const),
    receivedAmount: z.coerce.number().min(0).optional(),
    receivedAt: z.string().trim().datetime({ offset: true }).optional(),
    reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export const orderShippingPatchSchema = z
  .object({
    shippingAmount: z.coerce.number().min(0),
    reason: z.string().trim().min(1).max(500),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
