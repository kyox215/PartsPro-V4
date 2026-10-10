import { z } from "zod";
export const accountProfileFields = ["billingAddress", "companyName", "contactName", "fiscalCode", "pec", "phone", "shippingAddress"];
export const accountProfilePatchSchema = z.object({
  mode: z.enum(["complete", "correction"]).default("complete"),
  billingAddress: z.string().trim().min(1).max(240).optional(),
  companyName: z.string().trim().min(1).max(160).optional(),
  contactName: z.string().trim().max(120).optional(),
  fiscalCode: z.string().trim().min(1).max(32).optional(),
  pec: z.string().trim().max(160).optional(),
  phone: z.string().trim().min(5).max(40).optional(),
  reason: z.string().trim().min(3).max(1000),
  shippingAddress: z.string().trim().min(1).max(240).optional(),
}).strict().superRefine((value, context) => {
  if (!accountProfileFields.some(key => value[key] !== undefined)) context.addIssue({ code: "custom", path: ["reason"], message: "PROFILE_CHANGE_REQUIRED" });
  if (value.mode === "complete") {
    for (const key of ["billingAddress", "companyName", "fiscalCode", "phone", "shippingAddress"]) if (!value[key]) context.addIssue({ code: "custom", path: [key], message: "PROFILE_COMPLETE_FIELD_REQUIRED" });
  }
});
export function profileChangedValues(current, original) {
  return Object.fromEntries(accountProfileFields.filter(key => String(current[key] ?? "").trim() !== String(original[key] ?? "").trim()).map(key => [key, String(current[key] ?? "").trim()]));
}
export function rolePermissionDifference(current, target) {
  const before = new Set(current); const after = new Set(target);
  return { added: [...after].filter(value => !before.has(value)).sort(), removed: [...before].filter(value => !after.has(value)).sort() };
}
export function canCloseAccountDraft(submitting, dirty, confirmDiscard) { return !submitting && (!dirty || confirmDiscard()); }
