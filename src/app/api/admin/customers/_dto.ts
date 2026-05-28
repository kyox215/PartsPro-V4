import {
  type AdminB2BApplication,
  type AdminCustomer,
  type AdminCustomerClassificationInput,
  type AdminCustomerDetail,
  type AdminCustomerLevelInput,
  type AdminCustomerPatchInput,
  type AdminCustomerProfileInput,
  type AdminCustomerQueryInput,
  type AdminCustomerTermsInput,
} from "@/lib/partspro-repository";

type CustomerQueryDto = {
  createdFrom?: string;
  createdTo?: string;
  cursor?: string;
  customerType?: "retail" | "wholesale";
  hasOrders?: boolean;
  limit: number;
  offset: number;
  q?: string;
  sort: "created_desc" | "name" | "name_asc" | "revenue_desc" | "last_order_desc";
  status?: "pending" | "active" | "suspended";
  tier?: string;
};

export function toAdminCustomerQuery(input: CustomerQueryDto): AdminCustomerQueryInput {
  return {
    createdFrom: input.createdFrom,
    createdTo: input.createdTo,
    cursor: input.cursor,
    customerType: input.customerType,
    hasOrders: input.hasOrders,
    limit: input.limit,
    offset: input.offset,
    q: input.q,
    sort: input.sort === "name_asc" ? "name" : input.sort,
    status: input.status,
    tier: input.tier,
  };
}

export function toAdminCustomerPatch(input: AdminCustomerPatchInput): AdminCustomerPatchInput {
  return input;
}

export function toAdminCustomerProfilePatch(input: AdminCustomerProfileInput): AdminCustomerProfileInput {
  return input;
}

export function toAdminCustomerClassificationPatch(
  input: AdminCustomerClassificationInput
): AdminCustomerClassificationInput {
  return input;
}

export function toAdminCustomerTermsPatch(input: AdminCustomerTermsInput): AdminCustomerTermsInput {
  return input;
}

export function toAdminCustomerLevelPatch(input: AdminCustomerLevelInput): AdminCustomerLevelInput {
  return input;
}

export function toAdminCustomerDto(customer: AdminCustomer | AdminCustomerDetail) {
  const detail = customer as Partial<AdminCustomerDetail>;

  return {
    id: customer.id,
    name: customer.name,
    companyName: customer.name,
    partitaIva: customer.partitaIva,
    vatNumber: customer.partitaIva,
    codiceFiscale: customer.codiceFiscale,
    fiscalCode: customer.codiceFiscale,
    pec: customer.pec,
    codiceDestinatario: customer.codiceDestinatario,
    sdi: customer.codiceDestinatario,
    status: customer.customerStatus,
    customerStatus: customer.customerStatus,
    customerType: customer.customerType,
    assignmentStatus: customer.assignmentStatus,
    priceList: customer.priceList,
    tier: customer.tier,
    level: customer.level,
    lifetimeSpendNet: customer.lifetimeSpendNet,
    assignedBy: customer.assignedBy,
    assignedAt: customer.assignedAt,
    priceGroupId: customer.priceGroupId,
    city: customer.city,
    province: customer.province,
    contactName: customer.contactName,
    email: customer.email,
    phone: customer.phone,
    billingAddress: customer.billingAddress,
    shippingAddress: customer.shippingAddress,
    creditLimit: customer.creditLimit,
    paymentTerms: customer.paymentTerms,
    monthlyPurchase: customer.monthlyPurchase,
    receivables: customer.receivables,
    overdue: customer.overdue,
    ordersCount: customer.ordersCount,
    revenue: customer.revenue,
    avgPaymentDays: customer.avgPaymentDays,
    accountOwner: detail.memberships?.find((membership) => membership.memberRole === "owner")
      ?.displayName ?? null,
    lastContact: customer.lastOrderAt ?? customer.updatedAt,
    primarySku: customer.primarySku,
    notes: null,
    memberships: detail.memberships ?? [],
    orders: detail.orders ?? [],
    recentActivity: detail.recentActivity ?? [],
    rmas: detail.rmas ?? [],
    auditEvents: detail.auditEvents ?? [],
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export function toAdminCustomerDetailDto(customer: AdminCustomerDetail) {
  return toAdminCustomerDto(customer);
}

export function toAdminB2BApplicationDto(application: AdminB2BApplication) {
  return {
    id: application.id,
    companyName: application.companyName,
    contactName: application.contactName,
    email: application.email,
    phone: application.phone,
    vatNumber: application.vatNumber,
    fiscalCode: application.fiscalCode,
    sdi: application.sdi,
    pec: application.pec,
    shippingAddress: application.shippingAddress,
    monthlyPurchase: application.monthlyPurchase,
    requestedPriceGroupId: application.requestedPriceGroupId,
    status: application.status,
    reviewNote: application.reviewNote,
    approvedCustomerId: application.approvedCustomerId,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
  };
}
