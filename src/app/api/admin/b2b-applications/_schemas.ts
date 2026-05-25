import { z } from "zod";

export const b2bApplicationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    q: z.string().trim().min(2).max(100).optional(),
    sort: z.enum(["submitted_desc", "submitted_asc", "created_desc"]).default("submitted_desc"),
    status: z.enum(["submitted", "pending", "approved", "rejected"]).optional(),
  })
  .strict();

export const b2bApplicationPatchSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(500).optional(),
    tier: z.string().trim().min(1).max(40).optional(),
    priceList: z.enum(["Standard", "Pro", "Partner"]).optional(),
    priceGroupId: z.string().trim().uuid().nullable().optional(),
    creditLimit: z.coerce.number().min(0).max(1000000).optional(),
    paymentTerms: z.string().trim().max(120).optional(),
  })
  .passthrough();
