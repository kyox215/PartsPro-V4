import { z } from "zod";

export const accountProfileLimits = {
  billingAddress: { min: 1, max: 240 }, companyName: { min: 1, max: 160 },
  contactName: { min: 0, max: 120 }, email: { min: 1, max: 160 },
  fiscalCode: { min: 1, max: 32 }, pec: { min: 0, max: 160 },
  phone: { min: 5, max: 40 }, sdi: { min: 0, max: 16 },
  shippingAddress: { min: 1, max: 240 }, vatNumber: { min: 0, max: 32 },
} as const;
export type AccountProfileIssueField = keyof typeof accountProfileLimits;
function text(field: AccountProfileIssueField) {
  const { min, max } = accountProfileLimits[field];
  return z.string().trim().min(min).max(max);
}
/** The browser and API enforce exactly the same field contract. */
export const accountProfileSchema = z.object({
  billingAddress: text("billingAddress"), companyName: text("companyName"),
  contactName: text("contactName").optional(), email: text("email").email(),
  fiscalCode: text("fiscalCode"), pec: text("pec").email().optional().or(z.literal("")),
  phone: text("phone"), sdi: text("sdi").optional(), shippingAddress: text("shippingAddress"),
  vatNumber: text("vatNumber").optional(),
}).strict();

export function accountProfileIssue(issues: unknown) {
  if (!Array.isArray(issues)) return null;
  for (const issue of issues) {
    if (!issue || typeof issue !== "object") continue;
    const path = Array.isArray(issue.path) ? issue.path.join(".") : issue.path;
    if (typeof path !== "string" || !Object.hasOwn(accountProfileLimits, path)) continue;
    const field = path as AccountProfileIssueField;
    const code = issue.code;
    return { field,
      key: code === "too_big" ? "storefront.account.profile.tooLong" : code === "too_small" ? "storefront.account.profile.tooShort" : "storefront.account.profile.checkField",
      limit: code === "too_small" ? accountProfileLimits[field].min : accountProfileLimits[field].max,
    };
  }
  return null;
}
