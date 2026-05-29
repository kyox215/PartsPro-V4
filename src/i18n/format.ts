import type { Locale } from "./config";
import type {
  CompanyStatus,
  OrderStatus,
  RmaStatus,
  StockStatus,
} from "@/lib/partspro-data";

export function formatMoney(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function stockStatusLabel(status: StockStatus, locale: Locale) {
  if (locale === "zh-CN") {
    return {
      "In Stock": "有库存",
      "Low Stock": "库存低",
      "Out of Stock": "缺货",
    }[status];
  }

  return {
    "In Stock": "Disponibile",
    "Low Stock": "Scorte basse",
    "Out of Stock": "Esaurito",
  }[status];
}

export function orderStatusLabel(status: OrderStatus, locale: Locale) {
  if (locale === "zh-CN") {
    return {
      draft: "草稿",
      pending_payment: "待付款",
      submitted: "新订单",
      accepted: "已接单",
      paid: "已付款",
      picking: "拣货中",
      packed: "已打包",
      shipped: "已发货",
      completed: "已完成",
      delivered: "已送达",
      cancelled: "已取消",
    }[status];
  }

  return {
    draft: "Bozza",
    pending_payment: "In attesa pagamento",
    submitted: "Nuovo ordine",
    accepted: "Accettato",
    paid: "Pagato",
    picking: "Preparazione",
    packed: "Imballato",
    shipped: "Spedito",
    completed: "Completato",
    delivered: "Consegnato",
    cancelled: "Annullato",
  }[status];
}

export function companyStatusLabel(status: CompanyStatus, locale: Locale) {
  if (locale === "zh-CN") {
    return {
      pending: "审核中",
      approved: "已批准",
      rejected: "已拒绝",
      suspended: "已暂停",
    }[status];
  }

  return {
    pending: "In revisione",
    approved: "Approvato",
    rejected: "Respinto",
    suspended: "Sospeso",
  }[status];
}

export function rmaStatusLabel(status: RmaStatus, locale: Locale) {
  if (locale === "zh-CN") {
    return {
      requested: "已申请",
      approved: "已批准",
      rejected: "已拒绝",
      received: "已收货",
      replaced: "已换货",
      refunded: "已退款",
    }[status];
  }

  return {
    requested: "Richiesta",
    approved: "Approvata",
    rejected: "Respinta",
    received: "Ricevuta",
    replaced: "Sostituita",
    refunded: "Rimborsata",
  }[status];
}
