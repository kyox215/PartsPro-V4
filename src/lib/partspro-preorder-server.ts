import "server-only";

import type {
  PartProduct,
  ProductPreorderAvailability,
} from "@/lib/partspro-data";
import type {
  RepositoryResult,
  SaveOrderInput,
  SavedOrder,
} from "@/lib/partspro-repository";
import {
  RepositoryWriteError,
  pageCatalogProducts,
} from "@/lib/partspro-repository";
import {
  defaultDeliveryMethod,
  shippingMethodForDeliveryMethod,
} from "@/lib/partspro-shipping";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type PreorderAvailabilityRow = {
  capacity_qty: number | string | null;
  eta_end: string | null;
  eta_start: string | null;
  offer_version: string | null;
  pending_qty: number | string | null;
  preorder_close_at: string | null;
  preorder_enabled: boolean | null;
  preorder_status: "open" | "sold_out" | "closed" | null;
  preorder_terms: string | null;
  remaining_qty: number | string | null;
  sku_code: string | null;
};

export async function mergePreorderAvailability<T extends PartProduct>(
  products: readonly T[]
): Promise<T[]> {
  if (products.length === 0 || !isSupabaseConfigured()) {
    return [...products];
  }

  const skus = [...new Set(products.map((product) => product.sku.trim()).filter(Boolean))];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalog_preorder_availability", {
    p_skus: skus,
  });

  if (error || !Array.isArray(data)) {
    return [...products];
  }

  const preorderBySku = new Map<string, ProductPreorderAvailability>();

  for (const rawRow of data as PreorderAvailabilityRow[]) {
    const sku = rawRow.sku_code?.trim();
    const etaStart = rawRow.eta_start?.trim();
    const etaEnd = rawRow.eta_end?.trim();
    const offerVersion = rawRow.offer_version?.trim();
    const terms = rawRow.preorder_terms?.trim();

    if (!sku || !etaStart || !etaEnd || !offerVersion || !terms) {
      continue;
    }

    preorderBySku.set(sku.toUpperCase(), {
      capacityQty: toNonNegativeInteger(rawRow.capacity_qty),
      closeAt: rawRow.preorder_close_at,
      enabled: Boolean(rawRow.preorder_enabled),
      etaEnd,
      etaStart,
      offerVersion,
      pendingQty: toNonNegativeInteger(rawRow.pending_qty),
      remainingQty: toNonNegativeInteger(rawRow.remaining_qty),
      status: rawRow.preorder_status ?? "closed",
      terms,
    });
  }

  return products.map((product) => {
    const preorder = preorderBySku.get(product.sku.toUpperCase());
    return preorder ? ({ ...product, preorder } as T) : product;
  });
}

export async function listRemaxPreorderProducts(options: {
  buyerCustomerId?: string;
  includeBuyerPrices: boolean;
  limit?: number;
}): Promise<RepositoryResult<PartProduct[]>> {
  const page = await pageCatalogProducts(
    {
      brand: "REMAX",
      limit: options.limit ?? 12,
      offset: 0,
      sort: "updated_desc",
    },
    options
  );
  const products = await mergePreorderAvailability(page.data.products);

  return {
    data: products.filter(
      (product) =>
        product.preorder?.enabled &&
        product.preorder.status === "open" &&
        product.preorder.remainingQty >= Math.max(1, product.moq)
    ),
    source: page.source,
    warning: page.warning,
  };
}

export async function savePreorder(
  input: SaveOrderInput
): Promise<RepositoryResult<SavedOrder>> {
  if (!isSupabaseConfigured()) {
    throw new RepositoryWriteError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase must be configured before preorders can be created."
    );
  }

  const customerId = parseUuid(input.company.id);

  if (!customerId) {
    throw new RepositoryWriteError(
      409,
      "ORDER_COMPANY_CONTRACT_MISMATCH",
      "The selected customer profile cannot be used for a preorder."
    );
  }

  const deliveryMethod = input.deliveryMethod ?? defaultDeliveryMethod;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_preorder_transaction", {
    p_lines: input.lines.map((line) => ({
      offer_version: line.product.preorder?.offerVersion ?? null,
      price_version: line.priceVersion ?? line.product.priceVersion ?? null,
      quantity: line.quantity,
      sku_code: line.product.sku,
      unit_net: centsToEuro(line.unitNetCents),
    })),
    p_customer_id: customerId,
    p_delivery_address: formatDeliveryAddress(input.deliveryAddress),
    p_customer_note: input.notes ?? "",
    p_shipping_method: shippingMethodForDeliveryMethod(deliveryMethod),
    p_shipping: centsToEuro(input.totals.shippingCents),
    p_fiscal: {
      company_snapshot: {
        address: input.fiscal.companySnapshot.address ?? input.deliveryAddress,
        codice_destinatario: input.fiscal.companySnapshot.codiceDestinatario,
        codice_fiscale: input.fiscal.companySnapshot.codiceFiscale,
        delivery_address:
          input.fiscal.companySnapshot.deliveryAddress ?? input.deliveryAddress,
        id: input.company.id,
        name: input.fiscal.companySnapshot.name,
        partita_iva: input.fiscal.companySnapshot.partitaIva,
        pec: input.fiscal.companySnapshot.pec,
        price_list: input.company.priceList,
      },
      order_kind: "preorder",
      payment_method: "bank_transfer",
      totals: {
        shipping: centsToEuro(input.totals.shippingCents),
        subtotal: centsToEuro(input.totals.subtotalCents),
        total: centsToEuro(input.totals.totalCents),
        vat: centsToEuro(input.totals.vatCents),
      },
      wallet_requested_amount: 0,
    },
    p_terms_accepted: true,
  });

  if (error) {
    throw new RepositoryWriteError(
      502,
      "PREORDER_RPC_FAILED",
      "Supabase rejected the create_preorder_transaction RPC.",
      {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      }
    );
  }

  const orderId = typeof data === "string" ? data : null;

  if (!orderId) {
    throw new RepositoryWriteError(
      502,
      "PREORDER_RPC_RESULT_INVALID",
      "Supabase did not return a preorder id."
    );
  }

  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, order_no, status, created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (readError || !order) {
    throw new RepositoryWriteError(
      502,
      "PREORDER_RESULT_UNAVAILABLE",
      "The preorder was created but could not be read back.",
      readError
    );
  }

  return {
    data: {
      createdAt: order.created_at,
      id: order.order_no ?? order.id,
      orderNo: order.order_no ?? order.id,
      status: order.status,
      walletAppliedAmount: 0,
    },
    source: "supabase",
  };
}

function toNonNegativeInteger(value: number | string | null) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function centsToEuro(cents: number) {
  return Math.round(cents) / 100;
}

function parseUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}

function formatDeliveryAddress(value: SaveOrderInput["deliveryAddress"]) {
  if (typeof value === "string") {
    return value;
  }

  return [
    value.street,
    [value.zip, value.city].filter(Boolean).join(" "),
    value.province,
    value.country,
  ]
    .filter(Boolean)
    .join(", ");
}
