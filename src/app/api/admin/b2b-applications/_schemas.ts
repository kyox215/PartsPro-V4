import { z } from "zod";
import { customerTierSchema } from "../customers/_schemas";

export const b2bApplicationIdParamSchema = z
  .object({
    applicationId: z.string().trim().uuid(),
  })
  .strict();

export const b2bApplicationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    q: z.string().trim().min(2).max(100).optional(),
    sort: z.enum(["submitted_desc", "submitted_asc", "created_desc"]).default("submitted_desc"),
    status: z.enum(["submitted", "approved", "rejected"]).optional(),
  })
  .strict();

export const b2bApplicationPatchSchema = z
  .object({
    creditLimit: z.coerce.number().min(0).max(1000000).optional(),
    decision: z.enum(["approve", "reject"]).optional(),
    note: z.string().trim().max(1000).optional(),
    paymentTerms: z.string().trim().max(120).nullable().optional(),
    priceGroupId: z.string().trim().min(1).max(120).nullable().optional(),
    reason: z.string().trim().min(3).max(1000),
    status: z.enum(["approved", "rejected"]).optional(),
    tier: customerTierSchema.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.decision ?? value.status), {
    message: "decision or status is required",
    path: ["decision"],
  });
