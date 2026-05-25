import {
  type AdminB2BApplication,
  type AdminB2BApplicationQueryInput,
  type AdminB2BApplicationReviewInput,
  type AdminCustomer,
} from "@/lib/partspro-repository";
import { toAdminCustomerDto } from "../customers/_dto";

export function toAdminB2BApplicationQuery(input: {
  limit: number;
  offset: number;
  q?: string;
  sort: "submitted_desc" | "submitted_asc" | "created_desc";
  status?: "submitted" | "pending" | "approved" | "rejected";
}): AdminB2BApplicationQueryInput {
  return {
    limit: input.limit,
    offset: input.offset,
    q: input.q,
    sort: input.sort === "submitted_asc" ? "submitted_asc" : "submitted_desc",
    status: input.status === "pending" ? "submitted" : input.status,
  };
}

export function toAdminB2BApplicationReview(
  id: string,
  input: {
    status: "approved" | "rejected";
    note?: string;
    tier?: string;
    priceList?: "Standard" | "Pro" | "Partner";
    priceGroupId?: string | null;
    creditLimit?: number;
    paymentTerms?: string;
  }
): AdminB2BApplicationReviewInput {
  return {
    id,
    decision: input.status === "approved" ? "approve" : "reject",
    note: input.note,
    tier: input.tier ?? input.priceList,
    priceGroupId: input.priceGroupId,
    creditLimit: input.creditLimit,
    paymentTerms: input.paymentTerms,
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
    notes: application.reviewNote,
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

function parseCity(address: string) {
  return address.split(",").map((part) => part.trim()).filter(Boolean).at(-2) ?? "";
}

function parseProvince(address: string) {
  return address.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? "";
}
