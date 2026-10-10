import { z } from "zod";
export type AccountProfilePatch = { mode?: "complete" | "correction"; billingAddress?: string; companyName?: string; contactName?: string; fiscalCode?: string; pec?: string; phone?: string; reason: string; shippingAddress?: string };
export const accountProfileFields: readonly string[];
export const accountProfilePatchSchema: z.ZodType<AccountProfilePatch>;
export function profileChangedValues(current: Record<string, string>, original: Record<string, string>): Record<string, string>;
export function rolePermissionDifference(current: readonly string[], target: readonly string[]): { added: string[]; removed: string[] };
export function canCloseAccountDraft(submitting: boolean, dirty: boolean, confirmDiscard: () => boolean): boolean;
