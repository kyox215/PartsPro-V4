export type StorefrontTranslator = (key: string) => string;

export function tx(
  t: StorefrontTranslator,
  key: string,
  fallback: string
) {
  const value = t(key);

  return value === key ? fallback : value;
}

export function txCount(
  t: StorefrontTranslator,
  count: number,
  singularKey: string,
  singularFallback: string,
  pluralKey: string,
  pluralFallback: string
) {
  return count === 1
    ? tx(t, singularKey, singularFallback)
    : tx(t, pluralKey, pluralFallback);
}

const categoryKeys: Record<string, string> = {
  "Back Cover": "backCover",
  Batterie: "batteries",
  Connettori: "ports",
  "Flat Cable": "flexCables",
  Fotocamere: "cameras",
  Frame: "frames",
  Schermi: "screens",
  Speaker: "speakers",
};

const stockStatusKeys: Record<string, string> = {
  "In Stock": "inStock",
  "Low Stock": "lowStock",
  "Out of Stock": "outOfStock",
};

const orderStatusKeys: Record<string, string> = {
  cancelled: "cancelled",
  delivered: "delivered",
  draft: "draft",
  paid: "paid",
  pending_payment: "pendingPayment",
  picking: "picking",
  shipped: "shipped",
};

const rmaStatusKeys: Record<string, string> = {
  approved: "approved",
  received: "received",
  refunded: "refunded",
  rejected: "rejected",
  replaced: "replaced",
  requested: "requested",
};

const leadTimeKeys: Record<string, string> = {
  "24/48h Italia": "twentyFourFortyEightItaly",
  "48h Italia": "fortyEightItaly",
  "Riassortimento 5 giorni": "restockFiveDays",
};

const rmaReasonKeys: Record<string, string> = {
  "Batteria non conforme": "batteryNotCompliant",
  "Connettore danneggiato": "damagedConnector",
  "Danno da trasporto": "shippingDamage",
  "Difetto display / touch": "displayTouchDefect",
  "Prodotto errato": "wrongProduct",
  "Capacità sotto soglia test": "capacityBelowThreshold",
  "Touch non risponde dopo installazione": "touchNotResponding",
};

const rmaResolutionKeys: Record<string, string> = {
  "In attesa di verifica laboratorio": "waitingLabCheck",
  "Sostituzione spedita": "replacementShipped",
};

export function categoryLabel(t: StorefrontTranslator, value: string) {
  const key = categoryKeys[value];

  return key ? tx(t, `storefront.data.categories.${key}`, value) : value;
}

export function stockStatusLabel(t: StorefrontTranslator, value: string) {
  const key = stockStatusKeys[value];

  return key ? tx(t, `storefront.data.stockStatus.${key}`, value) : value;
}

export function orderStatusLabel(t: StorefrontTranslator, value: string) {
  const key = orderStatusKeys[value];

  return key ? tx(t, `storefront.data.orderStatus.${key}`, value) : value;
}

export function rmaStatusLabel(t: StorefrontTranslator, value: string) {
  const key = rmaStatusKeys[value];

  return key ? tx(t, `storefront.data.rmaStatus.${key}`, value) : value;
}

export function leadTimeLabel(t: StorefrontTranslator, value: string) {
  const key = leadTimeKeys[value];

  return key ? tx(t, `storefront.data.leadTime.${key}`, value) : value;
}

export function rmaReasonLabel(t: StorefrontTranslator, value: string) {
  const key = rmaReasonKeys[value];

  return key ? tx(t, `storefront.data.rmaReasons.${key}`, value) : value;
}

export function rmaResolutionLabel(t: StorefrontTranslator, value: string) {
  const key = rmaResolutionKeys[value];

  return key ? tx(t, `storefront.data.rmaResolutions.${key}`, value) : value;
}

export const storefrontItIT = {
  "storefront.data.categories.backCover": "Back Cover",
  "storefront.data.categories.batteries": "Batterie",
  "storefront.data.categories.cameras": "Fotocamere",
  "storefront.data.categories.flexCables": "Flat Cable",
  "storefront.data.categories.frames": "Frame",
  "storefront.data.categories.ports": "Connettori",
  "storefront.data.categories.screens": "Schermi",
  "storefront.data.categories.speakers": "Speaker",
  "storefront.data.leadTime.fortyEightItaly": "48h Italia",
  "storefront.data.leadTime.restockFiveDays": "Riassortimento 5 giorni",
  "storefront.data.leadTime.twentyFourFortyEightItaly": "24/48h Italia",
  "storefront.data.orderStatus.cancelled": "Annullato",
  "storefront.data.orderStatus.delivered": "Consegnato",
  "storefront.data.orderStatus.draft": "Bozza",
  "storefront.data.orderStatus.paid": "Pagato",
  "storefront.data.orderStatus.pendingPayment": "Da pagare",
  "storefront.data.orderStatus.picking": "In preparazione",
  "storefront.data.orderStatus.shipped": "Spedito",
  "storefront.data.rmaReasons.batteryNotCompliant": "Batteria non conforme",
  "storefront.data.rmaReasons.capacityBelowThreshold": "Capacità sotto soglia test",
  "storefront.data.rmaReasons.damagedConnector": "Connettore danneggiato",
  "storefront.data.rmaReasons.displayTouchDefect": "Difetto display / touch",
  "storefront.data.rmaReasons.shippingDamage": "Danno da trasporto",
  "storefront.data.rmaReasons.touchNotResponding": "Touch non risponde dopo installazione",
  "storefront.data.rmaReasons.wrongProduct": "Prodotto errato",
  "storefront.data.rmaResolutions.replacementShipped": "Sostituzione spedita",
  "storefront.data.rmaResolutions.waitingLabCheck": "In attesa di verifica laboratorio",
  "storefront.data.rmaStatus.approved": "Approvata",
  "storefront.data.rmaStatus.received": "Ricevuta",
  "storefront.data.rmaStatus.refunded": "Rimborsata",
  "storefront.data.rmaStatus.rejected": "Respinta",
  "storefront.data.rmaStatus.replaced": "Sostituita",
  "storefront.data.rmaStatus.requested": "Richiesta",
  "storefront.data.stockStatus.inStock": "Disponibile",
  "storefront.data.stockStatus.lowStock": "Scorta bassa",
  "storefront.data.stockStatus.outOfStock": "Esaurito",
};

export const storefrontZhCN = {
  "storefront.data.categories.backCover": "后盖",
  "storefront.data.categories.batteries": "电池",
  "storefront.data.categories.cameras": "摄像头",
  "storefront.data.categories.flexCables": "排线",
  "storefront.data.categories.frames": "中框",
  "storefront.data.categories.ports": "接口",
  "storefront.data.categories.screens": "屏幕",
  "storefront.data.categories.speakers": "扬声器",
  "storefront.data.leadTime.fortyEightItaly": "意大利 48 小时",
  "storefront.data.leadTime.restockFiveDays": "5 天后补货",
  "storefront.data.leadTime.twentyFourFortyEightItaly": "意大利 24/48 小时",
  "storefront.data.orderStatus.cancelled": "已取消",
  "storefront.data.orderStatus.delivered": "已送达",
  "storefront.data.orderStatus.draft": "草稿",
  "storefront.data.orderStatus.paid": "已付款",
  "storefront.data.orderStatus.pendingPayment": "待付款",
  "storefront.data.orderStatus.picking": "备货中",
  "storefront.data.orderStatus.shipped": "已发货",
  "storefront.data.rmaReasons.batteryNotCompliant": "电池不符合要求",
  "storefront.data.rmaReasons.capacityBelowThreshold": "容量测试低于阈值",
  "storefront.data.rmaReasons.damagedConnector": "连接器损坏",
  "storefront.data.rmaReasons.displayTouchDefect": "屏幕/触控故障",
  "storefront.data.rmaReasons.shippingDamage": "运输损坏",
  "storefront.data.rmaReasons.touchNotResponding": "安装后触控无响应",
  "storefront.data.rmaReasons.wrongProduct": "商品错误",
  "storefront.data.rmaResolutions.replacementShipped": "替换件已发出",
  "storefront.data.rmaResolutions.waitingLabCheck": "等待实验室检测",
  "storefront.data.rmaStatus.approved": "已批准",
  "storefront.data.rmaStatus.received": "已收到",
  "storefront.data.rmaStatus.refunded": "已退款",
  "storefront.data.rmaStatus.rejected": "已拒绝",
  "storefront.data.rmaStatus.replaced": "已更换",
  "storefront.data.rmaStatus.requested": "已提交",
  "storefront.data.stockStatus.inStock": "有库存",
  "storefront.data.stockStatus.lowStock": "库存紧张",
  "storefront.data.stockStatus.outOfStock": "缺货",
};

export const storefrontDictionaries = {
  "it-IT": storefrontItIT,
  "zh-CN": storefrontZhCN,
};
