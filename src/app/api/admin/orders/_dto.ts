import { type AdminOrder } from "@/lib/partspro-repository";
import { sanitizeSupplierText, toPublicSku } from "@/lib/partspro-sku";

export function toAdminOrderDto(order: AdminOrder, overlay: Record<string, unknown> = {}) {
  const fiscal = isRecord(order.fiscal) ? order.fiscal : null;
  const companySnapshotValue = readRecordValue(fiscal, [
    "company_snapshot",
    "companySnapshot",
  ]);
  const companySnapshot = isRecord(companySnapshotValue) ? companySnapshotValue : null;
  const operationHistory = toOrderOperationHistory(order);

  return {
    id: order.orderNo,
    orderId: order.id,
    remoteId: order.id,
    number: order.orderNo,
    date: order.createdAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    status: order.status,
    uiStatus: order.uiStatus,
    orderStatus: order.status,
    paymentStatus: toUiPaymentStatus(order.paymentStatus),
    fulfillmentStatus: toUiFulfillmentStatus(order.status),
    stockRisk: order.stockRisk,
    company: order.customer.name,
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      companyName: order.customer.name,
      tier: order.customer.tier,
      status: order.customer.status,
      partitaIva: readStringValue(
        readRecordValue(companySnapshot, ["partita_iva", "partitaIva", "vat_number"])
      ),
      vatNumber: readStringValue(
        readRecordValue(companySnapshot, ["partita_iva", "partitaIva", "vat_number"])
      ),
      pec: readStringValue(readRecordValue(companySnapshot, ["pec"])),
      address: readStringValue(readRecordValue(companySnapshot, ["address"])),
    },
    total: order.total,
    totalNet: order.totalNet,
    vat: order.vat,
    shipping: order.shipping,
    items: order.lineCount,
    reservedQty: order.reservedQty,
    fulfilledQty: order.fulfilledQty,
    lockedSince: order.lockedSince,
    reservationAgeHours: order.reservationAgeHours,
    reservationOverdue: order.reservationOverdue,
    reservationWarning: order.reservationWarning,
    paymentMethod: normalizePaymentMethod(order.paymentMethod, fiscal),
    paymentDue: order.paymentStatus === "paid" ? "Pagato" : "Da verificare",
    warehouse: primaryWarehouse(order),
    carrier: order.carrier,
    tracking: order.trackingCode,
    service: order.shippingMethod || "Da pianificare",
    eta: order.status === "shipped" || order.status === "completed" ? "In transito" : "Da pianificare",
    shippingAddress: order.deliveryAddress,
    owner: "Operations",
    customerNote: order.customerNote,
    staffNote: order.staffNote,
    notes: order.staffNote || order.customerNote,
    lines: (order.lines ?? []).map((line) => ({
      id: line.id,
      sku: toPublicSku(line.sku),
      name: line.productName,
      productName: line.productName,
      imageUrl: line.productImageUrl,
      imageAlt: line.productImageAlt,
      category: sanitizeSupplierText(line.qualityGrade) || "Ricambio",
      quantity: line.quantity,
      picked: line.fulfilledQty || line.reservedQty,
      unitPrice: line.unitPrice,
      lineTotal: line.lineNet,
      warehouse: normalizeWarehouse(line.location),
      stockStatus: line.stockStatus,
      reservedQty: line.reservedQty,
      fulfilledQty: line.fulfilledQty,
      batchCode: sanitizeSupplierText(line.batchCode),
    })),
    activity: operationHistory.map((event) =>
      [
        event.createdAt,
        event.eventType,
        event.fromStatus && event.toStatus
          ? `${event.fromStatus} -> ${event.toStatus}`
          : null,
        event.actor.label,
        sanitizeSupplierText(event.note),
      ]
        .filter(Boolean)
        .join(" - ")
    ),
    operationHistory,
    ...overlay,
  };
}

function toOrderOperationHistory(order: AdminOrder) {
  return [...(order.events ?? [])]
    .sort((left, right) => timestampOf(right.createdAt) - timestampOf(left.createdAt))
    .map((event) => {
      const actorLabel =
        sanitizeSupplierText(event.actorName) ||
        event.actorEmail ||
        event.actorRole ||
        event.actorId ||
        "System";

      return {
        id: event.id,
        eventType: event.eventType,
        action: event.eventType,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: sanitizeSupplierText(event.note),
        metadata: event.metadata,
        actor: {
          id: event.actorId,
          email: event.actorEmail,
          name: sanitizeSupplierText(event.actorName),
          role: event.actorRole,
          label: actorLabel,
        },
        createdAt: event.createdAt,
      };
    });
}

function timestampOf(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function readRecordValue(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (isRecord(value)) {
      return value;
    }

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function readStringValue(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toUiPaymentStatus(status: AdminOrder["paymentStatus"]) {
  if (status === "paid") {
    return "paid";
  }

  if (status === "bank_waiting") {
    return "authorized";
  }

  if (status === "failed") {
    return "refunded";
  }

  return "unpaid";
}

function normalizePaymentMethod(
  value: AdminOrder["paymentMethod"] | string | undefined,
  fiscal: Record<string, unknown> | null
) {
  const fiscalValue =
    readStringValue(readRecordValue(fiscal, ["payment_method", "paymentMethod"])) ??
    undefined;

  return value === "cash" || fiscalValue === "cash" ? "cash" : "bank_transfer";
}

function toUiFulfillmentStatus(status: AdminOrder["status"]) {
  switch (status) {
    case "accepted":
      return "allocated";
    case "picking":
      return "picking";
    case "packed":
      return "packed";
    case "shipped":
      return "shipped";
    case "completed":
      return "delivered";
    case "cancelled":
      return "blocked";
    case "submitted":
    default:
      return "queued";
  }
}

function primaryWarehouse(order: AdminOrder) {
  const firstLocation = order.lines?.find((line) => line.location)?.location;
  return normalizeWarehouse(firstLocation);
}

function normalizeWarehouse(value: string | null | undefined) {
  void value;
  return "Milano";
}
