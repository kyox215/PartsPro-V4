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
  getCurrentCustomerProfile,
  listCatalogProducts,
  listCompanies,
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
  getCurrentAccountContext,
  hasOrderableEffectivePrice,
} from "@/lib/partspro-account-context";
import { toPublicSku } from "@/lib/partspro-sku";

const orderStatuses = [
  "draft",
  "pending_payment",
  "paid",
  "picking",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const orderItemSchema = z
  .object({
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
    quantity: z.coerce.number().int().min(1).max(999),
  })
  .strict();

const deliveryAddressSchema = z
  .object({
    street: z.string().trim().min(1).max(160),
    zip: z.string().trim().min(3).max(16),
    city: z.string().trim().min(1).max(80),
    province: z.string().trim().min(1).max(8),
    country: z.string().trim().min(2).max(2).default("IT"),
  })
  .strict();

const createOrderSchema = z
  .object({
    companyId: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
    paymentMethod: z.enum(["bank_transfer", "card", "agreed_terms"]),
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
type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;
type OrdersQuery = z.infer<typeof ordersQuerySchema>;
type OrderLine = PreparedOrderLine;
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

    if (!account.authenticated) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required before placing an order.");
    }

    if (account.customer?.status === "active" && !account.canViewPrices) {
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

    if (!account.canCheckout) {
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

    const [companies, catalog, customerProfile] = await Promise.all([
      listCompanies(),
      listCatalogProducts(),
      getCurrentCustomerProfile(),
    ]);
    const companyResolution = resolveCompany(companies.data, result.data.companyId);
    const company = companyResolution.company;

    if (!company) {
      return apiError(404, "COMPANY_NOT_FOUND", "Company profile was not found.");
    }

    if (account.customer?.id && company.id !== account.customer.id) {
      return apiError(403, "COMPANY_FORBIDDEN", "Orders can only be placed for the current customer profile.", {
        companyId: company.id,
        customerId: account.customer.id,
      });
    }

    if (company.status !== "approved") {
      return apiError(403, "COMPANY_NOT_APPROVED", "Customer profile must be active before placing orders.", {
        companyId: company.id,
        status: company.status,
      });
    }

    const requestedItems = result.data.items;
    const pricedCatalog = catalog.data.map((product) =>
      applyAccountPriceToProduct(product, account)
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
      result.data.deliveryAddress
    );
    const saved = await saveOrder({
      company,
      paymentMethod: result.data.paymentMethod,
      purchaseOrderNumber: result.data.purchaseOrderNumber,
      deliveryAddress: result.data.deliveryAddress,
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
          purchaseOrderNumber: result.data.purchaseOrderNumber ?? null,
          notes: result.data.notes ?? null,
          lines: orderBuild.lines.map(toOrderLineDto),
          totals: totalsDto(totals),
        },
        meta: {
          source: saved.source,
          catalogSource: catalog.source,
          companiesSource: companies.source,
          persistence: "supabase_rpc",
          remoteCart: cartClearWarning ? "clear_failed" : "cleared",
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
      return orderRepositoryError(error);
    }

    return apiError(500, "ORDER_CREATE_FAILED", "Order could not be created at this time.");
  }
}

function buildServerFiscalSnapshot(
  company: CompanyProfile,
  profile: AccountCustomerProfile | null,
  deliveryAddress: DeliveryAddress
) {
  return {
    companySnapshot: {
      name: profile?.companyName || company.name,
      partitaIva: profile?.vatNumber || company.partitaIva,
      codiceFiscale: profile?.fiscalCode || company.codiceFiscale,
      pec: profile?.pec || company.pec,
      codiceDestinatario: profile?.sdi || company.codiceDestinatario,
      address: deliveryAddress,
    },
  };
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
  const vatCents = Math.round((lineNetCents * product.vatRate) / 100);

  const line = {
    product,
    quantity,
    unitNetCents,
    lineNetCents,
    vatCents,
    lineGrossCents: lineNetCents + vatCents,
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
  const itemsVatCents = lines.reduce((total, line) => total + line.vatCents, 0);
  const shippingVatCents = Math.round((shippingCents * 22) / 100);
  const vatCents = itemsVatCents + shippingVatCents;
  const totalCents = subtotalCents + shippingCents + vatCents;

  return {
    subtotalCents,
    shippingCents,
    vatCents,
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
    vatMode: "net_prices_plus_iva",
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
