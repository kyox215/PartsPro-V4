import { z } from "zod";
import { deliveryMethodInputValues } from "@/lib/partspro-shipping";
export const orderItemSchema = z
  .object({
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
    quantity: z.coerce.number().int().min(1).max(999),
  })
  .strict();
const expectedPreviewLineSchema = z
  .object({
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
    quantity: z.coerce.number().int().min(1).max(999),
    unitNetCents: z.coerce.number().int().min(0).max(100_000_000),
    offerVersion: z.string().trim().min(1).max(160).nullable().optional(),
    priceVersion: z.string().trim().min(1).max(160).nullable().optional(),
    purchaseKind: z.enum(["stock", "preorder"]).optional(),
  })
  .strict();
const expectedPreviewTotalsSchema = z
  .object({
    subtotalCents: z.coerce.number().int().min(0).max(1_000_000_000),
    shippingCents: z.coerce.number().int().min(0).max(1_000_000_000),
    vatCents: z.coerce.number().int().min(0).max(1_000_000_000),
    totalCents: z.coerce.number().int().min(0).max(1_000_000_000),
  })
  .strict();
export const expectedPreviewSchema = z
  .object({
    lines: z.array(expectedPreviewLineSchema).min(1).max(100),
    totals: expectedPreviewTotalsSchema,
  })
  .strict();

const deliveryAddressObjectSchema = z
  .object({
    street: z.string().trim().min(1).max(160),
    zip: z.string().trim().min(3).max(16),
    city: z.string().trim().min(1).max(80),
    province: z.string().trim().min(1).max(8),
    country: z.string().trim().min(2).max(2).default("IT"),
  })
  .strict();

export const deliveryAddressSchema = z.union([
  z.string().trim().min(1).max(500),
  deliveryAddressObjectSchema,
]);

export const createOrderSchema = z
  .object({
    requestId: z.string().uuid(),
    companyId: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
    checkoutMode: z.enum(["customer_self", "employee_self", "delegated_customer"]).optional(),
    deliveryMethod: z.enum(deliveryMethodInputValues).optional(),
    paymentMethod: z.enum(["bank_transfer", "cash"]),
    preorderTermsAccepted: z.boolean().optional(),
    notes: z.string().trim().max(500).optional(),
    purchaseOrderNumber: z.string().trim().min(1).max(64).optional(),
    deliveryAddress: deliveryAddressSchema,
    fiscal: z.unknown().optional(),
    items: z.array(orderItemSchema).min(1).max(100),
    expectedPreview: expectedPreviewSchema.optional(),
    useWallet: z.boolean().optional(),
  })
  .strict();

