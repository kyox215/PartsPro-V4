import "server-only";

import type {
  RemaxImportPayload,
  RemaxImportPreview,
} from "@/lib/partspro-remax-import";
import { RepositoryWriteError } from "@/lib/partspro-repository";
import { createClient } from "@/lib/supabase/server";

export type AdminRemaxProduct = {
  b2bPrice: number;
  capacityQty: number;
  closeAt: string | null;
  costPrice: number | null;
  etaEnd: string | null;
  etaStart: string | null;
  imagePath: string | null;
  name: string;
  pendingQty: number;
  preorderEnabled: boolean;
  remainingQty: number;
  retailPrice: number;
  sku: string;
  status: string;
  updatedAt: string;
};

export type AdminRemaxBatchLine = {
  id: string;
  lineNo: number;
  name: string;
  preorderCapacityQty: number;
  qtyOrdered: number;
  qtyReceived: number;
  remainingQty: number;
  sku: string;
  unitCost: number | null;
  waitingQty: number;
};

export type AdminRemaxBatch = {
  batchCode: string;
  currency: string;
  etaEnd: string;
  etaStart: string;
  id: string;
  lines: AdminRemaxBatchLine[];
  orderedQty: number;
  receivedQty: number;
  remainingQty: number;
  revision: string;
  sourceFileName: string | null;
  status: string;
  totalCost: number | null;
  updatedAt: string;
};

export type AdminRemaxOrder = {
  createdAt: string;
  customerName: string;
  id: string;
  orderNo: string;
  paymentStatus: string;
  quantity: number;
  readyQuantity: number;
  status: string;
  total: number;
};

export type AdminRemaxDashboard = {
  batches: AdminRemaxBatch[];
  generatedAt: string;
  orders: AdminRemaxOrder[];
  permissions: {
    canImport: boolean;
    canReceive: boolean;
    canViewCost: boolean;
    canViewOrders: boolean;
  };
  products: AdminRemaxProduct[];
};

export type RemaxArrivalReceipt = {
  lineId: string;
  quantity: number;
};

export type RemaxArrivalPreview = {
  batchCode: string;
  batchId: string;
  lines: Array<{
    lineId: string;
    lineNo: number;
    name: string;
    receiveQty: number;
    remainingAfterReceipt: number;
    sku: string;
    waitingQty: number;
    willAllocateQty: number;
    willRemainAvailableQty: number;
  }>;
  revision: string;
  status: string;
  totalReceiveQty: number;
};

export async function readAdminRemaxDashboard() {
  return callRemaxRpc<AdminRemaxDashboard>(
    "admin_remax_preorder_dashboard",
    undefined,
    "ADMIN_REMAX_DASHBOARD_FAILED",
    "REMAX preorder dashboard could not be loaded."
  );
}

export async function importAdminRemaxBatch(payload: RemaxImportPayload) {
  return callRemaxRpc<Record<string, unknown>>(
    "admin_import_remax_preorder_batch",
    { p_payload: payload },
    "ADMIN_REMAX_IMPORT_FAILED",
    "REMAX preorder batch could not be imported."
  );
}

export async function blockExistingAdminRemaxImportRows(
  preview: RemaxImportPreview
): Promise<RemaxImportPreview> {
  const supabase = await createClient();
  const skus = [...new Set(preview.rows.map((row) => row.sku).filter(Boolean))];
  const eans = [
    ...new Set(
      preview.rows
        .map((row) => row.ean?.trim() ?? "")
        .filter(Boolean)
    ),
  ];
  const existingSkuRows = new Map<string, { brand: string; name: string }>();
  const existingEanRows = new Map<string, string>();

  if (skus.length > 0) {
    const { data, error } = await supabase
      .from("products")
      .select("sku_code, brand, name")
      .in("sku_code", skus);

    if (error || !Array.isArray(data)) {
      throw new RepositoryWriteError(
        502,
        "ADMIN_REMAX_IMPORT_CONFLICT_CHECK_FAILED",
        "Existing REMAX products could not be checked before import.",
        error
      );
    }

    for (const value of data) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const sku = typeof row.sku_code === "string" ? row.sku_code.trim().toUpperCase() : "";
      if (!sku) continue;
      existingSkuRows.set(sku, {
        brand: typeof row.brand === "string" ? row.brand.trim() : "",
        name: typeof row.name === "string" ? row.name.trim() : "",
      });
    }
  }

  if (eans.length > 0) {
    const { data, error } = await supabase
      .from("supplier_batch_lines")
      .select("ean, sku_code")
      .in("ean", eans);

    if (error || !Array.isArray(data)) {
      throw new RepositoryWriteError(
        502,
        "ADMIN_REMAX_IMPORT_EAN_CHECK_FAILED",
        "Existing supplier EAN values could not be checked before import.",
        error
      );
    }

    for (const value of data) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const ean = typeof row.ean === "string" ? row.ean.trim() : "";
      const sku = typeof row.sku_code === "string" ? row.sku_code.trim().toUpperCase() : "";
      if (ean && sku && !existingEanRows.has(ean)) existingEanRows.set(ean, sku);
    }
  }

  const rows = preview.rows.map((row) => {
    const issues = [...row.issues];
    const existingSku = existingSkuRows.get(row.sku.toUpperCase());
    const eanSku = row.ean ? existingEanRows.get(row.ean) : null;

    if (existingSku) {
      issues.push(
        `SKU già esistente (${existingSku.brand || "brand non indicato"}: ${existingSku.name || row.sku}); l'importazione non aggiorna prodotti senza una revisione esplicita`
      );
    }
    if (eanSku) {
      issues.push(
        eanSku === row.sku.toUpperCase()
          ? `EAN già presente in un lotto fornitore per lo SKU ${eanSku}`
          : `EAN già associato allo SKU ${eanSku}`
      );
    }

    return issues.length === row.issues.length
      ? row
      : { ...row, issues, status: "blocked" as const };
  });

  return {
    ...preview,
    counts: {
      blocked: rows.filter((row) => row.status === "blocked").length,
      draft: rows.filter((row) => row.status === "draft").length,
      ready: rows.filter((row) => row.status === "ready").length,
      total: rows.length,
    },
    rows,
  };
}

export async function previewAdminRemaxArrival(
  batchCode: string,
  receipts: RemaxArrivalReceipt[]
) {
  return callRemaxRpc<RemaxArrivalPreview>(
    "admin_preview_remax_arrival",
    { p_batch_code: batchCode, p_receipts: toRpcReceipts(receipts) },
    "ADMIN_REMAX_ARRIVAL_PREVIEW_FAILED",
    "REMAX arrival preview could not be generated."
  );
}

export async function receiveAdminRemaxArrival(input: {
  batchCode: string;
  idempotencyKey: string;
  receipts: RemaxArrivalReceipt[];
  revision: string;
}) {
  return callRemaxRpc<Record<string, unknown>>(
    "admin_receive_remax_preorder_batch",
    {
      p_batch_code: input.batchCode,
      p_idempotency_key: input.idempotencyKey,
      p_receipts: toRpcReceipts(input.receipts),
      p_revision: input.revision,
    },
    "ADMIN_REMAX_ARRIVAL_FAILED",
    "REMAX arrival could not be registered."
  );
}

async function callRemaxRpc<T>(
  name: string,
  args: Record<string, unknown> | undefined,
  code: string,
  message: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    throw new RepositoryWriteError(502, code, message, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new RepositoryWriteError(502, `${code}_INVALID_RESULT`, message);
  }

  return data as T;
}

function toRpcReceipts(receipts: RemaxArrivalReceipt[]) {
  return receipts.map((receipt) => ({
    line_id: receipt.lineId,
    quantity: receipt.quantity,
  }));
}
