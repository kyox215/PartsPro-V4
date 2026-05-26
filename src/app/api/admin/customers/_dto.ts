import {
  type AdminB2BApplication,
  type AdminCustomer,
  type AdminCustomerPatchInput,
  type AdminCustomerQueryInput,
} from "@/lib/partspro-repository";

export function toAdminCustomerQuery(input: {
  limit: number;
  offset: number;
  q?: string;
  sort: "created_desc" | "name" | "name_asc" | "revenue_desc" | "last_order_desc";
  status?: "active" | "pending" | "suspended" | "approved" | "rejected";
  tier?: string;
}): AdminCustomerQueryInput {
  return {
    limit: input.limit,
    offset: input.offset,
    q: input.q,
    sort: input.sort === "name_asc" ? "name" : input.sort,
    status: toAdminCustomerStatus(input.status),
    tier: input.tier,
  };
}

export function toAdminCustomerPatch(input: {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  vatNumber?: string;
  fiscalCode?: string;
  sdi?: string;
  pec?: string;
  registeredAddress?: string;
  billingAddress?: string;
  shippingAddress?: string;
  status?: "active" | "pending" | "suspended" | "approved" | "rejected";
  tier?: string;
  priceList?: "bronze" | "silver" | "gold" | "emerald" | "diamond" | "master" | "king";
  customerType?: "retail" | "wholesale";
  assignmentStatus?: "needs_review" | "assigned" | "converted_to_employee" | "archived";
  priceGroupId?: string | null;
  monthlyPurchase?: string;
  creditLimit?: number;
  paymentTerms?: string;
}): AdminCustomerPatchInput {
  return {
    companyName: input.companyName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    vatNumber: input.vatNumber,
    fiscalCode: input.fiscalCode,
    sdi: input.sdi,
    pec: input.pec,
    registeredAddress: input.registeredAddress,
    billingAddress: input.billingAddress,
    shippingAddress: input.shippingAddress,
    status: toAdminCustomerStatus(input.status),
    tier: input.tier ?? input.priceList,
    customerType: input.customerType,
    assignmentStatus: input.assignmentStatus,
    priceGroupId: input.priceGroupId,
    monthlyPurchase: input.monthlyPurchase,
    creditLimit: input.creditLimit,
    paymentTerms: input.paymentTerms,
  };
}

export function toAdminCustomerDto(customer: AdminCustomer) {
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
    status: customer.status,
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
    registeredAddress: customer.registeredAddress,
    billingAddress: customer.billingAddress,
    shippingAddress: customer.shippingAddress,
    creditLimit: customer.creditLimit,
    paymentTerms: customer.paymentTerms,
    monthlyPurchase: customer.monthlyPurchase,
    receivables: 0,
    overdue: 0,
    ordersCount: customer.ordersCount,
    revenue: customer.revenue,
    avgPaymentDays: 0,
    accountOwner: "Sales",
    lastContact: customer.lastOrderAt ?? customer.updatedAt,
    primarySku: "",
    notes: "Profilo sincronizzato da /api/admin/customers.",
    orders: [],
    rmas: [],
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
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
    registeredAddress: application.registeredAddress,
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

function toAdminCustomerStatus(
  value: "active" | "pending" | "suspended" | "approved" | "rejected" | undefined
) {
  if (value === "approved") {
    return "active";
  }

  if (value === "rejected") {
    return "suspended";
  }

  return value;
}
