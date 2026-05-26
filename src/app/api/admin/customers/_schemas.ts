import { z } from "zod";

export const customerQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    q: z.string().trim().min(2).max(100).optional(),
    sort: z
      .enum(["created_desc", "name", "name_asc", "revenue_desc", "last_order_desc"])
      .default("created_desc"),
    status: z.enum(["active", "pending", "suspended", "approved", "rejected"]).optional(),
    tier: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const customerPatchSchema = z
  .object({
    companyName: z.string().trim().min(2).max(160).optional(),
    contactName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(160).optional(),
    phone: z.string().trim().max(60).optional(),
    vatNumber: z.string().trim().max(40).optional(),
    fiscalCode: z.string().trim().max(40).optional(),
    sdi: z.string().trim().max(20).optional(),
    pec: z.string().trim().email().max(160).optional(),
    registeredAddress: z.string().trim().max(240).optional(),
    billingAddress: z.string().trim().max(240).optional(),
    shippingAddress: z.string().trim().max(240).optional(),
    status: z.enum(["active", "pending", "suspended", "approved", "rejected"]).optional(),
    tier: z.string().trim().min(1).max(40).optional(),
    priceList: z
      .enum(["bronze", "silver", "gold", "emerald", "diamond", "master", "king"])
      .optional(),
    customerType: z.enum(["retail", "wholesale"]).optional(),
    assignmentStatus: z
      .enum(["needs_review", "assigned", "converted_to_employee", "archived"])
      .optional(),
    priceGroupId: z.string().trim().uuid().nullable().optional(),
    monthlyPurchase: z.string().trim().max(80).optional(),
    creditLimit: z.coerce.number().min(0).max(1000000).optional(),
    paymentTerms: z.string().trim().max(120).optional(),
  })
  .passthrough();

export const applicationQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(100).optional(),
    status: z.enum(["submitted", "approved", "rejected"]).optional(),
    sort: z.enum(["submitted_desc", "submitted_asc"]).default("submitted_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
  })
  .strict();

export const applicationReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(1000).optional(),
    tier: z.string().trim().min(1).max(40).optional(),
    priceGroupId: z.string().trim().uuid().nullable().optional(),
    creditLimit: z.coerce.number().min(0).max(1000000).optional(),
    paymentTerms: z.string().trim().max(120).optional(),
  })
  .strict();
