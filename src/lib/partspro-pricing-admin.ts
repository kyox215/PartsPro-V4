import { z } from "zod";
import { customerTiers } from "./partspro-pricing";

export const pricingItemsSchema = z.array(z.object({
  sku: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9_+.-]+$/),
  quantity: z.number().int().min(1).max(10000),
}).strict()).min(1).max(50);

export const pricingInspectionSchema = z.object({
  customerId: z.string().uuid(),
  customerType: z.enum(["retail", "wholesale"]).optional(),
  items: pricingItemsSchema,
}).strict();

export const signupCampaignSchema = z.object({
  enabled: z.boolean(),
  level: z.enum(customerTiers),
  duration_months: z.number().int().min(1).max(24),
  starts_at: z.string().datetime({ offset: true }).nullable(),
  ends_at: z.string().datetime({ offset: true }).nullable(),
  reason: z.string().trim().min(3).max(1000),
}).strict().refine((value) => !value.ends_at || !value.starts_at || Date.parse(value.ends_at) > Date.parse(value.starts_at), {
  message: "活动结束时间必须晚于开始时间", path: ["ends_at"],
});

export type SignupPricingCampaign = Omit<z.infer<typeof signupCampaignSchema>, "reason"> & { updated_at?: string };
export type PricingInspection = {
  sku_code: string;
  customer_type?: string;
  base_customer_level?: string;
  customer_level?: string;
  level_source?: string;
  base_unit_price?: number | null;
  effective_unit_price?: number | null;
  price_source?: string;
  quoted_quantity?: number;
  quote_status?: string;
  price_version?: string | null;
  price_valid_until?: string | null;
};
export type ClassificationPricingPreview = {
  items: { sku_code: string; before: PricingInspection; after: PricingInspection }[];
};
export type PricingAnomaly = {
  kind: string;
  customer_id?: string;
  sku_code?: string;
  stored_level?: string;
  effective_level?: string;
};
