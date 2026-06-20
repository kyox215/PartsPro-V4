import type { CompanyProfile } from "@/lib/partspro-data";
import type { AccountCustomerProfile } from "@/lib/partspro-repository";

export type CheckoutProfileField =
  | "billing_address"
  | "company"
  | "email"
  | "fiscal_code"
  | "phone"
  | "shipping_address";

export type CustomerCheckoutReadiness = {
  assignmentStatus: string | null;
  companyId: string | null;
  customerType: string | null;
  missingFields: CheckoutProfileField[];
  orderable: boolean;
  profileComplete: boolean;
  profileKind: string | null;
  status: string | null;
};

export function checkoutProfileMissingFields(
  profile: AccountCustomerProfile | null | undefined
): CheckoutProfileField[] {
  if (!profile) {
    return ["company", "email", "phone", "billing_address", "shipping_address", "fiscal_code"];
  }

  return [
    hasText(profile.companyName) ? null : "company",
    hasText(profile.email) ? null : "email",
    hasText(profile.phone) ? null : "phone",
    hasText(profile.billingAddress) ? null : "billing_address",
    hasText(profile.shippingAddress) ? null : "shipping_address",
    hasText(profile.fiscalCode) ? null : "fiscal_code",
  ].filter((field): field is CheckoutProfileField => Boolean(field));
}

export function isCheckoutProfileComplete(
  profile: AccountCustomerProfile | null | undefined
) {
  return Boolean(profile && checkoutProfileMissingFields(profile).length === 0);
}

export function customerCheckoutReadiness(
  company: CompanyProfile | null | undefined,
  profile: AccountCustomerProfile | null | undefined
): CustomerCheckoutReadiness {
  const missingFields = checkoutProfileMissingFields(profile);
  const status = company?.status ?? profile?.status ?? null;
  const assignmentStatus = company?.assignmentStatus ?? profile?.assignmentStatus ?? null;
  const profileComplete = Boolean(profile && missingFields.length === 0);

  return {
    assignmentStatus,
    companyId: company?.id ?? profile?.id ?? null,
    customerType: company?.customerType ?? profile?.customerType ?? null,
    missingFields,
    orderable: Boolean(
      status === "approved" &&
        assignmentStatus === "assigned" &&
        profileComplete
    ),
    profileComplete,
    profileKind: company?.profileKind ?? profile?.profileKind ?? null,
    status,
  };
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
