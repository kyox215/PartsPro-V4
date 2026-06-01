import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  decimal,
  formatZodIssues,
  isValidIsoDate,
  money,
  parseIsoDate,
  parseItalianDate,
  readJsonBody,
  readQueryParams,
  toCents,
} from "@/lib/partspro-api";
import { getAdminAuthState, hasAdminPermission } from "@/lib/partspro-admin-auth";
import {
  clearCurrentCustomerCart,
  getCustomerProfileById,
  getCurrentCustomerProfile,
  getCurrentEmployeeSelfCompany,
  getCurrentEmployeeSelfProfile,
  listCatalogProductsBySkus,
  listCompanies,
  listCurrentCustomerCompanies,
  listOrderSummaries,
  RepositoryWriteError,
  saveOrder,
  type AccountCustomerProfile,
  type PreparedOrderLine,
  type PreparedOrderTotals,
} from "@/lib/partspro-repository";
import {
  type CompanyProfile,
  type OrderSummary,
  type PartProduct,
} from "@/lib/partspro-data";
import {
  applyAccountPriceToProduct,
  canDelegateCheckout,
  getCurrentAccountContext,
  hasOrderableEffectivePrice,
} from "@/lib/partspro-account-context";
import { toPublicSku } from "@/lib/partspro-sku";

const orderStatuses = [
  "draft",
  "pending_payment",
  "submitted",
  "accepted",
  "paid",
  "picking",
  "packed",
  "shipped",
  "completed",
  "delivered",
  "cancelled",
] as const;

const orderItemSchema = z
  .object({
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
    quantity: z.coerce.number().int().min(1).max(999),
  })
  .strict();

const deliveryAddressObjectSchema = z
  .object({
    street: z.string().trim().min(1).max(160),
    zip: z.string().trim().min(3).max(16),
    city: z.string().trim().min(1).max(80),
    province: z.string().trim().min(1).max(8),
    country: z.string().trim().min(2).max(2).default("IT"),
  })
  .strict();

const deliveryAddressSchema = z.union([
  z.string().trim().min(1).max(500),
  deliveryAddressObjectSchema,
]);

const createOrderSchema = z
  .object({
    companyId: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
    checkoutMode: z.enum(["customer_self", "employee_self", "delegated_customer"]).optional(),
    paymentMethod: z.enum(["bank_transfer", "cash", "agreed_terms"]),
    notes: z.string().trim().max(500).optional(),
    purchaseOrderNumber: z.string().trim().min(1).max(64).optional(),
    deliveryAddress: deliveryAddressSchema,
    fiscal: z.unknown().optional(),
    items: z.array(orderItemSchema).min(1).max(100),
  })
  .strict();

const ordersQuerySchema = z
  .object({
    status: z.enum(orderStatuses).optional(),
    company: z.string().trim().min(2).max(80).optional(),
    q: z.string().trim().min(2).max(80).optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidIsoDate).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidIsoDate).optional(),
    minTotal: z.coerce.number().min(0).max(100000).optional(),
    maxTotal: z.coerce.number().min(0).max(100000).optional(),
    sort: z.enum(["date_desc", "date_asc", "total_desc", "total_asc"]).default("date_desc"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .strict();

const ordersQueryKeys = new Set(Object.keys(ordersQuerySchema.shape));

type RequestedOrderItem = z.infer<typeof orderItemSchema>;
type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;
type OrdersQuery = z.infer<typeof ordersQuerySchema>;
type OrderLine = PreparedOrderLine;
type CheckoutMode = "customer_self" | "employee_self" | "delegated_customer";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const authState = await getAdminAuthState();

    if (!authState.allowed) {
      return apiError(
        authState.reason === "missing_session" ? 401 : 403,
        "ADMIN_ORDERS_FORBIDDEN",
        "Only staff users can list customer orders."
      );
    }

    if (!hasAdminPermission(authState, "orders.read")) {
      return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
        permission: "orders.read",
        role: authState.role,
      });
    }

    const parsedParams = readQueryParams(request.nextUrl.searchParams, ordersQueryKeys);

    if (!parsedParams.ok) {
      return apiError(400, "INVALID_QUERY", "Order query parameters are invalid.", parsedParams.details);
    }

    const result = ordersQuerySchema.safeParse(parsedParams.data);

    if (!result.success) {
      return apiError(400, "INVALID_QUERY", "Order query parameters are invalid.", {
        issues: formatZodIssues(result.error),
      });
    }

    const rangeError = validateRange(result.data);
    if (rangeError) {
      return rangeError;
    }

    const repositoryResult = await listOrderSummaries();
    const filtered = filterOrders(repositoryResult.data, result.data);
    const sorted = sortOrders(filtered, result.data.sort);
    const page = sorted.slice(result.data.offset, result.data.offset + result.data.limit);

    return NextResponse.json({
      data: page.map(toOrderSummaryDto),
      meta: {
        source: repositoryResult.source,
        total: filtered.length,
        limit: result.data.limit,
        offset: result.data.offset,
        returned: page.length,
        currency: "EUR",
        ...warningsMeta(repositoryResult.warning),
      },
    });
  } catch {
    return apiError(500, "ORDERS_UNAVAILABLE", "Order data is temporarily unavailable.");
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = createOrderSchema.safeParse(body.data);

  if (!result.success) {
    return apiError(400, "INVALID_ORDER_PAYLOAD", "Order payload is invalid.", {
      issues: formatZodIssues(result.error),
    });
  }

  try {
    const account = await getCurrentAccountContext({ ensure: true });
    const delegatedCheckout = canDelegateCheckout(account);
    const checkoutMode = resolveCheckoutMode(
      account,
      result.data.checkoutMode,
      result.data.companyId,
      delegatedCheckout
    );

    if (!account.authenticated) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required before placing an order.");
    }

    if (checkoutMode === "forbidden") {
      return apiError(403, "CHECKOUT_MODE_FORBIDDEN", "This checkout mode is not available for the current account.");
    }

    if (checkoutMode === "customer_self" && account.customer?.status === "active" && !account.canViewPrices) {
      return apiError(
        422,
        "PRICE_ACCESS_REQUIRED",
        "Customer price list must be enabled before checkout.",
        {
          assignmentStatus: account.customer.assignmentStatus,
          customerId: account.customer.id,
          customerType: account.customer.customerType,
        }
      );
    }

    if (checkoutMode === "customer_self" && !account.canCheckout) {
      return apiError(
        422,
        "CUSTOMER_PROFILE_INCOMPLETE",
        "Complete the required customer, tax, billing and shipping profile before checkout.",
        {
          accountType: account.accountType,
          customerId: account.customer?.id ?? null,
          customerType: account.customer?.customerType ?? null,
        }
      );
    }

    const requestedItems = result.data.items;
    const requestedSkus = requestedItems.map((item) => item.sku);
    const deliveryAddress = normalizeDeliveryAddress(result.data.deliveryAddress);
    const [companies, customerProfile] = await Promise.all([
      checkoutMode === "delegated_customer"
        ? listCompanies()
        : checkoutMode === "employee_self"
          ? getCurrentEmployeeSelfCompany().then(singleCompanyResult)
          : listCurrentCustomerCompanies(),
      checkoutMode === "delegated_customer"
        ? getCustomerProfileById(result.data.companyId)
        : checkoutMode === "employee_self"
          ? getCurrentEmployeeSelfProfile()
          : getCurrentCustomerProfile(),
    ]);
    const companyResolution = resolveCompany(companies.data, result.data.companyId);
    const company = companyResolution.company;

    if (!company) {
      return apiError(404, "COMPANY_NOT_FOUND", "Company profile was not found.");
    }

    if (checkoutMode === "customer_self" && account.customer?.id && company.id !== account.customer.id) {
      return apiError(403, "COMPANY_FORBIDDEN", "Orders can only be placed for the current customer profile.", {
        companyId: company.id,
        customerId: account.customer.id,
      });
    }

    if ((checkoutMode === "delegated_customer" || checkoutMode === "employee_self") && !customerProfile.data) {
      return apiError(404, "COMPANY_NOT_FOUND", "Selected customer profile was not found.");
    }

    if (company.status !== "approved") {
      return apiError(403, "COMPANY_NOT_APPROVED", "Customer profile must be active before placing orders.", {
        companyId: company.id,
        status: company.status,
      });
    }

    const targetCanCheckout =
      checkoutMode === "delegated_customer"
        ? company.profileKind !== "employee_self" && isDelegatedCompanyOrderable(company, customerProfile.data)
        : checkoutMode === "employee_self"
          ? account.canEmployeeSelfCheckout && isDelegatedCompanyOrderable(company, customerProfile.data)
          : account.canCheckout;

    if (!targetCanCheckout) {
      return apiError(
        422,
        "CUSTOMER_PROFILE_INCOMPLETE",
        "Complete the required customer, tax, billing and shipping profile before checkout.",
        {
          assignmentStatus: company.assignmentStatus ?? null,
          companyId: company.id,
          customerType: company.customerType ?? null,
        }
      );
    }

    const catalog = await listCatalogProductsBySkus(requestedSkus, {
      buyerCustomerId: checkoutMode === "customer_self" ? undefined : company.id,
      includeBuyerPrices: account.canViewPrices || checkoutMode !== "customer_self",
    });
    const pricedCatalog = catalog.data.map((product) =>
      product.priceResolved || product.priceVersion
        ? product
        : applyAccountPriceToProduct(product, account)
    );
    const orderBuild = buildOrder(requestedItems, pricedCatalog);

    if (orderBuild.issues.length > 0) {
      return apiError(422, "ORDER_ITEMS_INVALID", "One or more order items cannot be accepted.", {
        issues: orderBuild.issues,
      });
    }

    const totals = calculateTotals(orderBuild.lines);
    const fiscal = buildServerFiscalSnapshot(
      company,
      customerProfile.data,
      deliveryAddress
    );
    const saved = await saveOrder({
      company,
      paymentMethod: result.data.paymentMethod,
      deliveryAddress,
      fiscal,
      notes: result.data.notes,
      lines: orderBuild.lines,
      totals,
    });
    let cartClearWarning: string | undefined;

    try {
      await clearCurrentCustomerCart();
    } catch (error) {
      cartClearWarning =
        error instanceof RepositoryWriteError
          ? error.message
          : "Customer cart could not be cleared after order creation.";
    }

    return NextResponse.json(
      {
        data: {
          id: saved.data.id,
          orderNo: saved.data.orderNo ?? saved.data.id,
          status: saved.data.status,
          createdAt: saved.data.createdAt,
          company: {
            id: company.id,
            name: company.name,
            partitaIva: company.partitaIva,
            status: company.status,
            priceList: company.priceList,
          },
          paymentMethod: result.data.paymentMethod,
          notes: result.data.notes ?? null,
          lines: orderBuild.lines.map(toOrderLineDto),
          totals: totalsDto(totals),
        },
        meta: {
          source: saved.source,
          catalogSource: catalog.source,
          companiesSource: companies.source,
          persistence: "supabase_rpc",
          remoteCart:
            account.accountType === "customer"
              ? cartClearWarning
                ? "clear_failed"
                : "cleared"
              : "not_applicable",
          ...warningsMeta(
            companies.warning,
            catalog.warning,
            customerProfile.warning,
            companyResolution.warning,
            saved.warning,
            cartClearWarning
          ),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RepositoryWriteError) {
      console.error("[orders:create] repository write failed", {
        code: error.code,
        details: error.details,
        message: error.message,
        status: error.status,
      });

      return orderRepositoryError(error);
    }

    console.error("[orders:create] unexpected failure", {
      message: error instanceof Error ? error.message : String(error),
    });

    return apiError(500, "ORDER_CREATE_FAILED", "Order could not be created at this time.");
  }
}

function buildServerFiscalSnapshot(
  company: CompanyProfile,
  profile: AccountCustomerProfile | null,
  deliveryAddress: string
) {
  return {
    companySnapshot: {
      name: profile?.companyName || company.name,
      partitaIva: profile?.vatNumber || company.partitaIva,
      codiceFiscale: profile?.fiscalCode || company.codiceFiscale,
      pec: profile?.pec || company.pec,
      codiceDestinatario: profile?.sdi || company.codiceDestinatario,
      address: profile?.billingAddress || company.billingAddress || deliveryAddress,
      deliveryAddress,
    },
  };
}

function normalizeDeliveryAddress(input: DeliveryAddressInput) {
  if (typeof input === "string") {
    return input.trim();
  }

  return [
    input.street,
    [input.zip, input.city].filter(Boolean).join(" "),
    input.province,
    input.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function isDelegatedCompanyOrderable(
  company: CompanyProfile,
  profile: AccountCustomerProfile | null
) {
  return Boolean(
    company.status === "approved" &&
      company.assignmentStatus === "assigned" &&
      profile &&
      isCheckoutProfileComplete(profile)
  );
}

function singleCompanyResult(
  result: Awaited<ReturnType<typeof getCurrentEmployeeSelfCompany>>
): Awaited<ReturnType<typeof listCurrentCustomerCompanies>> {
  return {
    ...result,
    data: result.data ? [result.data] : [],
  };
}

function resolveCheckoutMode(
  account: Awaited<ReturnType<typeof getCurrentAccountContext>>,
  requestedMode: CheckoutMode | undefined,
  companyId: string,
  delegatedCheckout: boolean
): CheckoutMode | "forbidden" {
  if (account.accountType === "customer") {
    return requestedMode && requestedMode !== "customer_self"
      ? "forbidden"
      : "customer_self";
  }

  if (account.accountType !== "employee") {
    return "forbidden";
  }

  const employeeSelfId = account.employeeSelfCustomer?.id;
  const inferredMode =
    requestedMode ??
    (employeeSelfId && companyId === employeeSelfId
      ? "employee_self"
      : "delegated_customer");

  if (inferredMode === "employee_self") {
    return employeeSelfId && companyId === employeeSelfId
      ? "employee_self"
      : "forbidden";
  }

  if (inferredMode === "delegated_customer") {
    return delegatedCheckout ? "delegated_customer" : "forbidden";
  }

  return "forbidden";
}

function isCheckoutProfileComplete(profile: AccountCustomerProfile) {
  const sharedComplete = Boolean(
    profile.contactName &&
      profile.email &&
      profile.phone &&
      profile.billingAddress &&
      profile.shippingAddress
  );

  if (!sharedComplete) {
    return false;
  }

  if (profile.customerType === "retail") {
    return Boolean(profile.fiscalCode || profile.vatNumber);
  }

  return Boolean(
    profile.companyName &&
      profile.vatNumber &&
      profile.fiscalCode &&
      (profile.pec || profile.sdi)
  );
}

function orderRepositoryError(error: RepositoryWriteError) {
  if (error.code !== "ORDER_RPC_FAILED") {
    return apiError(error.status, error.code, error.message, error.details);
  }

  const details = isRecord(error.details) ? error.details : {};
  const sqlState = readString(details.code);
  const rpcMessage = readString(details.message) ?? error.message;
  const normalizedMessage = rpcMessage.toLowerCase();

  if (sqlState === "40001" || normalizedMessage.includes("price changed")) {
    return apiError(
      409,
      "ORDER_PRICE_CHANGED",
      "Some prices changed before the order was confirmed. Refresh checkout and try again.",
      error.details
    );
  }

  if (
    sqlState === "23514" ||
    normalizedMessage.includes("stock") ||
    normalizedMessage.includes("moq") ||
    normalizedMessage.includes("quantity")
  ) {
    return apiError(
      422,
      "ORDER_STOCK_INVALID",
      "One or more items no longer match stock, quantity or MOQ rules.",
      error.details
    );
  }

  if (sqlState === "23503" || normalizedMessage.includes("unknown sku")) {
    return apiError(
      422,
      "ORDER_SKU_UNAVAILABLE",
      "One or more items are no longer available.",
      error.details
    );
  }

  if (sqlState === "42501" || normalizedMessage.includes("customer")) {
    return apiError(
      422,
      "ORDER_CUSTOMER_NOT_READY",
      "Customer profile or account permissions changed before checkout.",
      error.details
    );
  }

  return apiError(error.status, error.code, error.message, error.details);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function filterOrders(items: OrderSummary[], query: OrdersQuery) {
  const normalizedCompany = query.company?.toLowerCase();
  const normalizedSearch = query.q?.toLowerCase();
  const dateFrom = query.dateFrom ? parseIsoDate(query.dateFrom) ?? undefined : undefined;
  const dateTo = query.dateTo ? parseIsoDate(query.dateTo) ?? undefined : undefined;
  const minTotalCents = query.minTotal === undefined ? undefined : toCents(query.minTotal);
  const maxTotalCents = query.maxTotal === undefined ? undefined : toCents(query.maxTotal);

  return items.filter((order) => {
    const orderDate = parseItalianDate(order.date);
    const orderTotalCents = toCents(order.total);
    const matchesStatus = query.status ? order.status === query.status : true;
    const matchesCompany = normalizedCompany
      ? order.company.toLowerCase().includes(normalizedCompany)
      : true;
    const matchesSearch = normalizedSearch
      ? [order.id, order.company, order.status].join(" ").toLowerCase().includes(normalizedSearch)
      : true;
    const matchesDateFrom = dateFrom === undefined ? true : orderDate >= dateFrom;
    const matchesDateTo = dateTo === undefined ? true : orderDate <= dateTo;
    const matchesMinTotal = minTotalCents === undefined ? true : orderTotalCents >= minTotalCents;
    const matchesMaxTotal = maxTotalCents === undefined ? true : orderTotalCents <= maxTotalCents;

    return (
      matchesStatus &&
      matchesCompany &&
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesMinTotal &&
      matchesMaxTotal
    );
  });
}

function sortOrders(items: OrderSummary[], sort: OrdersQuery["sort"]) {
  return [...items].sort((a, b) => {
    switch (sort) {
      case "date_asc":
        return parseItalianDate(a.date) - parseItalianDate(b.date);
      case "total_desc":
        return toCents(b.total) - toCents(a.total);
      case "total_asc":
        return toCents(a.total) - toCents(b.total);
      case "date_desc":
      default:
        return parseItalianDate(b.date) - parseItalianDate(a.date);
    }
  });
}

function buildOrder(requestedItems: RequestedOrderItem[], catalog: PartProduct[]) {
  const seen = new Set<string>();
  const issues: Array<{ sku: string; message: string }> = [];
  const lines: OrderLine[] = [];

  for (const item of requestedItems) {
    const sku = toPublicSku(item.sku);

    if (seen.has(sku)) {
      issues.push({ sku, message: "Duplicate SKU in order payload." });
      continue;
    }

    seen.add(sku);

    const product = catalog.find((entry) => toPublicSku(entry.sku) === sku);

    if (!product) {
      issues.push({ sku, message: "SKU is not available in the catalog." });
      continue;
    }

    if (item.quantity < product.moq) {
      issues.push({ sku, message: `Quantity must be at least the MOQ (${product.moq}).` });
      continue;
    }

    if (product.status === "Out of Stock") {
      issues.push({ sku, message: "Product is currently out of stock." });
      continue;
    }

    if (!hasOrderableEffectivePrice(product)) {
      issues.push({ sku, message: "Effective price is not available for this SKU." });
      continue;
    }

    if (item.quantity > product.stock) {
      issues.push({ sku, message: `Only ${product.stock} units are currently available.` });
      continue;
    }

    lines.push(buildOrderLine(product, item.quantity));
  }

  return { lines, issues };
}

function resolveCompany(
  companies: CompanyProfile[],
  requestedCompanyId: string
): { company: CompanyProfile | null; warning?: string } {
  const exact = companies.find((profile) => profile.id === requestedCompanyId);

  if (exact) {
    return { company: exact };
  }

  return { company: null };
}

function buildOrderLine(product: PartProduct, quantity: number) {
  const unitNetCents = toCents(product.price);
  const lineNetCents = unitNetCents * quantity;

  const line = {
    product,
    quantity,
    unitNetCents,
    lineNetCents,
    vatCents: 0,
    lineGrossCents: lineNetCents,
  };

  return product.priceVersion ? { ...line, priceVersion: product.priceVersion } : line;
}

function toOrderLineDto(line: OrderLine) {
  return {
    sku: line.product.sku,
    name: line.product.name,
    brand: line.product.brand,
    category: line.product.category,
    grade: line.product.grade,
    warehouse: line.product.warehouse,
    quantity: line.quantity,
    moq: line.product.moq,
    rmaDays: line.product.rmaDays,
    unitPrice: money(line.unitNetCents),
    lineNet: money(line.lineNetCents),
    vatRate: decimal(line.product.vatRate),
    vat: money(line.vatCents),
    lineGross: money(line.lineGrossCents),
  };
}

function calculateTotals(lines: OrderLine[]): PreparedOrderTotals {
  const subtotalCents = lines.reduce((total, line) => total + line.lineNetCents, 0);
  const shippingCents = subtotalCents > 25000 ? 0 : 1290;
  const totalCents = subtotalCents + shippingCents;

  return {
    subtotalCents,
    shippingCents,
    vatCents: 0,
    totalCents,
  };
}

function totalsDto(totals: PreparedOrderTotals) {
  return {
    subtotal: money(totals.subtotalCents),
    shipping: money(totals.shippingCents),
    vat: money(totals.vatCents),
    total: money(totals.totalCents),
    freeShippingThreshold: money(25000),
    vatMode: "tax_included_shipping_only",
  };
}

function toOrderSummaryDto(order: OrderSummary) {
  return {
    id: order.id,
    date: order.date,
    status: order.status,
    company: order.company,
    total: money(toCents(order.total)),
    items: order.items,
  };
}

function warningsMeta(...warnings: Array<string | undefined>) {
  const values = warnings.filter((warning): warning is string => Boolean(warning));
  return values.length > 0 ? { warnings: values } : {};
}

function validateRange(query: OrdersQuery) {
  if (query.minTotal !== undefined && query.maxTotal !== undefined && query.minTotal > query.maxTotal) {
    return apiError(400, "INVALID_QUERY_RANGE", "minTotal cannot be greater than maxTotal.");
  }

  const dateFrom = query.dateFrom ? parseIsoDate(query.dateFrom) : null;
  const dateTo = query.dateTo ? parseIsoDate(query.dateTo) : null;

  if (dateFrom !== null && dateTo !== null && dateFrom > dateTo) {
    return apiError(400, "INVALID_QUERY_RANGE", "dateFrom cannot be after dateTo.");
  }

  return null;
}
