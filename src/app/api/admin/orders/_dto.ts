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
  const paymentCollector = findPaymentCollector(order, operationHistory);
  const walletAppliedAmount = order.walletAppliedAmount ?? 0;
  const receivedAmount =
    order.paymentReceivedAmount ??
    (order.paymentStatus === "paid" && walletAppliedAmount <= 0 ? order.total : 0);
  const paymentReceivedForDue =
    receivedAmount + walletAppliedAmount;
  const paymentDueAmount = Math.max(0, roundMoney(order.total - paymentReceivedForDue));
  const paymentOverpaidAmount = Math.max(0, roundMoney(paymentReceivedForDue - order.total));
  const hasSupplementDue =
    order.paymentStatus !== "paid" &&
    paymentDueAmount > 0 &&
    paymentReceivedForDue > 0;

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
    paymentDue: order.paymentStatus === "paid" ? "Pagato" : hasSupplementDue ? "Da integrare" : "Da verificare",
    paymentDueAmount,
    paymentOverpaidAmount,
    walletAppliedAmount,
    softDeletedAt: order.softDeletedAt,
    softDeletedBy: order.softDeletedBy,
    dangerActionType: order.dangerActionType,
    dangerActionReason: order.dangerActionReason,
    dangerActionMetadata: order.dangerActionMetadata,
    paymentReconciliation: {
      receivedAt: order.paymentReceivedAt,
      receivedAmount: order.paymentReceivedAmount,
      receivedBy: paymentCollector,
      reference: order.paymentReference,
      note: order.paymentReconciliationNote,
    },
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
      billableQty: Math.max(0, line.quantity - line.cancelledQty),
      cancelledQty: line.cancelledQty,
      id: line.id,
      sku: toPublicSku(line.sku),
      name: line.productName,
      productName: line.productName,
      imageUrl: line.productImageUrl,
      imageAlt: line.productImageAlt,
      category: sanitizeSupplierText(line.qualityGrade) || "Ricambio",
      quantity: line.quantity,
      picked: line.pickedQty || line.fulfilledQty || line.reservedQty,
      pickedQty: line.pickedQty,
      shortageQty: line.cancelledQty,
      lineStatus: orderLineStatus(line),
      unitPrice: line.unitPrice,
      lineTotal: line.lineNet,
      warehouse: normalizeWarehouse(line.location),
      stockStatus: line.stockStatus,
      reservedQty: line.reservedQty,
      fulfilledQty: line.fulfilledQty,
      batchCode: sanitizeSupplierText(line.batchCode),
    })),
    walletRefunds: (order.walletRefunds ?? []).map((refund) => ({
      amount: refund.amount,
      approvedAt: refund.approvedAt,
      approvedBy: refund.approvedBy,
      createdAt: refund.createdAt,
      creditedAt: refund.creditedAt,
      currency: refund.currency,
      customerId: refund.customerId,
      customerName: refund.customerName,
      id: refund.id,
      metadata: refund.metadata,
      orderId: refund.orderId,
      orderLineId: refund.orderLineId,
      orderNo: refund.orderNo,
      reason: refund.reason,
      requestType: refund.requestType,
      requestedAt: refund.requestedAt,
      requestedBy: refund.requestedBy,
      status: refund.status,
      updatedAt: refund.updatedAt,
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function orderLineStatus(line: NonNullable<AdminOrder["lines"]>[number]) {
  if (line.cancelledQty >= line.quantity) {
    return "shortage_cancelled";
  }

  if (line.cancelledQty > 0) {
    return "partial_shortage";
  }

  if (line.pickedQty >= line.quantity) {
    return "pick_confirmed";
  }

  return "pending";
}

function findPaymentCollector(
  order: AdminOrder,
  operationHistory: ReturnType<typeof toOrderOperationHistory>
) {
  const receivedById = order.paymentReceivedBy;
  if (!receivedById && !order.paymentReceivedAt) {
    return null;
  }

  const paymentEvent =
    operationHistory.find((event) => {
      if (event.eventType !== "payment_reconciled") {
        return false;
      }

      if (!receivedById) {
        return true;
      }

      return event.actor.id === receivedById;
    }) ?? null;

  if (!receivedById && !paymentEvent) {
    return null;
  }

  return {
    id: receivedById ?? paymentEvent?.actor.id ?? null,
    email: paymentEvent?.actor.email ?? null,
    name: paymentEvent?.actor.name ?? null,
    role: paymentEvent?.actor.role ?? null,
    label: paymentEvent?.actor.label ?? receivedById ?? null,
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
