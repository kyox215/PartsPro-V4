import { z } from "zod";

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableTextSchema = z.string().trim().max(240).nullable();
const priceGroupIdSchema = z.string().trim().min(1).max(120).nullable();

export const customerTierSchema = z.enum([
  "bronze",
  "silver",
  "gold",
  "emerald",
  "diamond",
  "master",
  "king",
]);

export const customerIdParamSchema = z
  .object({
    id: z.string().trim().uuid(),
  })
  .strict();

export const customerQuerySchema = z
  .object({
    assignmentStatus: z
      .enum(["needs_review", "assigned", "converted_to_employee", "archived"])
      .optional(),
    createdFrom: dateSchema.optional(),
    createdTo: dateSchema.optional(),
    cursor: z.string().trim().regex(/^\d+$/).optional(),
    customerType: z.enum(["retail", "wholesale"]).optional(),
    hasOrders: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    priceGroupId: z.string().trim().min(1).max(120).optional(),
    profileComplete: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
    q: z.string().trim().min(2).max(100).optional(),
    sort: z
      .enum(["created_desc", "name", "name_asc", "revenue_desc", "last_order_desc"])
      .default("created_desc"),
    status: z.enum(["active", "pending", "suspended"]).optional(),
    tier: customerTierSchema.optional(),
  })
  .strict();

export const customerProfilePatchSchema = z
  .object({
    billingAddress: nullableTextSchema.optional(),
    companyName: z.string().trim().min(2).max(160).optional(),
    contactName: z.string().trim().min(1).max(120).nullable().optional(),
    email: z.string().trim().email().max(160).nullable().optional(),
    fiscalCode: z.string().trim().max(40).nullable().optional(),
    pec: z.string().trim().email().max(160).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
    reason: z.string().trim().min(3).max(1000),
    registeredAddress: nullableTextSchema.optional(),
    shippingAddress: nullableTextSchema.optional(),
    sdi: z.string().trim().max(20).nullable().optional(),
    vatNumber: z.string().trim().max(40).nullable().optional(),
  })
  .strict();

export const customerClassificationPatchSchema = z
  .object({
    assignmentStatus: z
      .enum(["needs_review", "assigned", "converted_to_employee", "archived"])
      .optional(),
    customerType: z.enum(["retail", "wholesale"]).optional(),
    memberRole: z.enum(["owner", "buyer", "finance", "support"]).optional(),
    memberStatus: z.enum(["active", "invited", "disabled"]).optional(),
    memberUserId: z.string().trim().uuid().optional(),
    reason: z.string().trim().min(3).max(1000),
    status: z.enum(["active", "pending", "suspended"]).optional(),
  })
  .strict();

export const customerTermsPatchSchema = z
  .object({
    creditLimit: z.coerce.number().min(0).max(1000000).optional(),
    monthlyPurchase: z.string().trim().max(80).nullable().optional(),
    paymentTerms: z.string().trim().max(120).nullable().optional(),
    priceGroupId: priceGroupIdSchema.optional(),
    reason: z.string().trim().min(3).max(1000),
    tier: customerTierSchema.optional(),
  })
  .strict();

export const customerPatchSchema = customerProfilePatchSchema
  .merge(customerClassificationPatchSchema)
  .merge(customerTermsPatchSchema)
  .strict();
