import {
  type AdminB2BApplication,
  type AdminB2BApplicationQueryInput,
  type AdminB2BApplicationReviewInput,
  type AdminCustomer,
} from "@/lib/partspro-repository";

export function toAdminB2BApplicationQuery(input: {
  limit: number;
  offset: number;
  q?: string;
  sort: "submitted_desc" | "submitted_asc" | "created_desc";
  status?: "submitted" | "approved" | "rejected";
}): AdminB2BApplicationQueryInput {
  return {
    limit: input.limit,
    offset: input.offset,
    q: input.q,
    sort: input.sort === "submitted_asc" ? "submitted_asc" : "submitted_desc",
    status: input.status,
  };
}

export function toAdminB2BApplicationReview(
  id: string,
  input: {
    decision?: "approve" | "reject";
    status?: "approved" | "rejected";
    note?: string;
    reason: string;
    priceGroupId?: string | null;
    creditLimit?: number;
    paymentTerms?: string | null;
  }
): AdminB2BApplicationReviewInput {
  const decision =
    input.decision ?? (input.status === "approved" ? "approve" : "reject");

  return {
    id,
    decision,
    note: input.note,
    reason: input.reason,
    priceGroupId: input.priceGroupId,
    creditLimit: input.creditLimit,
    paymentTerms: input.paymentTerms ?? undefined,
  };
}

export function toAdminB2BApplicationDto(application: AdminB2BApplication) {
  return {
    id: application.id,
    companyName: application.companyName,
    partitaIva: application.vatNumber,
    vatNumber: application.vatNumber,
    fiscalCode: application.fiscalCode,
    contactName: application.contactName,
    email: application.email,
    phone: application.phone,
    city: parseCity(application.registeredAddress),
    province: parseProvince(application.registeredAddress),
    status: application.status,
    requestedTier: "Standard",
    requestedPriceGroupId: application.requestedPriceGroupId,
    createdAt: application.submittedAt,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    approvedCustomerId: application.approvedCustomerId,
    reviewNote: application.reviewNote,
  };
}

export function toAdminB2BReviewDto(input: {
  application: AdminB2BApplication;
  customer: AdminCustomer | null;
}) {
  return {
    application: toAdminB2BApplicationDto(input.application),
    customer: input.customer ? toAdminCustomerDto(input.customer) : null,
  };
}

function toAdminCustomerDto(customer: AdminCustomer) {
  return {
    id: customer.id,
    name: customer.name,
    companyName: customer.name,
    partitaIva: customer.partitaIva,
    vatNumber: customer.partitaIva,
    fiscalCode: customer.codiceFiscale,
    status: customer.customerStatus,
    customerType: customer.customerType,
    assignmentStatus: customer.assignmentStatus,
    tier: customer.tier,
    level: customer.level,
    priceList: customer.priceList,
  };
}

function parseCity(address: string) {
  return address.split(",").map((part) => part.trim()).filter(Boolean).at(-2) ?? "";
}

function parseProvince(address: string) {
  return address.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? "";
}
