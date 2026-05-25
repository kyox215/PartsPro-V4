import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  centsToNumber,
  formatItalianDate,
  formatPartsProDateTime,
} from "@/lib/partspro-api";
import {
  type CompanyProfile,
  type CompanyStatus,
  type OrderStatus,
  type OrderSummary,
  type PartProduct,
  type PartVisual,
  type ProductGrade,
  type RmaRequest,
  type RmaStatus,
  type StockStatus,
} from "@/lib/partspro-data";

type DbRow = Record<string, unknown>;
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type SupabaseContext = {
  client: SupabaseServerClient;
  userId: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productImagesBucket = "product-images";

export type RepositorySource = "supabase" | "empty";

export class RepositoryWriteError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "RepositoryWriteError";
  }
}

export type RepositoryResult<T> = {
  data: T;
  source: RepositorySource;
  warning?: string;
};

export type RepositoryPartProduct = PartProduct & {
  remoteId?: string;
};

export type PreparedOrderLine = {
  product: PartProduct;
  quantity: number;
  unitNetCents: number;
  lineNetCents: number;
  vatCents: number;
  lineGrossCents: number;
};

export type PreparedOrderTotals = {
  subtotalCents: number;
  shippingCents: number;
  vatCents: number;
  totalCents: number;
};

export type DeliveryAddressSnapshot = {
  street: string;
  zip: string;
  city: string;
  province: string;
  country: string;
};

export type FiscalSnapshot = {
  companySnapshot: {
    name: string;
    partitaIva: string;
    codiceFiscale: string;
    pec: string;
    codiceDestinatario: string;
    address?: DeliveryAddressSnapshot;
  };
};

export type SaveOrderInput = {
  company: CompanyProfile;
  paymentMethod: "bank_transfer" | "card" | "agreed_terms";
  purchaseOrderNumber?: string;
  deliveryAddress: DeliveryAddressSnapshot;
  fiscal: FiscalSnapshot;
  notes?: string;
  lines: PreparedOrderLine[];
  totals: PreparedOrderTotals;
};

export type SavedOrder = {
  id: string;
  status: OrderStatus;
  createdAt: string;
};

export type SaveRmaInput = {
  orderId?: string;
  orderLineId?: string;
  sku: string;
  quantity: number;
  reason: string;
  description: string;
  productName?: string;
};

export type B2BApplicationInput = {
  companyName: string;
  partitaIva: string;
  codiceFiscale: string;
  pec?: string;
  codiceDestinatario?: string;
  contactName: string;
  email: string;
  phone?: string;
  city: string;
  province: string;
  address?: string;
  website?: string;
  notes?: string;
};

export type B2BApplication = B2BApplicationInput & {
  id: string;
  status: "submitted";
  createdAt: string;
};

export async function listCatalogProducts(): Promise<RepositoryResult<RepositoryPartProduct[]>> {
  const supabaseResult = await withSupabase(readCatalogProducts);
  const publicSupabaseResult = supabaseResult ?? (await readPublicCatalogProducts());

  return (
    publicSupabaseResult ??
    emptyResult(
      [],
      isSupabaseConfigured()
        ? "Supabase catalog could not be read; no local catalog is available."
        : "Supabase is not configured; no local catalog is available."
    )
  );
}

async function readPublicCatalogProducts(): Promise<RepositoryResult<RepositoryPartProduct[]> | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const client = await createClient();
    const data = await readCatalogProducts({ client, userId: "" });
    return data === null ? null : { data, source: "supabase" };
  } catch {
    return null;
  }
}

export async function listCompanies(): Promise<RepositoryResult<CompanyProfile[]>> {
  const supabaseResult = await withSupabase(readCompanies);
  return (
    supabaseResult ??
    emptyResult(
      [],
      isSupabaseConfigured()
        ? "Supabase companies could not be read; no local companies are available."
        : "Supabase is not configured; no local companies are available."
    )
  );
}

export async function listOrderSummaries(): Promise<RepositoryResult<OrderSummary[]>> {
  const supabaseResult = await withSupabase(readOrderSummaries);
  return (
    supabaseResult ??
    emptyResult(
      [],
      isSupabaseConfigured()
        ? "Supabase orders could not be read; no local orders are available."
        : "Supabase is not configured; no local orders are available."
    )
  );
}

export async function saveOrder(input: SaveOrderInput): Promise<RepositoryResult<SavedOrder>> {
  if (!isSupabaseConfigured()) {
    throw new RepositoryWriteError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase must be configured before B2B orders can be created."
    );
  }

  const context = await requireSupabaseContext();
  const order = await insertOrder(context, input);

  if (!order) {
    throw new RepositoryWriteError(
      502,
      "ORDER_WRITE_UNAVAILABLE",
      "Order could not be persisted in Supabase."
    );
  }

  return { data: order, source: "supabase" };
}

export async function listRmaRequests(): Promise<RepositoryResult<RmaRequest[]>> {
  const supabaseResult = await withSupabase(readRmaRequests);
  return supabaseResult ?? emptyResult([], "No local RMA requests are available.");
}

export async function saveRmaRequest(input: SaveRmaInput): Promise<RepositoryResult<RmaRequest>> {
  if (!isSupabaseConfigured()) {
    throw new RepositoryWriteError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase must be configured before RMA requests can be created."
    );
  }

  const context = await requireSupabaseContext();
  const request = await insertRmaRequest(context, input);

  if (!request) {
    throw new RepositoryWriteError(
      502,
      "RMA_WRITE_UNAVAILABLE",
      "RMA request could not be persisted in Supabase."
    );
  }

  return { data: request, source: "supabase" };
}

export async function saveB2BApplication(
  input: B2BApplicationInput
): Promise<RepositoryResult<B2BApplication>> {
  if (!isSupabaseConfigured()) {
    throw new RepositoryWriteError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase must be configured before B2B applications can be created."
    );
  }

  const client = await createClient();
  const application = await insertB2BApplication(client, input);

  if (!application) {
    throw new RepositoryWriteError(
      502,
      "B2B_APPLICATION_WRITE_UNAVAILABLE",
      "B2B application could not be persisted in Supabase."
    );
  }

  return { data: application, source: "supabase" };
}

async function withSupabase<T>(
  reader: (context: SupabaseContext) => Promise<T | null>
): Promise<RepositoryResult<T> | null> {
  const context = await getSupabaseContext();

  if (!context) {
    return null;
  }

  try {
    const data = await reader(context);
    return data === null ? null : { data, source: "supabase" };
  } catch {
    return null;
  }
}

async function getSupabaseContext(): Promise<SupabaseContext | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      return null;
    }

    return { client, userId: user.id };
  } catch {
    return null;
  }
}

async function requireSupabaseContext(): Promise<SupabaseContext> {
  const context = await getSupabaseContext();

  if (!context) {
    throw new RepositoryWriteError(
      401,
      "SUPABASE_SESSION_REQUIRED",
      "A valid Supabase session is required for this write operation."
    );
  }

  return context;
}

async function readCatalogProducts(context: SupabaseContext) {
  const catalogViewRows = await readCatalogProductViews(context.client);

  if (catalogViewRows) {
    return catalogViewRows.map(mapProductRow).filter(isDefined);
  }

  const productRows =
    (await readRows(
      context.client,
      "products",
      "id, sku_code, name, brand, model, model_code, model_codes, category, quality_grade, stock_status, moq, retail_price, b2b_price, vat_mode, warranty_days, stock_qty, location, compatibility_models, highlights, status, updated_at"
    )) ?? (await readRows(context.client, "products"));

  if (productRows) {
    return productRows.map(mapProductRow).filter(isDefined);
  }

  const inventoryRows = await readRows(context.client, "inventory_items");

  if (inventoryRows) {
    return inventoryRows.map(mapProductRow).filter(isDefined);
  }

  return null;
}

async function readCatalogProductViews(client: SupabaseServerClient) {
  const summaryRows = await readRows(client, "catalog_public_summary");

  if (!summaryRows) {
    return null;
  }

  const priceRows = await readRows(client, "catalog_buyer_prices");
  const priceRowsById = new Map<string, DbRow>();
  const priceRowsBySku = new Map<string, DbRow>();

  for (const row of priceRows ?? []) {
    const id = pickString(row, ["id"]);
    const sku = pickString(row, ["sku_code", "sku"]);

    if (id) {
      priceRowsById.set(id, row);
    }

    if (sku) {
      priceRowsBySku.set(sku.toUpperCase(), row);
    }
  }

  return summaryRows.map((row) => {
    const id = pickString(row, ["id"]);
    const sku = pickString(row, ["sku_code", "sku"]);
    const prices =
      (id ? priceRowsById.get(id) : undefined) ??
      (sku ? priceRowsBySku.get(sku.toUpperCase()) : undefined);

    return prices ? { ...row, ...prices } : row;
  });
}

async function readCompanies(context: SupabaseContext) {
  const companyRows = (await readRows(context.client, "companies")) ?? (await readRows(context.client, "customers"));

  if (!companyRows) {
    return null;
  }

  return companyRows.map(mapCompanyRow).filter(isDefined);
}

async function readOrderSummaries(context: SupabaseContext) {
  const orderRows = await readRows(context.client, "orders");

  if (!orderRows) {
    return null;
  }

  const companyRows = await readCompanies(context);
  const companyNames = new Map<string, string>();

  for (const company of companyRows ?? []) {
    companyNames.set(company.id, company.name);
  }

  const orderLineRows = (await readRows(context.client, "order_lines")) ?? (await readRows(context.client, "order_items"));
  const lineCounts = countLinesByOrder(orderLineRows ?? []);

  return orderRows.map((row) => mapOrderSummaryRow(row, companyNames, lineCounts)).filter(isDefined);
}

async function readRmaRequests(context: SupabaseContext) {
  const rmaRows = await readRows(context.client, "rma_requests");

  if (!rmaRows) {
    return null;
  }

  const lineRows = (await readRows(context.client, "order_lines")) ?? (await readRows(context.client, "order_items"));
  const linesById = new Map<string, DbRow>();

  for (const line of lineRows ?? []) {
    const id = pickString(line, ["id", "line_id", "order_item_id"]);
    if (id) {
      linesById.set(id, line);
    }
  }

  return rmaRows.map((row) => mapRmaRow(row, linesById)).filter(isDefined);
}

async function insertOrder(context: SupabaseContext, input: SaveOrderInput): Promise<SavedOrder | null> {
  return createRemoteOrderTransaction(context, input);
}

async function createRemoteOrderTransaction(
  context: SupabaseContext,
  input: SaveOrderInput
): Promise<SavedOrder | null> {
  const customerId = parseUuid(input.company.id);

  if (!customerId) {
    throw new RepositoryWriteError(
      409,
      "ORDER_COMPANY_CONTRACT_MISMATCH",
      "The selected company profile did not come from Supabase, so the remote order RPC cannot be called."
    );
  }

  const rpcArgs = {
    p_lines: input.lines.map((line) => ({
      sku_code: line.product.sku,
      quantity: line.quantity,
    })),
    p_customer_id: customerId,
    p_delivery_address: formatDeliveryAddress(input.deliveryAddress),
    p_customer_note: input.notes ?? "",
    p_shipping_method: "GLS/BRT 24-48h",
    p_shipping: centsToNumber(input.totals.shippingCents),
    p_fiscal: {
      payment_method: input.paymentMethod,
      purchase_order_number: input.purchaseOrderNumber ?? null,
      totals: {
        subtotal: centsToNumber(input.totals.subtotalCents),
        shipping: centsToNumber(input.totals.shippingCents),
        vat: centsToNumber(input.totals.vatCents),
        total: centsToNumber(input.totals.totalCents),
      },
      company_snapshot: {
        id: input.company.id,
        name: input.fiscal.companySnapshot.name,
        partita_iva: input.fiscal.companySnapshot.partitaIva,
        codice_fiscale: input.fiscal.companySnapshot.codiceFiscale,
        pec: input.fiscal.companySnapshot.pec,
        codice_destinatario: input.fiscal.companySnapshot.codiceDestinatario,
        price_list: input.company.priceList,
        address: input.fiscal.companySnapshot.address ?? input.deliveryAddress,
        delivery_address: input.deliveryAddress,
      },
    },
    p_vat_rate: dominantVatRate(input.lines),
  };

  try {
    const { data, error } = await context.client.rpc("create_order_transaction", rpcArgs);

    if (error) {
      throw new RepositoryWriteError(
        502,
        "ORDER_RPC_FAILED",
        "Supabase rejected the create_order_transaction RPC.",
        supabaseErrorDetails(error)
      );
    }

    const orderId = extractOrderId(data);

    if (!orderId) {
      throw new RepositoryWriteError(
        502,
        "ORDER_RPC_RESULT_INVALID",
        "Supabase create_order_transaction did not return an order id."
      );
    }

    const row = await readSingleRow(context.client, "orders", "id", orderId);
    const createdAt = pickString(row, ["created_at", "createdAt"]) ?? new Date().toISOString();

    return {
      id: pickString(row, ["order_no", "order_number", "reference"]) ?? orderId,
      status: normalizeOrderStatus(pickString(row, ["status", "payment_status"])),
      createdAt,
    };
  } catch (error) {
    if (error instanceof RepositoryWriteError) {
      throw error;
    }

    throw new RepositoryWriteError(
      502,
      "ORDER_RPC_UNAVAILABLE",
      "Supabase order RPC could not be reached.",
      error instanceof Error ? { message: error.message } : undefined
    );
  }
}

async function insertRmaRequest(context: SupabaseContext, input: SaveRmaInput): Promise<RmaRequest | null> {
  const companyId = input.orderId ? await readOrderCompanyId(context.client, input.orderId) : null;
  const now = new Date().toISOString();
  const payloads = [
    input.orderLineId
      ? {
          user_id: context.userId,
          order_line_id: input.orderLineId,
          sku_code: input.sku,
          quantity: input.quantity,
          status: "submitted",
          problem_type: input.reason,
          description: input.description,
          attachments: [],
        }
      : null,
    input.orderId
      ? {
          user_id: context.userId,
          order_no: input.orderId,
          sku_code: input.sku,
          status: "submitted",
          problem_type: input.reason,
          description: input.description,
          evidence_urls: [],
          quantity: input.quantity,
          tested_before_install: false,
          installed: false,
          has_physical_damage: false,
          requested_resolution: "replacement",
        }
      : null,
    companyId
      ? {
          order_id: input.orderId,
          company_id: companyId,
          status: "requested",
          quantity: input.quantity,
          reason: input.reason,
          description: input.description,
        }
      : null,
    companyId
      ? {
          order_id: input.orderId,
          customer_id: companyId,
          sku: input.sku,
          status: "requested",
          quantity: input.quantity,
          reason: input.reason,
          description: input.description,
        }
      : null,
    input.orderId
      ? {
          order_id: input.orderId,
          sku: input.sku,
          status: "requested",
          quantity: input.quantity,
          reason: input.reason,
          description: input.description,
        }
      : null,
  ].filter(isDefined);

  for (const payload of payloads) {
    const row = await insertRow(context.client, "rma_requests", payload);

    if (row) {
      return {
        id: pickString(row, ["id", "rma_id", "request_id"]) ?? `RMA-${Date.now()}`,
        orderId:
          pickString(row, ["order_id", "orderId", "order_no"]) ??
          input.orderId ??
          input.orderLineId ??
          "ORD-ND",
        sku: pickString(row, ["sku", "sku_code", "sku_snapshot"]) ?? input.sku,
        productName: input.productName ?? pickString(row, ["product_name", "name"]) ?? input.sku,
        status: normalizeRmaStatus(pickString(row, ["status"]) ?? "requested"),
        reason: pickString(row, ["reason", "problem_type"]) ?? input.reason,
        createdAt: formatItalianDate(pickString(row, ["created_at", "createdAt"]) ?? now),
        resolution: pickString(row, ["resolution", "description"]) ?? "In attesa di verifica laboratorio",
      };
    }
  }

  return null;
}

async function insertB2BApplication(
  client: SupabaseServerClient,
  input: B2BApplicationInput
): Promise<B2BApplication | null> {
  const now = new Date().toISOString();
  const remotePayload = {
    company_name: input.companyName,
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone ?? "",
    whatsapp: input.phone ?? "",
    vat_number: input.partitaIva,
    fiscal_code: input.codiceFiscale,
    sdi: input.codiceDestinatario ?? "",
    pec: input.pec ?? "",
    company_type: "repair_shop",
    registered_address: input.address ?? [input.city, input.province].filter(Boolean).join(" "),
    shipping_address: input.address ?? [input.city, input.province].filter(Boolean).join(" "),
    monthly_purchase: "",
    interested_categories: [],
    payment_needs: [],
    status: "submitted",
    review_note: "",
    accepts_terms: true,
    accepts_privacy: true,
    accepts_marketing: false,
  };
  const snakePayload = {
    company_name: input.companyName,
    partita_iva: input.partitaIva,
    codice_fiscale: input.codiceFiscale,
    pec: input.pec ?? null,
    codice_destinatario: input.codiceDestinatario ?? null,
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone ?? null,
    city: input.city,
    province: input.province,
    address: input.address ?? null,
    website: input.website ?? null,
    notes: input.notes ?? null,
    status: "submitted",
  };
  const camelPayload = {
    companyName: input.companyName,
    partitaIva: input.partitaIva,
    codiceFiscale: input.codiceFiscale,
    pec: input.pec ?? null,
    codiceDestinatario: input.codiceDestinatario ?? null,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone ?? null,
    city: input.city,
    province: input.province,
    address: input.address ?? null,
    website: input.website ?? null,
    notes: input.notes ?? null,
    status: "submitted",
  };

  for (const payload of [remotePayload, snakePayload, camelPayload]) {
    const inserted = await insertRowWithoutReturning(client, "b2b_applications", payload);

    if (inserted) {
      return {
        ...input,
        id: `B2B-${Date.now()}`,
        status: "submitted",
        createdAt: now,
      };
    }
  }

  return null;
}

async function readRows(
  client: SupabaseServerClient,
  table: string,
  select = "*",
  limit = 20000
): Promise<DbRow[] | null> {
  const pageSize = 1000;
  const rows: DbRow[] = [];

  try {
    while (rows.length < limit) {
      const from = rows.length;
      const to = Math.min(from + pageSize, limit) - 1;
      const { data, error } = await client.from(table).select(select).range(from, to);

      const pageRows = Array.isArray(data)
        ? (data as unknown[]).filter(isDbRow)
        : null;

      if (error || !pageRows) {
        return null;
      }

      rows.push(...pageRows);

      if (pageRows.length < to - from + 1) {
        break;
      }
    }

    return rows;
  } catch {
    return null;
  }
}

async function readOrderCompanyId(client: SupabaseServerClient, orderId: string) {
  const order = await readSingleRow(client, "orders", "id", orderId);

  return order ? pickString(order, ["company_id", "customer_id"]) : null;
}

async function readSingleRow(
  client: SupabaseServerClient,
  table: string,
  column: string,
  value: string
): Promise<DbRow | null> {
  try {
    const { data, error } = await client.from(table).select("*").eq(column, value).maybeSingle();

    const row = data as unknown;

    if (error || !isDbRow(row)) {
      return null;
    }

    return row;
  } catch {
    return null;
  }
}

async function insertRow(
  client: SupabaseServerClient,
  table: string,
  payload: Record<string, unknown>
): Promise<DbRow | null> {
  try {
    const { data, error } = await client.from(table).insert(payload).select("*").single();

    const row = data as unknown;

    if (error || !isDbRow(row)) {
      return null;
    }

    return row;
  } catch {
    return null;
  }
}

async function insertRowWithoutReturning(
  client: SupabaseServerClient,
  table: string,
  payload: Record<string, unknown>
) {
  try {
    const { error } = await client.from(table).insert(payload);
    return !error;
  } catch {
    return false;
  }
}

function mapProductRow(row: DbRow): RepositoryPartProduct | null {
  const sku = pickString(row, ["sku", "sku_code", "code", "product_sku", "part_number"]) ?? pickString(row, ["id"]);
  const name = pickString(row, ["name", "title", "product_name", "description"]) ?? sku;

  if (!sku || !name) {
    return null;
  }

  const category =
    pickString(row, ["category", "category_name", "type"]) ??
    pickNestedString(row, "categories", ["name"]) ??
    inferCategory(name);
  const brand =
    pickString(row, ["brand", "brand_name", "manufacturer"]) ??
    pickNestedString(row, "brands", ["name"]) ??
    "PartsPro";
  const stock =
    pickNumber(row, ["stock", "stock_qty", "stock_quantity", "available_qty", "available_quantity", "quantity"]) ??
    sumStock(row);
  const vatRate = pickNumber(row, ["vat_rate", "vatRate", "vat", "tax_rate"]) ?? 22;
  const price = pickNumber(row, ["price", "b2b_price", "wholesale_price", "net_price", "unit_price"]) ?? 0;
  const retailPrice = pickNumber(row, ["retail_price", "retailPrice", "msrp", "list_price"]) ?? price;
  const remoteId = pickString(row, ["id", "product_id", "uuid"]);
  const imagePath = pickString(row, ["image_url", "imageUrl", "image_path", "imagePath"]);
  const galleryImagePaths = readStringArray(row, ["gallery_image_urls", "galleryImageUrls", "gallery_image_paths", "galleryImagePaths"]);
  const imageUrl = resolveProductImageUrl(imagePath);
  const imageAlt = pickString(row, ["image_alt", "imageAlt"]);
  const galleryImageUrls = galleryImagePaths
    .map(resolveProductImageUrl)
    .filter(isDefined);

  return {
    sku: sku.toUpperCase(),
    slug:
      pickString(row, ["slug", "handle"]) ??
      slugify([brand, name, sku].filter(Boolean).join(" ")) ??
      sku.toLowerCase(),
    name,
    category: normalizeCategory(category),
    brand,
    grade: normalizeGrade(pickString(row, ["grade", "quality_grade", "quality", "condition"])),
    price,
    retailPrice,
    stock,
    status: normalizeStockStatus(pickString(row, ["status", "stock_status"]), stock),
    updatedAt: formatPartsProDateTime(pickString(row, ["updated_at", "updatedAt", "created_at", "createdAt"])),
    visual: normalizeVisual(pickString(row, ["visual", "part_type", "type"]) ?? category ?? name),
    compatibleWith: readCompatibility(row),
    warehouse: normalizeWarehouse(pickString(row, ["warehouse", "warehouse_name", "location"]) ?? readWarehouse(row)),
    moq: pickNumber(row, ["moq", "min_order_quantity", "minimum_order_quantity"]) ?? 1,
    vatRate,
    rmaDays: pickNumber(row, ["rma_days", "rmaDays", "warranty_days", "return_days"]) ?? 30,
    leadTime: pickString(row, ["lead_time", "leadTime", "delivery_time"]) ?? "24/48h Italia",
    tags: readStringArray(row, ["tags", "labels", "highlights"]),
    ...(imageUrl ? { imageUrl } : {}),
    ...(imageAlt ? { imageAlt } : {}),
    ...(galleryImageUrls.length > 0 ? { galleryImageUrls } : {}),
    ...(remoteId ? { remoteId } : {}),
  };
}

function mapCompanyRow(row: DbRow): CompanyProfile | null {
  const id = pickString(row, ["id", "company_id", "customer_id", "uuid"]);
  const name = pickString(row, ["name", "company_name", "business_name", "ragione_sociale"]);

  if (!id || !name) {
    return null;
  }

  const billingAddress = getObject(row, "billing_address") ?? getObject(row, "billingAddress");

  return {
    id,
    name,
    partitaIva: pickString(row, ["partita_iva", "partitaIva", "vat_number", "piva"]) ?? "",
    codiceFiscale: pickString(row, ["codice_fiscale", "codiceFiscale", "fiscal_code"]) ?? "",
    pec: pickString(row, ["pec", "certified_email"]) ?? "",
    codiceDestinatario: pickString(row, ["codice_destinatario", "codiceDestinatario", "sdi_code"]) ?? "",
    status: normalizeCompanyStatus(pickString(row, ["status"])),
    priceList: normalizePriceList(pickString(row, ["price_list", "priceList", "tier"])),
    city: pickString(row, ["city"]) ?? pickString(billingAddress, ["city"]) ?? "",
    province: pickString(row, ["province"]) ?? pickString(billingAddress, ["province"]) ?? "",
  };
}

function mapOrderSummaryRow(
  row: DbRow,
  companyNames: Map<string, string>,
  lineCounts: Map<string, number>
): OrderSummary | null {
  const rowId = pickString(row, ["id", "order_id"]);
  const id = pickString(row, ["order_no", "order_number", "reference"]) ?? rowId;

  if (!id) {
    return null;
  }

  const companyId = pickString(row, ["company_id", "customer_id"]);
  const totalNet = pickNumber(row, ["total_net"]);
  const vat = pickNumber(row, ["vat"]);
  const shipping = pickNumber(row, ["shipping"]);
  const total =
    pickNumber(row, ["total", "grand_total", "amount_total", "total_amount"]) ??
    (totalNet !== null || vat !== null || shipping !== null
      ? (totalNet ?? 0) + (vat ?? 0) + (shipping ?? 0)
      : null) ??
    centsToNumber(pickNumber(row, ["total_cents", "total_gross_cents"]) ?? 0);

  return {
    id,
    date: formatItalianDate(pickString(row, ["created_at", "createdAt", "order_date", "date"])),
    status: normalizeOrderStatus(pickString(row, ["status"])),
    company:
      pickString(row, ["company", "company_name", "customer_name", "business_name"]) ??
      (companyId ? companyNames.get(companyId) : undefined) ??
      "Cliente B2B",
    total,
    items:
      pickNumber(row, ["items", "items_count", "line_count", "total_items"]) ??
      lineCounts.get(id) ??
      (rowId ? lineCounts.get(rowId) : undefined) ??
      0,
  };
}

function mapRmaRow(row: DbRow, linesById: Map<string, DbRow>): RmaRequest | null {
  const id = pickString(row, ["id", "rma_id", "request_id"]);
  const lineId = pickString(row, ["order_line_id", "order_item_id", "line_id"]);
  const line = lineId ? linesById.get(lineId) : undefined;
  const orderId =
    pickString(row, ["order_id", "orderId", "order_no"]) ??
    (line ? pickString(line, ["order_id", "orderId"]) : null);

  if (!id || !orderId) {
    return null;
  }

  const sku =
    pickString(row, ["sku", "sku_code", "sku_snapshot"]) ??
    (line ? pickString(line, ["sku", "sku_code", "sku_snapshot"]) : null);

  return {
    id,
    orderId,
    sku: sku ?? "SKU-ND",
    productName:
      pickString(row, ["product_name", "name"]) ??
      (line ? pickString(line, ["product_name", "name_snapshot", "name"]) : null) ??
      "Ricambio",
    status: normalizeRmaStatus(pickString(row, ["status"])),
    reason: pickString(row, ["reason", "problem_type"]) ?? "Richiesta RMA",
    createdAt: formatItalianDate(pickString(row, ["created_at", "createdAt"])),
    resolution: pickString(row, ["resolution", "description"]) ?? "In attesa di verifica laboratorio",
  };
}

function countLinesByOrder(rows: DbRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const orderId = pickString(row, ["order_id", "orderId"]);
    if (orderId) {
      counts.set(orderId, (counts.get(orderId) ?? 0) + 1);
    }
  }

  return counts;
}

function readCompatibility(row: DbRow) {
  const direct = readStringArray(row, [
    "compatible_with",
    "compatibleWith",
    "compatible_models",
    "compatibility_models",
    "model_codes",
    "models",
  ]);
  const model = pickString(row, ["model", "model_code"]);

  if (model) {
    direct.push(model);
  }

  const compatibilityRows = getArray(row, "product_compatibility");

  for (const item of compatibilityRows) {
    if (!isDbRow(item)) {
      continue;
    }

    const model = pickNestedString(item, "device_models", ["name"]) ?? pickString(item, ["model_name", "name"]);
    if (model) {
      direct.push(model);
    }
  }

  return [...new Set(direct)];
}

function readWarehouse(row: DbRow) {
  const movements = getArray(row, "stock_movements");
  const movement = movements.find(isDbRow);

  if (!movement) {
    return null;
  }

  return (
    pickString(movement, ["warehouse", "location"]) ??
    pickNestedString(movement, "inventory_locations", ["city", "name"])
  );
}

function sumStock(row: DbRow) {
  const movements = getArray(row, "stock_movements");
  const total = movements.reduce((sum, movement) => {
    if (!isDbRow(movement)) {
      return sum;
    }

    return sum + (pickNumber(movement, ["quantity"]) ?? 0);
  }, 0);

  return Math.max(total, 0);
}

function pickString(row: DbRow | null | undefined, keys: string[]) {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function pickNumber(row: DbRow | null | undefined, keys: string[]) {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function pickNestedString(row: DbRow, key: string, nestedKeys: string[]) {
  const value = row[key];

  if (Array.isArray(value)) {
    const first = value.find(isDbRow);
    return first ? pickString(first, nestedKeys) : null;
  }

  return isDbRow(value) ? pickString(value, nestedKeys) : null;
}

function readStringArray(row: DbRow, keys: string[]) {
  const values: string[] = [];

  for (const key of keys) {
    const value = row[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim().length > 0) {
          values.push(item.trim());
        }
      }
    }

    if (typeof value === "string" && value.trim().length > 0) {
      values.push(
        ...value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      );
    }
  }

  return values;
}

function resolveProductImageUrl(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");

  if (!supabaseUrl) {
    return null;
  }

  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${productImagesBucket}/`;

  if (normalized.startsWith(publicPrefix)) {
    return normalized;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return null;
  }

  return `${publicPrefix}${normalized.replace(/^\/+/, "")}`;
}

function getObject(row: DbRow, key: string): DbRow | null {
  const value = row[key];
  return isDbRow(value) ? value : null;
}

function getArray(row: DbRow, key: string) {
  const value = row[key];
  return Array.isArray(value) ? value : [];
}

function normalizeGrade(value: string | null): ProductGrade {
  if (value === "A+" || value === "A" || value === "B" || value === "Refurbished") {
    return value;
  }

  const normalized = value?.toLowerCase();

  if (normalized === "refurbished" || normalized === "ricondizionato") {
    return "Refurbished";
  }

  return "A";
}

function normalizeStockStatus(value: string | null, stock: number): StockStatus {
  if (value === "In Stock" || value === "Low Stock" || value === "Out of Stock") {
    return value;
  }

  const normalized = value?.toLowerCase();

  if (normalized?.includes("out") || normalized?.includes("esaurito") || stock <= 0) {
    return "Out of Stock";
  }

  if (normalized?.includes("low") || normalized?.includes("scarso") || stock <= 5) {
    return "Low Stock";
  }

  return "In Stock";
}

function normalizeVisual(value: string): PartVisual {
  const normalized = value.toLowerCase();

  if (normalized.includes("battery") || normalized.includes("batter")) {
    return "battery";
  }

  if (normalized.includes("cover")) {
    return "cover";
  }

  if (normalized.includes("port") || normalized.includes("connet")) {
    return "port";
  }

  if (normalized.includes("camera") || normalized.includes("foto")) {
    return "camera";
  }

  if (normalized.includes("flex") || normalized.includes("flat")) {
    return "flex";
  }

  if (normalized.includes("speaker") || normalized.includes("altoparl")) {
    return "speaker";
  }

  if (normalized.includes("frame")) {
    return "frame";
  }

  return "screen";
}

function inferCategory(value: string) {
  const visual = normalizeVisual(value);
  const labels: Record<PartVisual, string> = {
    screen: "Schermi",
    battery: "Batterie",
    cover: "Back Cover",
    port: "Connettori",
    camera: "Fotocamere",
    flex: "Flat Cable",
    speaker: "Speaker",
    frame: "Middle Frame",
  };

  return labels[visual];
}

function normalizeCategory(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("screen") || normalized.includes("display")) {
    return "Schermi";
  }

  if (normalized.includes("batter")) {
    return "Batterie";
  }

  if (normalized.includes("back") || normalized.includes("cover")) {
    return "Back Cover";
  }

  if (normalized.includes("charging") || normalized.includes("port") || normalized.includes("connet")) {
    return "Connettori";
  }

  if (normalized.includes("camera") || normalized.includes("foto")) {
    return "Fotocamere";
  }

  if (normalized.includes("flex") || normalized.includes("flat")) {
    return "Flat Cable";
  }

  if (normalized.includes("speaker") || normalized.includes("altoparl")) {
    return "Speaker";
  }

  if (normalized.includes("frame")) {
    return "Middle Frame";
  }

  return value;
}

function normalizeWarehouse(value: string | null): "Milano" | "Roma" | "Shenzhen" {
  const normalized = value?.toLowerCase() ?? "";

  if (normalized.includes("roma") || normalized.includes("rome")) {
    return "Roma";
  }

  if (normalized.includes("shenzhen") || normalized.includes("china")) {
    return "Shenzhen";
  }

  return "Milano";
}

function normalizeCompanyStatus(value: string | null): CompanyStatus {
  if (value === "pending" || value === "approved" || value === "rejected" || value === "suspended") {
    return value;
  }

  if (value === "active") {
    return "approved";
  }

  return "pending";
}

function normalizeOrderStatus(value: string | null): OrderStatus {
  if (
    value === "draft" ||
    value === "pending_payment" ||
    value === "paid" ||
    value === "picking" ||
    value === "shipped" ||
    value === "delivered" ||
    value === "cancelled"
  ) {
    return value;
  }

  if (value === "submitted" || value === "bank_waiting") {
    return "pending_payment";
  }

  if (value === "accepted") {
    return "paid";
  }

  if (value === "packed") {
    return "picking";
  }

  if (value === "completed") {
    return "delivered";
  }

  return "pending_payment";
}

function normalizeRmaStatus(value: string | null): RmaStatus {
  if (
    value === "requested" ||
    value === "approved" ||
    value === "rejected" ||
    value === "received" ||
    value === "replaced" ||
    value === "refunded"
  ) {
    return value;
  }

  if (value === "submitted") {
    return "requested";
  }

  return "requested";
}

function normalizePriceList(value: string | null): "Standard" | "Pro" | "Partner" {
  const normalized = value?.toLowerCase();

  if (normalized === "gold" || normalized === "partner") {
    return "Partner";
  }

  if (normalized === "silver" || normalized === "pro") {
    return "Pro";
  }

  return "Standard";
}

function emptyResult<T>(data: T, warning?: string): RepositoryResult<T> {
  return warning ? { data, source: "empty", warning } : { data, source: "empty" };
}

function parseUuid(value: string) {
  return uuidPattern.test(value) ? value : null;
}

function formatDeliveryAddress(address: DeliveryAddressSnapshot) {
  return [
    address.street,
    [address.zip, address.city].filter(Boolean).join(" "),
    address.province,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function dominantVatRate(lines: PreparedOrderLine[]) {
  const rates = [...new Set(lines.map((line) => line.product.vatRate))];
  return rates.length === 1 ? rates[0] : 22;
}

function extractOrderId(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (isDbRow(value)) {
    return pickString(value, ["id", "order_id"]);
  }

  return null;
}

function supabaseErrorDetails(error: unknown) {
  if (!isDbRow(error)) {
    return undefined;
  }

  const details = {
    code: pickString(error, ["code"]),
    message: pickString(error, ["message"]),
    details: pickString(error, ["details"]),
    hint: pickString(error, ["hint"]),
  };

  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== null));
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : null;
}

function isDbRow(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
