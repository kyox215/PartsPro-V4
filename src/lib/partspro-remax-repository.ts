import "server-only";

import type { RemaxImportPayload } from "@/lib/partspro-remax-import";
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
