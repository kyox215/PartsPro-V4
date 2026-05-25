import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  centsToNumber,
  formatItalianDate,
  formatPartsProDateTime,
} from "@/lib/partspro-api";
import {
  deviceModels,
  type CompanyProfile,
  type CompanyStatus,
  type DeviceModelGroup,
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
const adminProductSelect =
  "id, sku_code, name, brand, model, model_code, model_codes, category, quality_grade, stock_status, moq, cost_price, retail_price, b2b_price, vat_mode, warranty_days, weight_gram, stock_qty, location, batch_code, supplier, compatibility_models, highlights, status, updated_at, image_path, image_alt, gallery_image_paths, created_at";
const adminCustomerSelect =
  "id, user_id, company_name, contact_name, email, vat_number, fiscal_code, sdi, pec, phone, registered_address, billing_address, shipping_address, tier, price_group_id, status, monthly_purchase, orders_count, revenue, credit_limit, payment_terms, profile_completed_at, last_order_at, created_at, updated_at";
const adminB2BApplicationSelect =
  "id, company_name, contact_name, email, phone, vat_number, fiscal_code, sdi, pec, registered_address, shipping_address, monthly_purchase, requested_price_group_id, status, review_note, approved_customer_id, submitted_at, reviewed_at";

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

export type AdminCatalogStatus = "active" | "draft" | "hidden" | "blocked";
export type AdminCustomerStatus = "active" | "pending" | "suspended";
export type AdminB2BApplicationStatus = "submitted" | "approved" | "rejected";
export type AdminOrderDbStatus =
  | "submitted"
  | "accepted"
  | "picking"
  | "packed"
  | "shipped"
  | "completed"
  | "cancelled";
export type AdminPaymentStatus = "pending" | "paid" | "bank_waiting" | "failed";

export type AdminProduct = RepositoryPartProduct & {
  id: string;
  catalogStatus: AdminCatalogStatus;
  stockStatus: StockStatus;
  stockQty: number;
  b2bPrice: number;
  costPrice: number;
  vatMode: string;
  warrantyDays: number;
  weightGram: number;
  model?: string;
  modelCode?: string;
  modelCodes: string[];
  batchCode?: string;
  supplier?: string;
  imagePath?: string;
  galleryImagePaths: string[];
  createdAt: string;
};

export type AdminProductQueryInput = {
  brand?: string;
  category?: string;
  catalogStatus?: AdminCatalogStatus;
  grade?: ProductGrade;
  limit: number;
  offset: number;
  q?: string;
  sort: "name" | "stock_desc" | "updated_desc" | "created_desc";
  stockStatus?: StockStatus;
  warehouse?: PartProduct["warehouse"];
};

export type AdminProductPage = {
  products: AdminProduct[];
  total: number;
};

export type AdminProductWriteInput = {
  sku: string;
  name: string;
  category: string;
  brand: string;
  grade: ProductGrade;
  price: number;
  retailPrice?: number;
  costPrice?: number;
  stock: number;
  moq: number;
  warehouse: PartProduct["warehouse"];
  compatibleWith?: string[];
  tags?: string[];
  catalogStatus?: AdminCatalogStatus;
  stockStatus?: StockStatus;
  vatMode?: string;
  rmaDays?: number;
  weightGram?: number;
  model?: string;
  modelCode?: string;
  modelCodes?: string[];
  batchCode?: string;
  supplier?: string;
  imagePath?: string;
  imageAlt?: string;
  galleryImagePaths?: string[];
};

export type AdminProductPatchInput = Partial<
  Omit<AdminProductWriteInput, "sku">
> & {
  sku?: string;
};

export type AdminCustomer = CompanyProfile & {
  customerStatus: AdminCustomerStatus;
  contactName: string;
  email: string;
  phone: string;
  registeredAddress: string;
  billingAddress: string;
  shippingAddress: string;
  tier: string;
  priceGroupId: string | null;
  monthlyPurchase: string;
  ordersCount: number;
  revenue: number;
  creditLimit: number;
  paymentTerms: string;
  profileCompletedAt: string | null;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCustomerQueryInput = {
  limit: number;
  offset: number;
  q?: string;
  sort: "created_desc" | "name" | "revenue_desc" | "last_order_desc";
  status?: AdminCustomerStatus;
  tier?: string;
};

export type AdminCustomerPage = {
  customers: AdminCustomer[];
  total: number;
};

export type AdminCustomerPatchInput = {
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
  status?: AdminCustomerStatus;
  tier?: string;
  priceGroupId?: string | null;
  monthlyPurchase?: string;
  creditLimit?: number;
  paymentTerms?: string;
};

export type AdminB2BApplication = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  vatNumber: string;
  fiscalCode: string;
  sdi: string;
  pec: string;
  registeredAddress: string;
  shippingAddress: string;
  monthlyPurchase: string;
  requestedPriceGroupId: string | null;
  status: AdminB2BApplicationStatus;
  reviewNote: string;
  approvedCustomerId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type AdminB2BApplicationQueryInput = {
  limit: number;
  offset: number;
  q?: string;
  sort: "submitted_desc" | "submitted_asc";
  status?: AdminB2BApplicationStatus;
};

export type AdminB2BApplicationPage = {
  applications: AdminB2BApplication[];
  total: number;
};

export type AdminB2BApplicationReviewInput = {
  id: string;
  decision: "approve" | "reject";
  note?: string;
  tier?: string;
  priceGroupId?: string | null;
  creditLimit?: number;
  paymentTerms?: string;
};

export type AdminB2BApplicationReviewResult = {
  application: AdminB2BApplication;
  customer: AdminCustomer | null;
};

export type AdminOrderLine = {
  id: string;
  sku: string;
  productName: string;
  qualityGrade: string;
  quantity: number;
  unitPrice: number;
  lineNet: number;
  stockStatus: string;
  reservedQty: number;
  fulfilledQty: number;
  batchCode: string | null;
  location: string | null;
  reservationAllocations: unknown[];
};

export type AdminOrderEvent = {
  id: string;
  eventType: string;
  fromStatus: AdminOrderDbStatus | null;
  toStatus: AdminOrderDbStatus | null;
  note: string;
  metadata: unknown;
  actorId: string | null;
  createdAt: string;
};

export type AdminOrder = {
  id: string;
  orderNo: string;
  status: AdminOrderDbStatus;
  uiStatus: OrderStatus;
  paymentStatus: AdminPaymentStatus;
  stockRisk: string;
  totalNet: number;
  vat: number;
  shipping: number;
  total: number;
  shippingMethod: string;
  carrier: string;
  trackingCode: string;
  fiscal: unknown;
  deliveryAddress: string;
  customerNote: string;
  staffNote: string;
  customer: {
    id: string | null;
    name: string;
    tier: string;
    status: AdminCustomerStatus | null;
  };
  lineCount: number;
  lines?: AdminOrderLine[];
  events?: AdminOrderEvent[];
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderQueryInput = {
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
  paymentStatus?: AdminPaymentStatus;
  q?: string;
  sort: "date_desc" | "date_asc" | "total_desc" | "total_asc";
  status?: AdminOrderDbStatus;
};

export type AdminOrderPage = {
  orders: AdminOrder[];
  total: number;
};

export type AdminOrderStatusTransitionInput = {
  orderId: string;
  status: AdminOrderDbStatus | OrderStatus;
  note?: string;
  metadata?: Record<string, unknown>;
};

export type AdminOrderStatusTransitionResult = {
  order: AdminOrder;
  transition: unknown;
};

export type AdminOrderOperationsPatchInput = {
  orderId: string;
  carrier?: string;
  note?: string;
  paymentStatus?: AdminPaymentStatus | "unpaid" | "authorized" | "refunded";
  tracking?: string;
  warehouse?: PartProduct["warehouse"];
};

export type AdminOrderOperationsPatchResult = {
  order: AdminOrder;
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

export type CatalogProductQueryInput = {
  brand?: string;
  category?: string;
  grade?: ProductGrade;
  limit: number;
  minStock?: number;
  model?: string;
  offset: number;
  q?: string;
  sort: "name" | "stock_desc" | "updated_desc";
  status?: StockStatus;
  warehouse?: PartProduct["warehouse"];
};

export type CatalogProductPage = {
  products: RepositoryPartProduct[];
  total: number;
};

type CatalogProductPageOptions = {
  includeBuyerPrices?: boolean;
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

export async function getCatalogProductBySkuOrSlug(
  value: string
): Promise<RepositoryResult<RepositoryPartProduct | null>> {
  const lookup = value.trim();

  if (!lookup) {
    return emptyResult(null, "Product identifier is empty.");
  }

  const supabaseResult = await withSupabaseResult((context) =>
    readCatalogProductBySkuOrSlug(context.client, lookup)
  );
  const publicSupabaseResult =
    supabaseResult?.data === undefined || supabaseResult.data === null
      ? await readPublicCatalogProduct(lookup)
      : null;
  const directResult = supabaseResult?.data ? supabaseResult : publicSupabaseResult;

  if (directResult?.data) {
    return directResult;
  }

  if (shouldFallbackToCatalogSlugLookup(lookup)) {
    const catalog = await listCatalogProducts();
    const legacyProduct =
      catalog.data.find((item) => item.sku === lookup.toUpperCase() || item.slug === lookup) ??
      null;

    return { ...catalog, data: legacyProduct };
  }

  return (
    supabaseResult ??
    publicSupabaseResult ??
    emptyResult(
      null,
      isSupabaseConfigured()
        ? "Supabase product could not be read; no local catalog is available."
        : "Supabase is not configured; no local catalog is available."
    )
  );
}

export async function pageCatalogProducts(
  query: CatalogProductQueryInput,
  options: CatalogProductPageOptions = {}
): Promise<RepositoryResult<CatalogProductPage>> {
  const supabaseResult = await readPublicCatalogProductPage(query, options);

  return (
    supabaseResult ??
    emptyResult(
      { products: [], total: 0 },
      isSupabaseConfigured()
        ? "Supabase catalog could not be read; no local catalog is available."
        : "Supabase is not configured; no local catalog is available."
    )
  );
}

export async function listCatalogModelGroups(): Promise<
  RepositoryResult<DeviceModelGroup[]>
> {
  const supabaseResult = await readPublicCatalogModelGroups();

  return (
    supabaseResult ??
    emptyResult(
      deviceModels,
      isSupabaseConfigured()
        ? "Supabase catalog models could not be read; using local catalog model fallback."
        : "Supabase is not configured; using local catalog model fallback."
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

async function readPublicCatalogProductPage(
  query: CatalogProductQueryInput,
  options: CatalogProductPageOptions = {}
): Promise<RepositoryResult<CatalogProductPage> | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const client = await createClient();
    const page =
      (await readCatalogProductPageFromTable(
        client,
        "catalog_public_summary",
        "*",
        query,
        options
      )) ??
      (await readCatalogProductPageFromTable(
        client,
        "products",
        "id, sku_code, name, brand, model, model_code, model_codes, category, quality_grade, stock_status, moq, retail_price, b2b_price, vat_mode, warranty_days, stock_qty, location, compatibility_models, highlights, status, updated_at, image_path, image_alt, gallery_image_paths",
        query,
        options
      ));

    return page ? { data: page, source: "supabase" } : null;
  } catch {
    return null;
  }
}

async function readPublicCatalogModelGroups(): Promise<
  RepositoryResult<DeviceModelGroup[]> | null
> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const client = await createClient();
    const rows =
      (await readRows(
        client,
        "catalog_public_summary",
        "brand, compatibility_models"
      )) ??
      (await readRows(
        client,
        "products",
        "brand, model, model_code, model_codes, compatibility_models, status"
      ));

    if (!rows) {
      return null;
    }

    const groups = buildDeviceModelGroupsFromRows(rows);

    return groups.length > 0 ? { data: groups, source: "supabase" } : null;
  } catch {
    return null;
  }
}

async function readPublicCatalogProduct(
  value: string
): Promise<RepositoryResult<RepositoryPartProduct | null> | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const client = await createClient();
    const data = await readCatalogProductBySkuOrSlug(client, value);
    return { data, source: "supabase" };
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

export async function listAdminProducts(
  query: AdminProductQueryInput
): Promise<RepositoryResult<AdminProductPage>> {
  const context = await requireSupabaseContext();
  const page = await readAdminProductPage(context.client, query);

  if (!page) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_PRODUCTS_READ_UNAVAILABLE",
      "Admin product data could not be read from Supabase."
    );
  }

  return { data: page, source: "supabase" };
}

export async function getAdminProduct(
  sku: string
): Promise<RepositoryResult<AdminProduct | null>> {
  const context = await requireSupabaseContext();
  const product = await readAdminProduct(context.client, sku);

  return { data: product, source: "supabase" };
}

export async function createAdminProduct(
  input: AdminProductWriteInput
): Promise<RepositoryResult<AdminProduct>> {
  const context = await requireSupabaseContext();
  const sku = normalizeSku(input.sku);
  const existing = await readAdminProduct(context.client, sku);

  if (existing) {
    throw new RepositoryWriteError(
      409,
      "ADMIN_PRODUCT_SKU_EXISTS",
      "A product with this SKU already exists.",
      { sku }
    );
  }

  const payload = buildProductPayload({ ...input, sku }, false);
  const row = await insertRow(context.client, "products", payload);

  if (!row) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_PRODUCT_CREATE_FAILED",
      "Supabase could not create the product."
    );
  }

  await syncProductInventoryItem(context.client, row, payload);

  const product = mapAdminProductRow(row);

  if (!product) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_PRODUCT_RESULT_INVALID",
      "Supabase returned an invalid product row."
    );
  }

  return { data: product, source: "supabase" };
}

export async function updateAdminProduct(
  sku: string,
  input: AdminProductPatchInput
): Promise<RepositoryResult<AdminProduct>> {
  const context = await requireSupabaseContext();
  const current = await readAdminProduct(context.client, sku);

  if (!current) {
    throw new RepositoryWriteError(
      404,
      "ADMIN_PRODUCT_NOT_FOUND",
      "Product was not found.",
      { sku }
    );
  }

  const payload = buildProductPayload(input, true);

  if (Object.keys(payload).length === 0) {
    return { data: current, source: "supabase" };
  }

  const row = await updateSingleRow(
    context.client,
    "products",
    "sku_code",
    current.sku,
    payload,
    adminProductSelect
  );

  if (!row) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_PRODUCT_UPDATE_FAILED",
      "Supabase could not update the product."
    );
  }

  await syncProductInventoryItem(context.client, row, payload);

  const product = mapAdminProductRow(row);

  if (!product) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_PRODUCT_RESULT_INVALID",
      "Supabase returned an invalid product row."
    );
  }

  return { data: product, source: "supabase" };
}

export async function hideAdminProduct(
  sku: string
): Promise<RepositoryResult<AdminProduct>> {
  return updateAdminProduct(sku, {
    catalogStatus: "hidden",
    stockStatus: "Out of Stock",
  });
}

export async function listAdminCustomers(
  query: AdminCustomerQueryInput
): Promise<RepositoryResult<AdminCustomerPage>> {
  const context = await requireSupabaseContext();
  const page = await readAdminCustomerPage(context.client, query);

  if (!page) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_CUSTOMERS_READ_UNAVAILABLE",
      "Admin customer data could not be read from Supabase."
    );
  }

  return { data: page, source: "supabase" };
}

export async function getAdminCustomer(
  id: string
): Promise<RepositoryResult<AdminCustomer | null>> {
  const context = await requireSupabaseContext();
  const row = await readSingleRow(context.client, "customers", "id", id, adminCustomerSelect);

  return {
    data: row ? mapAdminCustomerRow(row) : null,
    source: "supabase",
  };
}

export async function updateAdminCustomer(
  id: string,
  input: AdminCustomerPatchInput
): Promise<RepositoryResult<AdminCustomer>> {
  const context = await requireSupabaseContext();
  const payload = buildCustomerPayload(input);

  if (Object.keys(payload).length === 0) {
    const current = await getAdminCustomer(id);

    if (!current.data) {
      throw new RepositoryWriteError(
        404,
        "ADMIN_CUSTOMER_NOT_FOUND",
        "Customer was not found.",
        { id }
      );
    }

    return { data: current.data, source: current.source };
  }

  const row = await updateSingleRow(
    context.client,
    "customers",
    "id",
    id,
    payload,
    adminCustomerSelect
  );

  if (!row) {
    throw new RepositoryWriteError(
      404,
      "ADMIN_CUSTOMER_NOT_FOUND",
      "Customer was not found.",
      { id }
    );
  }

  const customer = mapAdminCustomerRow(row);

  if (!customer) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_CUSTOMER_RESULT_INVALID",
      "Supabase returned an invalid customer row."
    );
  }

  return { data: customer, source: "supabase" };
}

export async function listAdminB2BApplications(
  query: AdminB2BApplicationQueryInput
): Promise<RepositoryResult<AdminB2BApplicationPage>> {
  const context = await requireSupabaseContext();
  const page = await readAdminB2BApplicationPage(context.client, query);

  if (!page) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_B2B_APPLICATIONS_READ_UNAVAILABLE",
      "B2B application data could not be read from Supabase."
    );
  }

  return { data: page, source: "supabase" };
}

export async function reviewAdminB2BApplication(
  input: AdminB2BApplicationReviewInput
): Promise<RepositoryResult<AdminB2BApplicationReviewResult>> {
  const context = await requireSupabaseContext();
  const result = await reviewB2BApplication(context.client, input);

  return { data: result, source: "supabase" };
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

export async function listAdminOrders(
  query: AdminOrderQueryInput
): Promise<RepositoryResult<AdminOrderPage>> {
  const context = await requireSupabaseContext();
  const page = await readAdminOrderPage(context.client, query);

  if (!page) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_ORDERS_READ_UNAVAILABLE",
      "Admin order data could not be read from Supabase."
    );
  }

  return { data: page, source: "supabase" };
}

export async function getAdminOrder(
  orderId: string
): Promise<RepositoryResult<AdminOrder | null>> {
  const context = await requireSupabaseContext();
  const order = await readAdminOrderDetail(context.client, orderId);

  return { data: order, source: "supabase" };
}

export async function transitionAdminOrderStatus(
  input: AdminOrderStatusTransitionInput
): Promise<RepositoryResult<AdminOrderStatusTransitionResult>> {
  const context = await requireSupabaseContext();
  const orderRow = await readOrderByIdOrNumber(context.client, input.orderId);
  const orderId = pickString(orderRow, ["id"]);

  if (!orderId) {
    throw new RepositoryWriteError(
      404,
      "ADMIN_ORDER_NOT_FOUND",
      "Order was not found.",
      { orderId: input.orderId }
    );
  }

  const nextStatus = normalizeAdminOrderDbStatus(input.status);

  if (!nextStatus) {
    throw new RepositoryWriteError(
      400,
      "ADMIN_ORDER_STATUS_INVALID",
      "Order status is not valid.",
      { status: input.status }
    );
  }

  const { data, error } = await context.client.rpc("admin_transition_order_status", {
    p_order_id: orderId,
    p_status: nextStatus,
    p_note: input.note ?? "",
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    throw new RepositoryWriteError(
      409,
      "ADMIN_ORDER_STATUS_TRANSITION_FAILED",
      "Supabase rejected the order status transition.",
      supabaseErrorDetails(error)
    );
  }

  const order = await readAdminOrderDetail(context.client, orderId);

  if (!order) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_ORDER_RESULT_INVALID",
      "Supabase returned an invalid order after the status transition."
    );
  }

  return {
    data: {
      order,
      transition: data,
    },
    source: "supabase",
  };
}

export async function updateAdminOrderOperations(
  input: AdminOrderOperationsPatchInput
): Promise<RepositoryResult<AdminOrderOperationsPatchResult>> {
  const context = await requireSupabaseContext();
  const orderRow = await readOrderByIdOrNumber(context.client, input.orderId);
  const orderId = pickString(orderRow, ["id"]);

  if (!orderId) {
    throw new RepositoryWriteError(
      404,
      "ADMIN_ORDER_NOT_FOUND",
      "Order was not found.",
      { orderId: input.orderId }
    );
  }

  const orderPayload: Record<string, unknown> = {};

  assignDefined(orderPayload, "carrier", trimOptional(input.carrier));
  assignDefined(orderPayload, "tracking_code", input.tracking);
  assignDefined(orderPayload, "payment_status", normalizeAdminPaymentStatusForWrite(input.paymentStatus));

  if (input.note) {
    assignDefined(orderPayload, "staff_note", input.note);
  }

  if (Object.keys(orderPayload).length > 0) {
    orderPayload.updated_at = new Date().toISOString();
    const updated = await updateSingleRow(
      context.client,
      "orders",
      "id",
      orderId,
      orderPayload
    );

    if (!updated) {
      throw new RepositoryWriteError(
        409,
        "ADMIN_ORDER_OPERATIONS_UPDATE_FAILED",
        "Supabase could not update order operations fields.",
        { orderId }
      );
    }
  }

  if (input.warehouse) {
    const updatedLines = await updateRowsByColumn(
      context.client,
      "order_lines",
      "order_id",
      orderId,
      { location: input.warehouse }
    );

    if (!updatedLines) {
      throw new RepositoryWriteError(
        409,
        "ADMIN_ORDER_WAREHOUSE_UPDATE_FAILED",
        "Supabase could not update order line warehouse.",
        { orderId, warehouse: input.warehouse }
      );
    }
  }

  if (Object.keys(orderPayload).length > 0 || input.warehouse) {
    await insertRowWithoutReturning(context.client, "order_events", {
      order_id: orderId,
      event_type: "operations_updated",
      actor_id: context.userId,
      note: input.note ?? "Admin operations fields updated",
      metadata: {
        carrier: input.carrier ?? null,
        payment_status: input.paymentStatus ?? null,
        tracking: input.tracking ?? null,
        warehouse: input.warehouse ?? null,
      },
    });
  }

  const order = await readAdminOrderDetail(context.client, orderId);

  if (!order) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_ORDER_RESULT_INVALID",
      "Supabase returned an invalid order after the operations update."
    );
  }

  return {
    data: { order },
    source: "supabase",
  };
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

async function withSupabaseResult<T>(
  reader: (context: SupabaseContext) => Promise<T>
): Promise<RepositoryResult<T> | null> {
  const context = await getSupabaseContext();

  if (!context) {
    return null;
  }

  try {
    return { data: await reader(context), source: "supabase" };
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

async function readCatalogProductBySkuOrSlug(
  client: SupabaseServerClient,
  value: string
): Promise<RepositoryPartProduct | null> {
  const viewProduct = await readCatalogProductFromViews(client, value);

  if (viewProduct) {
    return viewProduct;
  }

  const productRows = await readMatchingRows(
    client,
    "products",
    "id, sku_code, name, brand, model, model_code, model_codes, category, quality_grade, stock_status, moq, retail_price, b2b_price, vat_mode, warranty_days, stock_qty, location, compatibility_models, highlights, status, updated_at, image_path, image_alt, gallery_image_paths",
    "sku_code",
    catalogLookupCandidates(value),
    1
  );
  const productRow = productRows?.[0];

  return productRow ? mapProductRow(productRow) : null;
}

async function readCatalogProductPageFromTable(
  client: SupabaseServerClient,
  table: "catalog_public_summary" | "products",
  select: string,
  query: CatalogProductQueryInput,
  options: CatalogProductPageOptions = {}
): Promise<CatalogProductPage | null> {
  const from = Math.max(query.offset, 0);
  const to = from + Math.max(query.limit, 1) - 1;

  try {
    let request = client.from(table).select(select, { count: "exact" });

    if (table === "products") {
      request = request.eq("status", "active");
    }

    if (query.brand) {
      request = request.eq("brand", query.brand);
    }

    if (query.category) {
      request = request.eq("category", query.category);
    }

    if (query.grade) {
      request = request.eq("quality_grade", query.grade);
    }

    if (query.minStock !== undefined) {
      request = request.gte("stock_qty", query.minStock);
    }

    if (query.model) {
      request = request.contains("compatibility_models", [query.model]);
    }

    if (query.q) {
      const search = sanitizePostgrestSearchTerm(query.q);
      request = request.or(
        `name.ilike.%${search}%,sku_code.ilike.%${search}%,brand.ilike.%${search}%,category.ilike.%${search}%`
      );
    }

    if (query.status) {
      request = request.eq("stock_status", stockStatusToDbValue(query.status));
    }

    if (query.warehouse) {
      request = request.eq("location", query.warehouse);
    }

    switch (query.sort) {
      case "stock_desc":
        request = request.order("stock_qty", { ascending: false });
        break;
      case "updated_desc":
        request = request.order("updated_at", { ascending: false });
        break;
      case "name":
      default:
        request = request.order("name", { ascending: true });
        break;
    }

    const { data, error, count } = await request.range(from, to);
    const rows = Array.isArray(data)
      ? (data as unknown[]).filter(isDbRow)
      : null;

    if (error || !rows) {
      return null;
    }

    const pricedRows =
      options.includeBuyerPrices && table === "catalog_public_summary"
        ? await mergeCatalogBuyerPriceRows(client, rows)
        : rows;

    return {
      products: pricedRows.map(mapProductRow).filter(isDefined),
      total: count ?? rows.length,
    };
  } catch {
    return null;
  }
}

async function mergeCatalogBuyerPriceRows(
  client: SupabaseServerClient,
  rows: DbRow[]
) {
  const priceRows = await readCatalogBuyerPriceRowsForProducts(client, rows);

  if (priceRows.length === 0) {
    return rows;
  }

  const priceRowsById = new Map<string, DbRow>();
  const priceRowsBySku = new Map<string, DbRow>();

  for (const row of priceRows) {
    const id = pickString(row, ["id"]);
    const sku = pickString(row, ["sku_code", "sku"]);

    if (id) {
      priceRowsById.set(id, row);
    }

    if (sku) {
      priceRowsBySku.set(sku.toUpperCase(), row);
    }
  }

  return rows.map((row) => {
    const id = pickString(row, ["id"]);
    const sku = pickString(row, ["sku_code", "sku"]);
    const prices =
      (id ? priceRowsById.get(id) : undefined) ??
      (sku ? priceRowsBySku.get(sku.toUpperCase()) : undefined);

    return prices ? { ...row, ...prices } : row;
  });
}

async function readCatalogBuyerPriceRowsForProducts(
  client: SupabaseServerClient,
  productRows: DbRow[]
) {
  const ids = uniqueDefinedStrings(
    productRows.map((row) => pickString(row, ["id"]))
  );
  const skus = uniqueDefinedStrings(
    productRows.map((row) => pickString(row, ["sku_code", "sku"]))
  );
  const priceRows: DbRow[] = [];

  try {
    if (ids.length > 0) {
      const { data, error } = await client
        .from("catalog_buyer_prices")
        .select("*")
        .in("id", ids);

      if (!error && Array.isArray(data)) {
        priceRows.push(...data.filter(isDbRow));
      }
    }

    if (skus.length > 0) {
      const { data, error } = await client
        .from("catalog_buyer_prices")
        .select("*")
        .in("sku_code", skus);

      if (!error && Array.isArray(data)) {
        priceRows.push(...data.filter(isDbRow));
      }
    }
  } catch {
    return [];
  }

  return priceRows;
}

function uniqueDefinedStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
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

async function readCatalogProductFromViews(
  client: SupabaseServerClient,
  value: string
): Promise<RepositoryPartProduct | null> {
  const summaryRows = await readMatchingRows(
    client,
    "catalog_public_summary",
    "*",
    "sku_code",
    catalogLookupCandidates(value),
    1
  );
  const summaryRow = summaryRows?.[0];

  if (!summaryRow) {
    return null;
  }

  const id = pickString(summaryRow, ["id"]);
  const sku = pickString(summaryRow, ["sku_code", "sku"]);
  const priceRows =
    (id
      ? await readMatchingRows(client, "catalog_buyer_prices", "*", "id", [id], 1)
      : null) ??
    (sku
      ? await readMatchingRows(
          client,
          "catalog_buyer_prices",
          "*",
          "sku_code",
          catalogLookupCandidates(sku),
          1
        )
      : null);
  const priceRow = priceRows?.[0];

  return mapProductRow(priceRow ? { ...summaryRow, ...priceRow } : summaryRow);
}

async function readAdminProductPage(
  client: SupabaseServerClient,
  query: AdminProductQueryInput
): Promise<AdminProductPage | null> {
  const from = Math.max(query.offset, 0);
  const to = from + Math.max(query.limit, 1) - 1;

  try {
    let request = client.from("products").select(adminProductSelect, { count: "exact" });

    if (query.brand) {
      request = request.eq("brand", query.brand);
    }

    if (query.category) {
      request = request.eq("category", query.category);
    }

    if (query.catalogStatus) {
      request = request.eq("status", query.catalogStatus);
    }

    if (query.grade) {
      request = request.eq("quality_grade", query.grade);
    }

    if (query.q) {
      const search = sanitizePostgrestSearchTerm(query.q);
      request = request.or(
        `name.ilike.%${search}%,sku_code.ilike.%${search}%,brand.ilike.%${search}%,category.ilike.%${search}%`
      );
    }

    if (query.stockStatus) {
      request = request.eq("stock_status", stockStatusToDbValue(query.stockStatus));
    }

    if (query.warehouse) {
      request = request.eq("location", query.warehouse);
    }

    switch (query.sort) {
      case "stock_desc":
        request = request.order("stock_qty", { ascending: false });
        break;
      case "updated_desc":
        request = request.order("updated_at", { ascending: false });
        break;
      case "created_desc":
        request = request.order("created_at", { ascending: false });
        break;
      case "name":
      default:
        request = request.order("name", { ascending: true });
        break;
    }

    const { data, error, count } = await request.range(from, to);
    const rows = Array.isArray(data)
      ? (data as unknown[]).filter(isDbRow)
      : null;

    if (error || !rows) {
      return null;
    }

    return {
      products: rows.map(mapAdminProductRow).filter(isDefined),
      total: count ?? rows.length,
    };
  } catch {
    return null;
  }
}

async function readAdminProduct(
  client: SupabaseServerClient,
  sku: string
): Promise<AdminProduct | null> {
  const rows = await readMatchingRows(
    client,
    "products",
    adminProductSelect,
    "sku_code",
    catalogLookupCandidates(sku),
    1
  );
  const row = rows?.[0];

  return row ? mapAdminProductRow(row) : null;
}

async function readAdminCustomerPage(
  client: SupabaseServerClient,
  query: AdminCustomerQueryInput
): Promise<AdminCustomerPage | null> {
  const from = Math.max(query.offset, 0);
  const to = from + Math.max(query.limit, 1) - 1;

  try {
    let request = client.from("customers").select(adminCustomerSelect, { count: "exact" });

    if (query.status) {
      request = request.eq("status", query.status);
    }

    if (query.tier) {
      request = request.eq("tier", query.tier);
    }

    if (query.q) {
      const search = sanitizePostgrestSearchTerm(query.q);
      request = request.or(
        `company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%,vat_number.ilike.%${search}%`
      );
    }

    switch (query.sort) {
      case "name":
        request = request.order("company_name", { ascending: true });
        break;
      case "revenue_desc":
        request = request.order("revenue", { ascending: false });
        break;
      case "last_order_desc":
        request = request.order("last_order_at", {
          ascending: false,
          nullsFirst: false,
        });
        break;
      case "created_desc":
      default:
        request = request.order("created_at", { ascending: false });
        break;
    }

    const { data, error, count } = await request.range(from, to);
    const rows = Array.isArray(data)
      ? (data as unknown[]).filter(isDbRow)
      : null;

    if (error || !rows) {
      return null;
    }

    return {
      customers: rows.map(mapAdminCustomerRow).filter(isDefined),
      total: count ?? rows.length,
    };
  } catch {
    return null;
  }
}

async function readAdminB2BApplicationPage(
  client: SupabaseServerClient,
  query: AdminB2BApplicationQueryInput
): Promise<AdminB2BApplicationPage | null> {
  const from = Math.max(query.offset, 0);
  const to = from + Math.max(query.limit, 1) - 1;

  try {
    let request = client
      .from("b2b_applications")
      .select(adminB2BApplicationSelect, { count: "exact" });

    if (query.status) {
      request = request.eq("status", query.status);
    }

    if (query.q) {
      const search = sanitizePostgrestSearchTerm(query.q);
      request = request.or(
        `company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%,vat_number.ilike.%${search}%`
      );
    }

    request = request.order("submitted_at", {
      ascending: query.sort === "submitted_asc",
    });

    const { data, error, count } = await request.range(from, to);
    const rows = Array.isArray(data)
      ? (data as unknown[]).filter(isDbRow)
      : null;

    if (error || !rows) {
      return null;
    }

    return {
      applications: rows.map(mapAdminB2BApplicationRow).filter(isDefined),
      total: count ?? rows.length,
    };
  } catch {
    return null;
  }
}

async function reviewB2BApplication(
  client: SupabaseServerClient,
  input: AdminB2BApplicationReviewInput
): Promise<AdminB2BApplicationReviewResult> {
  const applicationRow = await readSingleRow(
    client,
    "b2b_applications",
    "id",
    input.id,
    adminB2BApplicationSelect
  );
  const application = applicationRow ? mapAdminB2BApplicationRow(applicationRow) : null;

  if (!application || !applicationRow) {
    throw new RepositoryWriteError(
      404,
      "ADMIN_B2B_APPLICATION_NOT_FOUND",
      "B2B application was not found.",
      { id: input.id }
    );
  }

  if (input.decision === "reject") {
    const rejectedRow = await updateSingleRow(
      client,
      "b2b_applications",
      "id",
      input.id,
      {
        status: "rejected",
        review_note: input.note ?? "",
        reviewed_at: new Date().toISOString(),
      },
      adminB2BApplicationSelect
    );
    const rejected = rejectedRow ? mapAdminB2BApplicationRow(rejectedRow) : null;

    if (!rejected) {
      throw new RepositoryWriteError(
        502,
        "ADMIN_B2B_APPLICATION_REVIEW_FAILED",
        "Supabase could not reject the B2B application."
      );
    }

    return { application: rejected, customer: null };
  }

  const customer = await upsertCustomerFromB2BApplication(client, applicationRow, input);
  const approvedRow = await updateSingleRow(
    client,
    "b2b_applications",
    "id",
    input.id,
    {
      status: "approved",
      review_note: input.note ?? "",
      approved_customer_id: customer.id,
      reviewed_at: new Date().toISOString(),
    },
    adminB2BApplicationSelect
  );
  const approved = approvedRow ? mapAdminB2BApplicationRow(approvedRow) : null;

  if (!approved) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_B2B_APPLICATION_REVIEW_FAILED",
      "Supabase could not approve the B2B application."
    );
  }

  return { application: approved, customer };
}

async function upsertCustomerFromB2BApplication(
  client: SupabaseServerClient,
  applicationRow: DbRow,
  input: AdminB2BApplicationReviewInput
): Promise<AdminCustomer> {
  const approvedCustomerId = pickString(applicationRow, ["approved_customer_id"]);
  const vatNumber = pickString(applicationRow, ["vat_number"]) ?? "";
  const existingByApprovedId = approvedCustomerId
    ? await readSingleRow(client, "customers", "id", approvedCustomerId, adminCustomerSelect)
    : null;
  const existingByVat = !existingByApprovedId && vatNumber
    ? (await readMatchingRows(
        client,
        "customers",
        adminCustomerSelect,
        "vat_number",
        [vatNumber],
        1
      ))?.[0] ?? null
    : null;
  const existing = existingByApprovedId ?? existingByVat;
  const payload = customerPayloadFromB2BApplication(applicationRow, input);
  const row = existing
    ? await updateSingleRow(
        client,
        "customers",
        "id",
        pickString(existing, ["id"]) ?? "",
        payload,
        adminCustomerSelect
      )
    : await insertRow(client, "customers", payload);
  const customer = row ? mapAdminCustomerRow(row) : null;

  if (!customer) {
    throw new RepositoryWriteError(
      502,
      "ADMIN_CUSTOMER_CREATE_FAILED",
      "Supabase could not convert the B2B application into an active customer."
    );
  }

  return customer;
}

async function readAdminOrderPage(
  client: SupabaseServerClient,
  query: AdminOrderQueryInput
): Promise<AdminOrderPage | null> {
  const from = Math.max(query.offset, 0);
  const to = from + Math.max(query.limit, 1) - 1;

  try {
    let request = client.from("orders").select("*", { count: "exact" });

    if (query.customerId) {
      request = request.eq("customer_id", query.customerId);
    }

    if (query.dateFrom) {
      request = request.gte("created_at", `${query.dateFrom}T00:00:00.000Z`);
    }

    if (query.dateTo) {
      request = request.lte("created_at", `${query.dateTo}T23:59:59.999Z`);
    }

    if (query.paymentStatus) {
      request = request.eq("payment_status", query.paymentStatus);
    }

    if (query.q) {
      const search = sanitizePostgrestSearchTerm(query.q);
      request = request.or(
        `order_no.ilike.%${search}%,customer_name.ilike.%${search}%,staff_note.ilike.%${search}%`
      );
    }

    if (query.status) {
      request = request.eq("status", query.status);
    }

    switch (query.sort) {
      case "date_asc":
        request = request.order("created_at", { ascending: true });
        break;
      case "total_desc":
        request = request.order("total_net", { ascending: false });
        break;
      case "total_asc":
        request = request.order("total_net", { ascending: true });
        break;
      case "date_desc":
      default:
        request = request.order("created_at", { ascending: false });
        break;
    }

    const { data, error, count } = await request.range(from, to);
    const rows = Array.isArray(data)
      ? (data as unknown[]).filter(isDbRow)
      : null;

    if (error || !rows) {
      return null;
    }

    const orderIds = uniqueDefinedStrings(rows.map((row) => pickString(row, ["id"])));
    const [lineRows, customerRows] = await Promise.all([
      readOrderLineRowsForOrderIds(client, orderIds),
      readCustomerRowsForOrders(client, rows),
    ]);
    const lineCounts = countLinesByOrder(lineRows ?? []);
    const customersById = new Map<string, DbRow>();

    for (const row of customerRows ?? []) {
      const id = pickString(row, ["id"]);
      if (id) {
        customersById.set(id, row);
      }
    }

    return {
      orders: rows
        .map((row) => mapAdminOrderRow(row, customersById, lineCounts))
        .filter(isDefined),
      total: count ?? rows.length,
    };
  } catch {
    return null;
  }
}

async function readAdminOrderDetail(
  client: SupabaseServerClient,
  orderId: string
): Promise<AdminOrder | null> {
  const orderRow = await readOrderByIdOrNumber(client, orderId);

  if (!orderRow) {
    return null;
  }

  const id = pickString(orderRow, ["id"]);

  if (!id) {
    return null;
  }

  const [lineRows, eventRows, customerRow] = await Promise.all([
    readRowsByColumn(client, "order_lines", "*", "order_id", id),
    readRowsByColumn(client, "order_events", "*", "order_id", id, {
      orderColumn: "created_at",
      ascending: false,
    }),
    readOrderCustomerRow(client, orderRow),
  ]);
  const lineCounts = countLinesByOrder(lineRows ?? []);
  const customersById = new Map<string, DbRow>();
  const customerId = pickString(customerRow, ["id"]);

  if (customerRow && customerId) {
    customersById.set(customerId, customerRow);
  }

  const order = mapAdminOrderRow(orderRow, customersById, lineCounts);

  if (!order) {
    return null;
  }

  return {
    ...order,
    lineCount: lineRows?.length ?? order.lineCount,
    lines: (lineRows ?? []).map(mapAdminOrderLineRow).filter(isDefined),
    events: (eventRows ?? []).map(mapAdminOrderEventRow).filter(isDefined),
  };
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

async function readMatchingRows(
  client: SupabaseServerClient,
  table: string,
  select: string,
  column: string,
  values: string[],
  limit = 1
): Promise<DbRow[] | null> {
  const candidates = [...new Set(values.map((value) => value.trim()).filter(Boolean))];

  if (candidates.length === 0) {
    return [];
  }

  try {
    const { data, error } = await client
      .from(table)
      .select(select)
      .in(column, candidates)
      .limit(limit);

    const rows = Array.isArray(data)
      ? (data as unknown[]).filter(isDbRow)
      : null;

    if (error || !rows) {
      return null;
    }

    return rows;
  } catch {
    return null;
  }
}

async function readRowsByColumn(
  client: SupabaseServerClient,
  table: string,
  select: string,
  column: string,
  value: string,
  options: { orderColumn?: string; ascending?: boolean } = {}
): Promise<DbRow[] | null> {
  try {
    let request = client.from(table).select(select).eq(column, value);

    if (options.orderColumn) {
      request = request.order(options.orderColumn, {
        ascending: options.ascending ?? true,
      });
    }

    const { data, error } = await request;
    const rows = Array.isArray(data)
      ? (data as unknown[]).filter(isDbRow)
      : null;

    if (error || !rows) {
      return null;
    }

    return rows;
  } catch {
    return null;
  }
}

async function readOrderLineRowsForOrderIds(
  client: SupabaseServerClient,
  orderIds: string[]
) {
  if (orderIds.length === 0) {
    return [];
  }

  try {
    const { data, error } = await client
      .from("order_lines")
      .select("*")
      .in("order_id", orderIds);
    const rows = Array.isArray(data)
      ? (data as unknown[]).filter(isDbRow)
      : null;

    if (error || !rows) {
      return null;
    }

    return rows;
  } catch {
    return null;
  }
}

async function readCustomerRowsForOrders(
  client: SupabaseServerClient,
  orderRows: DbRow[]
) {
  const customerIds = uniqueDefinedStrings(
    orderRows.map((row) => pickString(row, ["customer_id", "company_id"]))
  );

  if (customerIds.length === 0) {
    return [];
  }

  try {
    const { data, error } = await client
      .from("customers")
      .select(adminCustomerSelect)
      .in("id", customerIds);
    const rows = Array.isArray(data)
      ? (data as unknown[]).filter(isDbRow)
      : null;

    if (error || !rows) {
      return null;
    }

    return rows;
  } catch {
    return null;
  }
}

async function readOrderCustomerRow(
  client: SupabaseServerClient,
  orderRow: DbRow
) {
  const customerId = pickString(orderRow, ["customer_id", "company_id"]);
  return customerId
    ? readSingleRow(client, "customers", "id", customerId, adminCustomerSelect)
    : null;
}

async function readOrderByIdOrNumber(
  client: SupabaseServerClient,
  orderId: string
) {
  const id = parseUuid(orderId);

  if (id) {
    const row = await readSingleRow(client, "orders", "id", id);

    if (row) {
      return row;
    }
  }

  return readSingleRow(client, "orders", "order_no", orderId);
}

async function updateSingleRow(
  client: SupabaseServerClient,
  table: string,
  column: string,
  value: string,
  payload: Record<string, unknown>,
  select = "*"
): Promise<DbRow | null> {
  try {
    const { data, error } = await client
      .from(table)
      .update(payload)
      .eq(column, value)
      .select(select)
      .maybeSingle();
    const row = data as unknown;

    if (error || !isDbRow(row)) {
      return null;
    }

    return row;
  } catch {
    return null;
  }
}

async function updateRowsByColumn(
  client: SupabaseServerClient,
  table: string,
  column: string,
  value: string,
  payload: Record<string, unknown>
) {
  try {
    const { error } = await client.from(table).update(payload).eq(column, value);
    return !error;
  } catch {
    return false;
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
  value: string,
  select = "*"
): Promise<DbRow | null> {
  try {
    const { data, error } = await client.from(table).select(select).eq(column, value).maybeSingle();

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

function buildProductPayload(
  input: AdminProductWriteInput | AdminProductPatchInput,
  partial: boolean
) {
  const payload: Record<string, unknown> = {};

  assignDefined(payload, "sku_code", input.sku ? normalizeSku(input.sku) : undefined);
  assignDefined(payload, "name", trimOptional(input.name));
  assignDefined(payload, "category", trimOptional(input.category));
  assignDefined(payload, "brand", trimOptional(input.brand));
  assignDefined(payload, "quality_grade", input.grade);
  assignDefined(payload, "b2b_price", input.price);
  assignDefined(payload, "retail_price", input.retailPrice ?? (partial ? undefined : input.price));
  assignDefined(payload, "cost_price", input.costPrice ?? (partial ? undefined : 0));
  assignDefined(payload, "stock_qty", input.stock);
  assignDefined(payload, "moq", input.moq);
  assignDefined(payload, "location", input.warehouse);
  assignDefined(payload, "compatibility_models", input.compatibleWith);
  assignDefined(payload, "highlights", input.tags);
  assignDefined(payload, "status", input.catalogStatus);
  assignDefined(
    payload,
    "stock_status",
    input.stockStatus
      ? stockStatusToDbValue(input.stockStatus)
      : input.stock === undefined
        ? undefined
        : stockQtyToDbStatus(input.stock)
  );
  assignDefined(payload, "vat_mode", input.vatMode ?? (partial ? undefined : "IVA esclusa"));
  assignDefined(payload, "warranty_days", input.rmaDays ?? (partial ? undefined : 180));
  assignDefined(payload, "weight_gram", input.weightGram ?? (partial ? undefined : 0));
  assignDefined(payload, "model", trimOptional(input.model));
  assignDefined(payload, "model_code", trimOptional(input.modelCode));
  assignDefined(payload, "model_codes", input.modelCodes);
  assignDefined(payload, "batch_code", trimOptional(input.batchCode));
  assignDefined(payload, "supplier", trimOptional(input.supplier));
  assignDefined(payload, "image_path", trimOptional(input.imagePath));
  assignDefined(payload, "image_alt", trimOptional(input.imageAlt));
  assignDefined(payload, "gallery_image_paths", input.galleryImagePaths);

  return payload;
}

function buildCustomerPayload(input: AdminCustomerPatchInput) {
  const payload: Record<string, unknown> = {};

  assignDefined(payload, "company_name", trimOptional(input.companyName));
  assignDefined(payload, "contact_name", trimOptional(input.contactName));
  assignDefined(payload, "email", trimOptional(input.email));
  assignDefined(payload, "phone", trimOptional(input.phone));
  assignDefined(payload, "vat_number", trimOptional(input.vatNumber));
  assignDefined(payload, "fiscal_code", trimOptional(input.fiscalCode));
  assignDefined(payload, "sdi", trimOptional(input.sdi));
  assignDefined(payload, "pec", trimOptional(input.pec));
  assignDefined(payload, "registered_address", trimOptional(input.registeredAddress));
  assignDefined(payload, "billing_address", trimOptional(input.billingAddress));
  assignDefined(payload, "shipping_address", trimOptional(input.shippingAddress));
  assignDefined(payload, "status", input.status);
  assignDefined(payload, "tier", input.tier);
  assignDefined(payload, "price_group_id", input.priceGroupId);
  assignDefined(payload, "monthly_purchase", trimOptional(input.monthlyPurchase));
  assignDefined(payload, "credit_limit", input.creditLimit);
  assignDefined(payload, "payment_terms", trimOptional(input.paymentTerms));

  return payload;
}

function customerPayloadFromB2BApplication(
  row: DbRow,
  input: AdminB2BApplicationReviewInput
) {
  const registeredAddress = pickString(row, ["registered_address"]) ?? "";
  const shippingAddress = pickString(row, ["shipping_address"]) ?? registeredAddress;

  return {
    company_name: pickString(row, ["company_name"]) ?? "Cliente B2B",
    contact_name: pickString(row, ["contact_name"]) ?? "",
    email: pickString(row, ["email"]) ?? "",
    phone: pickString(row, ["phone", "whatsapp"]) ?? "",
    vat_number: pickString(row, ["vat_number"]) ?? "",
    fiscal_code: pickString(row, ["fiscal_code"]) ?? "",
    sdi: pickString(row, ["sdi"]) ?? "",
    pec: pickString(row, ["pec"]) ?? "",
    registered_address: registeredAddress,
    billing_address: registeredAddress,
    shipping_address: shippingAddress,
    tier: input.tier ?? "standard",
    price_group_id:
      input.priceGroupId === undefined
        ? pickString(row, ["requested_price_group_id"])
        : input.priceGroupId,
    status: "active",
    monthly_purchase: pickString(row, ["monthly_purchase"]) ?? "",
    credit_limit: input.creditLimit ?? 0,
    payment_terms: input.paymentTerms ?? "Bonifico anticipato",
    profile_completed_at: new Date().toISOString(),
  };
}

async function syncProductInventoryItem(
  client: SupabaseServerClient,
  productRow: DbRow,
  productPayload: Record<string, unknown>
) {
  if (!Object.prototype.hasOwnProperty.call(productPayload, "stock_qty")) {
    return;
  }

  const sku = pickString(productRow, ["sku_code", "sku"]);
  const productName = pickString(productRow, ["name", "product_name"]);
  const stockQty = pickNumber(productRow, ["stock_qty"]);

  if (!sku || !productName || stockQty === null) {
    return;
  }

  const inventoryRows = await readMatchingRows(
    client,
    "inventory_items",
    "id, locked_qty",
    "sku_code",
    [sku],
    1
  );
  const existing = inventoryRows?.[0];
  const lockedQty = existing ? pickNumber(existing, ["locked_qty"]) ?? 0 : 0;
  const inventoryPayload = {
    sku_code: sku,
    product_name: productName,
    brand: pickString(productRow, ["brand"]) ?? null,
    model: pickString(productRow, ["model"]) ?? null,
    quality_grade: pickString(productRow, ["quality_grade"]) ?? null,
    batch_code: pickString(productRow, ["batch_code"]) ?? null,
    location: pickString(productRow, ["location"]) ?? null,
    actual_qty: stockQty + lockedQty,
    available_qty: stockQty,
    supplier: pickString(productRow, ["supplier"]) ?? null,
    last_movement_at: new Date().toISOString(),
  };
  const existingId = pickString(existing, ["id"]);

  if (existingId) {
    await updateSingleRow(client, "inventory_items", "id", existingId, inventoryPayload);
    return;
  }

  await insertRow(client, "inventory_items", {
    ...inventoryPayload,
    locked_qty: 0,
  });
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

function mapAdminProductRow(row: DbRow): AdminProduct | null {
  const product = mapProductRow(row);
  const id = pickString(row, ["id", "product_id", "uuid"]);

  if (!product || !id) {
    return null;
  }

  const stockQty = pickNumber(row, ["stock_qty", "stock", "available_qty"]) ?? product.stock;
  const stockStatus = normalizeStockStatus(pickString(row, ["stock_status"]), stockQty);

  return {
    ...product,
    id,
    status: stockStatus,
    catalogStatus: normalizeCatalogStatus(pickString(row, ["status"])),
    stockStatus,
    stockQty,
    b2bPrice: pickNumber(row, ["b2b_price", "price"]) ?? product.price,
    costPrice: pickNumber(row, ["cost_price"]) ?? 0,
    retailPrice: pickNumber(row, ["retail_price", "retailPrice"]) ?? product.retailPrice,
    vatMode: pickString(row, ["vat_mode"]) ?? "IVA esclusa",
    warrantyDays: pickNumber(row, ["warranty_days"]) ?? product.rmaDays,
    weightGram: pickNumber(row, ["weight_gram"]) ?? 0,
    model: pickString(row, ["model"]) ?? undefined,
    modelCode: pickString(row, ["model_code"]) ?? undefined,
    modelCodes: readStringArray(row, ["model_codes"]),
    batchCode: pickString(row, ["batch_code"]) ?? undefined,
    supplier: pickString(row, ["supplier"]) ?? undefined,
    imagePath: pickString(row, ["image_path"]) ?? undefined,
    galleryImagePaths: readStringArray(row, ["gallery_image_paths"]),
    createdAt: formatPartsProDateTime(pickString(row, ["created_at", "createdAt"])),
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

function mapAdminCustomerRow(row: DbRow): AdminCustomer | null {
  const profile = mapCompanyRow(row);

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    customerStatus: normalizeAdminCustomerStatus(pickString(row, ["status"])),
    contactName: pickString(row, ["contact_name"]) ?? "",
    email: pickString(row, ["email"]) ?? "",
    phone: pickString(row, ["phone"]) ?? "",
    registeredAddress: pickString(row, ["registered_address"]) ?? "",
    billingAddress: pickString(row, ["billing_address"]) ?? "",
    shippingAddress: pickString(row, ["shipping_address"]) ?? "",
    tier: pickString(row, ["tier"]) ?? "standard",
    priceGroupId: pickString(row, ["price_group_id"]),
    monthlyPurchase: pickString(row, ["monthly_purchase"]) ?? "",
    ordersCount: pickNumber(row, ["orders_count"]) ?? 0,
    revenue: pickNumber(row, ["revenue"]) ?? 0,
    creditLimit: pickNumber(row, ["credit_limit"]) ?? 0,
    paymentTerms: pickString(row, ["payment_terms"]) ?? "",
    profileCompletedAt: pickString(row, ["profile_completed_at"]),
    lastOrderAt: pickString(row, ["last_order_at"]),
    createdAt: pickString(row, ["created_at"]) ?? "",
    updatedAt: pickString(row, ["updated_at"]) ?? "",
  };
}

function mapAdminB2BApplicationRow(row: DbRow): AdminB2BApplication | null {
  const id = pickString(row, ["id"]);

  if (!id) {
    return null;
  }

  return {
    id,
    companyName: pickString(row, ["company_name"]) ?? "",
    contactName: pickString(row, ["contact_name"]) ?? "",
    email: pickString(row, ["email"]) ?? "",
    phone: pickString(row, ["phone", "whatsapp"]) ?? "",
    vatNumber: pickString(row, ["vat_number"]) ?? "",
    fiscalCode: pickString(row, ["fiscal_code"]) ?? "",
    sdi: pickString(row, ["sdi"]) ?? "",
    pec: pickString(row, ["pec"]) ?? "",
    registeredAddress: pickString(row, ["registered_address"]) ?? "",
    shippingAddress: pickString(row, ["shipping_address"]) ?? "",
    monthlyPurchase: pickString(row, ["monthly_purchase"]) ?? "",
    requestedPriceGroupId: pickString(row, ["requested_price_group_id"]),
    status: normalizeB2BApplicationStatus(pickString(row, ["status"])),
    reviewNote: pickString(row, ["review_note"]) ?? "",
    approvedCustomerId: pickString(row, ["approved_customer_id"]),
    submittedAt: pickString(row, ["submitted_at", "created_at"]) ?? "",
    reviewedAt: pickString(row, ["reviewed_at"]),
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

function mapAdminOrderRow(
  row: DbRow,
  customersById: Map<string, DbRow>,
  lineCounts: Map<string, number>
): AdminOrder | null {
  const id = pickString(row, ["id"]);
  const orderNo = pickString(row, ["order_no", "order_number", "reference"]) ?? id;

  if (!id || !orderNo) {
    return null;
  }

  const customerId = pickString(row, ["customer_id", "company_id"]);
  const customerRow = customerId ? customersById.get(customerId) : undefined;
  const totalNet = pickNumber(row, ["total_net"]) ?? 0;
  const vat = pickNumber(row, ["vat"]) ?? 0;
  const shipping = pickNumber(row, ["shipping"]) ?? 0;
  const status = normalizeAdminOrderDbStatus(pickString(row, ["status"])) ?? "submitted";

  return {
    id,
    orderNo,
    status,
    uiStatus: normalizeOrderStatus(status),
    paymentStatus: normalizePaymentStatus(pickString(row, ["payment_status"])),
    stockRisk: pickString(row, ["stock_risk"]) ?? "clear",
    totalNet,
    vat,
    shipping,
    total: totalNet + vat + shipping,
    shippingMethod: pickString(row, ["shipping_method"]) ?? "",
    carrier: pickString(row, ["carrier"]) ?? "",
    trackingCode: pickString(row, ["tracking_code", "tracking"]) ?? "",
    fiscal: row.fiscal ?? {},
    deliveryAddress: pickString(row, ["delivery_address"]) ?? "",
    customerNote: pickString(row, ["customer_note"]) ?? "",
    staffNote: pickString(row, ["staff_note"]) ?? "",
    customer: {
      id: customerId,
      name:
        pickString(row, ["customer_name", "company_name"]) ??
        pickString(customerRow, ["company_name", "name"]) ??
        "Cliente B2B",
      tier:
        pickString(row, ["customer_tier"]) ??
        pickString(customerRow, ["tier"]) ??
        "standard",
      status: customerRow ? normalizeAdminCustomerStatus(pickString(customerRow, ["status"])) : null,
    },
    lineCount:
      lineCounts.get(id) ??
      (orderNo ? lineCounts.get(orderNo) : undefined) ??
      pickNumber(row, ["line_count", "items_count"]) ??
      0,
    createdAt: pickString(row, ["created_at"]) ?? "",
    updatedAt: pickString(row, ["updated_at"]) ?? "",
  };
}

function mapAdminOrderLineRow(row: DbRow): AdminOrderLine | null {
  const id = pickString(row, ["id"]);
  const sku = pickString(row, ["sku_code", "sku"]);

  if (!id || !sku) {
    return null;
  }

  const quantity = pickNumber(row, ["quantity"]) ?? 0;
  const unitPrice = pickNumber(row, ["unit_price"]) ?? 0;

  return {
    id,
    sku,
    productName: pickString(row, ["product_name", "name"]) ?? sku,
    qualityGrade: pickString(row, ["quality_grade"]) ?? "",
    quantity,
    unitPrice,
    lineNet: roundMoney(unitPrice * quantity),
    stockStatus: pickString(row, ["stock_status"]) ?? "available",
    reservedQty: pickNumber(row, ["reserved_qty"]) ?? 0,
    fulfilledQty: pickNumber(row, ["fulfilled_qty"]) ?? 0,
    batchCode: pickString(row, ["batch_code"]),
    location: pickString(row, ["location"]),
    reservationAllocations: readJsonArray(row, "reservation_allocations"),
  };
}

function mapAdminOrderEventRow(row: DbRow): AdminOrderEvent | null {
  const id = pickString(row, ["id"]);

  if (!id) {
    return null;
  }

  return {
    id,
    eventType: pickString(row, ["event_type"]) ?? "event",
    fromStatus: normalizeAdminOrderDbStatus(pickString(row, ["from_status"])),
    toStatus: normalizeAdminOrderDbStatus(pickString(row, ["to_status"])),
    note: pickString(row, ["note"]) ?? "",
    metadata: row.metadata ?? {},
    actorId: pickString(row, ["actor_id"]),
    createdAt: pickString(row, ["created_at"]) ?? "",
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

function buildDeviceModelGroupsFromRows(rows: DbRow[]): DeviceModelGroup[] {
  const groups = new Map<string, Set<string>>();

  for (const row of rows) {
    const status = pickString(row, ["status"]);

    if (status && status.toLowerCase() !== "active") {
      continue;
    }

    const brand = pickString(row, ["brand"]);

    if (!brand) {
      continue;
    }

    const models = groups.get(brand) ?? new Set<string>();

    for (const model of readCompatibility(row)) {
      const normalizedModel = model.trim();

      if (normalizedModel) {
        models.add(normalizedModel);
      }
    }

    groups.set(brand, models);
  }

  const preferredBrandOrder = deviceModels.map((group) => group.brand);

  return Array.from(groups.entries())
    .map(([brand, models]) => ({
      brand,
      models: Array.from(models).sort(compareDeviceModelNames),
    }))
    .filter((group) => group.models.length > 0)
    .sort((left, right) => {
      const leftIndex = preferredBrandOrder.indexOf(left.brand);
      const rightIndex = preferredBrandOrder.indexOf(right.brand);

      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }

      return left.brand.localeCompare(right.brand, "it", { numeric: true });
    });
}

function compareDeviceModelNames(left: string, right: string) {
  return left.localeCompare(right, "it", { numeric: true, sensitivity: "base" });
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

function readJsonArray(row: DbRow, key: string) {
  const value = row[key];
  return Array.isArray(value) ? value : [];
}

function assignDefined(
  payload: Record<string, unknown>,
  key: string,
  value: unknown
) {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function trimOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSku(value: string) {
  return value.trim().toUpperCase();
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function normalizeAdminCustomerStatus(value: string | null): AdminCustomerStatus {
  if (value === "active" || value === "pending" || value === "suspended") {
    return value;
  }

  return "pending";
}

function normalizeCatalogStatus(value: string | null): AdminCatalogStatus {
  if (value === "active" || value === "draft" || value === "hidden" || value === "blocked") {
    return value;
  }

  return "draft";
}

function normalizeB2BApplicationStatus(value: string | null): AdminB2BApplicationStatus {
  if (value === "approved" || value === "rejected" || value === "submitted") {
    return value;
  }

  return "submitted";
}

function normalizePaymentStatus(value: string | null): AdminPaymentStatus {
  if (value === "pending" || value === "paid" || value === "bank_waiting" || value === "failed") {
    return value;
  }

  return "pending";
}

function normalizeAdminPaymentStatusForWrite(
  value: AdminOrderOperationsPatchInput["paymentStatus"] | undefined
): AdminPaymentStatus | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "paid" || value === "pending" || value === "bank_waiting" || value === "failed") {
    return value;
  }

  if (value === "refunded") {
    return "failed";
  }

  return "pending";
}

function normalizeAdminOrderDbStatus(
  value: string | null | undefined
): AdminOrderDbStatus | null {
  if (
    value === "submitted" ||
    value === "accepted" ||
    value === "picking" ||
    value === "packed" ||
    value === "shipped" ||
    value === "completed" ||
    value === "cancelled"
  ) {
    return value;
  }

  if (value === "pending_payment" || value === "draft") {
    return "submitted";
  }

  if (value === "paid") {
    return "accepted";
  }

  if (value === "delivered") {
    return "completed";
  }

  return null;
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

function catalogLookupCandidates(value: string) {
  return [value, value.toUpperCase()];
}

function shouldFallbackToCatalogSlugLookup(value: string) {
  return value !== value.toUpperCase();
}

function stockStatusToDbValue(status: StockStatus) {
  switch (status) {
    case "In Stock":
      return "in_stock";
    case "Low Stock":
      return "low_stock";
    case "Out of Stock":
      return "out_of_stock";
  }
}

function stockQtyToDbStatus(stockQty: number) {
  if (stockQty <= 0) {
    return "out_of_stock";
  }

  if (stockQty <= 5) {
    return "low_stock";
  }

  return "in_stock";
}

function sanitizePostgrestSearchTerm(value: string) {
  return value.replace(/[%*,()]/g, " ").trim();
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
