import { type AdminOrder } from "@/lib/partspro-repository";

export function toAdminOrderDto(order: AdminOrder, overlay: Record<string, unknown> = {}) {
  return {
    id: order.orderNo,
    orderId: order.id,
    remoteId: order.id,
    number: order.orderNo,
    date: order.createdAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    status: order.uiStatus,
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
    },
    total: order.total,
    totalNet: order.totalNet,
    vat: order.vat,
    shipping: order.shipping,
    items: order.lineCount,
    paymentMethod: order.paymentStatus === "paid" ? "Incassato" : "Da incassare",
    paymentDue: order.paymentStatus === "paid" ? "Pagato" : "Da verificare",
    warehouse: primaryWarehouse(order),
    carrier: order.carrier,
    tracking: order.trackingCode,
    service: order.shippingMethod || "Da pianificare",
    eta: order.status === "shipped" || order.status === "completed" ? "In transito" : "Da pianificare",
    shippingAddress: order.deliveryAddress,
    owner: "Operations",
    notes: order.staffNote || order.customerNote,
    lines: (order.lines ?? []).map((line) => ({
      id: line.id,
      sku: line.sku,
      name: line.productName,
      productName: line.productName,
      category: line.qualityGrade || "Ricambio",
      quantity: line.quantity,
      picked: line.fulfilledQty || line.reservedQty,
      unitPrice: line.unitPrice,
      lineTotal: line.lineNet,
      warehouse: normalizeWarehouse(line.location),
      stockStatus: line.stockStatus,
      reservedQty: line.reservedQty,
      fulfilledQty: line.fulfilledQty,
      batchCode: line.batchCode,
    })),
    activity: (order.events ?? []).map((event) =>
      [
        event.createdAt,
        event.eventType,
        event.fromStatus && event.toStatus
          ? `${event.fromStatus} -> ${event.toStatus}`
          : null,
        event.note,
      ]
        .filter(Boolean)
        .join(" - ")
    ),
    ...overlay,
  };
}

function toUiPaymentStatus(status: AdminOrder["paymentStatus"]) {
  if (status === "paid") {
    return "paid";
  }

  if (status === "failed") {
    return "unpaid";
  }

  return "unpaid";
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
  const normalized = value?.toLowerCase() ?? "";

  if (normalized.includes("roma") || normalized.includes("rome")) {
    return "Roma";
  }

  if (normalized.includes("shenzhen") || normalized.includes("china")) {
    return "Shenzhen";
  }

  return "Milano";
}
