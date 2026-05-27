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

const brandKeys: Record<string, string> = {
  Apple: "apple",
  Google: "google",
  Honor: "honor",
  Huawei: "huawei",
  OnePlus: "onePlus",
  Oppo: "oppo",
  Samsung: "samsung",
  Xiaomi: "xiaomi",
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

export function brandLabel(t: StorefrontTranslator, value: string) {
  const key = brandKeys[value];

  return key ? tx(t, `storefront.data.brands.${key}`, value) : value;
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
  "storefront.data.brands.apple": "Apple",
  "storefront.data.brands.google": "Google",
  "storefront.data.brands.honor": "Honor",
  "storefront.data.brands.huawei": "Huawei",
  "storefront.data.brands.onePlus": "OnePlus",
  "storefront.data.brands.oppo": "Oppo",
  "storefront.data.brands.samsung": "Samsung",
  "storefront.data.brands.xiaomi": "Xiaomi",
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
  "storefront.catalog.allProducts": "Tutto il catalogo",
  "storefront.catalog.availableOnly": "Solo disponibili",
  "storefront.catalog.availableOnlyAria": "Filtra solo prodotti disponibili",
  "storefront.account.menuLabel": "Area account",
  "storefront.account.openAccount": "Account B2B",
  "storefront.account.openAdmin": "Pannello admin",
  "storefront.account.signOut": "Esci",
  "storefront.account.staffRole": "Accesso staff",
  "storefront.common.b2bAccount": "Account B2B",
  "storefront.common.checkout": "Checkout",
  "storefront.header.openAccount": "Apri account B2B",
  "storefront.header.openCart": "Apri carrello",
  "storefront.header.openMenu": "Apri menu",
  "storefront.header.mobileMenuTitle": "Menu PartsPro",
  "storefront.header.searchFull": "Cerca SKU, brand, modello...",
  "storefront.logo.tagline": "Ricambi smartphone B2B Italia",
  "storefront.home.brands.eyebrow": "Brand e modelli",
  "storefront.home.brands.stats.brands": "brand gestiti",
  "storefront.home.brands.stats.delivery": "Italia",
  "storefront.home.brands.stats.models": "modelli indicizzati",
  "storefront.home.brands.stats.sku": "SKU catalogo",
  "storefront.home.brands.title": "Navigazione rapida per compatibilità",
  "storefront.home.categories.eyebrow": "Catalogo",
  "storefront.home.categories.title": "Categorie richieste dai laboratori",
  "storefront.home.common.catalog": "Catalogo",
  "storefront.home.common.openCatalog": "Apri catalogo",
  "storefront.home.common.skuCount": "{count} SKU",
  "storefront.home.common.viewAll": "Vedi tutto",
  "storefront.home.header.availableOnly": "Solo disponibili",
  "storefront.home.header.logoLabel": "Torna alla home PartsPro",
  "storefront.home.hero.badge": "Forniture B2B Italia",
  "storefront.home.hero.browseCatalog": "Sfoglia catalogo",
  "storefront.home.hero.catalogFallback": "Catalogo B2B",
  "storefront.home.hero.description":
    "PartsPro unisce catalogo B2B, disponibilità locale, prezzi riservati, fatturazione elettronica e RMA tracciabile in un unico flusso per il mercato italiano.",
  "storefront.home.hero.loginForPrices": "Accedi ai prezzi",
  "storefront.home.hero.stats.brands": "brand e famiglie",
  "storefront.home.hero.stats.delivery": "logistica Italia",
  "storefront.home.hero.stats.sku": "SKU nel catalogo",
  "storefront.home.hero.title": "Ricambi smartphone per laboratori e rivenditori",
  "storefront.home.hero.visualText":
    "SKU, stock, MOQ e compatibilità sono pensati per acquisti ricorrenti.",
  "storefront.home.hero.visualTitle": "Catalogo operativo, non vetrina statica",
  "storefront.home.notifications": "Notifiche",
  "storefront.home.mobileMenuDescription": "Menu mobile con home, catalogo e account.",
  "storefront.home.mobileSearch": "Cerca SKU / prodotto",
  "storefront.home.productCard.extraModels": "+{count} modelli",
  "storefront.home.productCard.loginPrice": "Prezzo dopo login",
  "storefront.home.productCard.open": "Apri",
  "storefront.home.productCard.openAria": "Apri scheda prodotto {name}",
  "storefront.home.productCard.priceHint": "MOQ {moq} · listino B2B",
  "storefront.home.productCard.stockLine": "{status} · {count} pz",
  "storefront.home.products.action": "Disponibili ora",
  "storefront.home.products.empty":
    "Il catalogo pubblico non è disponibile in questo momento. Puoi comunque aprire il catalogo o accedere per verificare il listino.",
  "storefront.home.products.eyebrow": "Stock reale",
  "storefront.home.products.title": "Ricambi pronti da consultare",
  "storefront.home.rightRail.account.subtitle": "Prezzi, ordini e RMA",
  "storefront.home.rightRail.account.title": "Area buyer",
  "storefront.home.rightRail.cart.empty": "Aggiungi un prodotto per preparare checkout e ordine.",
  "storefront.home.rightRail.cart.manyLines": "{count} righe",
  "storefront.home.rightRail.cart.oneLine": "1 riga",
  "storefront.home.rightRail.cart.quantity": "{count} pz",
  "storefront.home.rightRail.cart.subtotal": "Subtotale",
  "storefront.home.rightRail.cart.title": "Anteprima carrello",
  "storefront.home.rightRail.invoice.eInvoice": "Fattura elettronica con PEC / SDI",
  "storefront.home.rightRail.invoice.payment": "Prezzi netti dopo approvazione",
  "storefront.home.rightRail.invoice.title": "Documenti B2B",
  "storefront.home.rightRail.invoice.trace": "SKU e lotti tracciati in ordine",
  "storefront.home.searchPlaceholder": "Cerca prodotto, SKU, brand, modello...",
  "storefront.home.sidebar.subtitle": "Brand e modelli",
  "storefront.home.sidebar.title": "Catalogo rapido",
  "storefront.home.trust.delivery.title": "Logistica Italia",
  "storefront.home.trust.delivery.value": "24/48h sui ricambi disponibili",
  "storefront.home.trust.invoice.title": "Fattura B2B",
  "storefront.home.trust.invoice.value": "PEC, Codice SDI e dati aziendali",
  "storefront.home.trust.localStock.title": "Stock locale",
  "storefront.home.trust.localStock.value": "Disponibilità aggiornata per SKU e modello",
  "storefront.home.trust.quality.title": "Qualità verificata",
  "storefront.home.trust.quality.value": "Gradi, lotti e controlli pre-spedizione",
  "storefront.home.trust.support.title": "RMA tracciabile",
  "storefront.home.trust.support.value": "Assistenza post-vendita per laboratori",
  "storefront.home.workflow.account.text":
    "Accedi o richiedi approvazione per vedere prezzi e condizioni.",
  "storefront.home.workflow.account.title": "Verifica il profilo B2B",
  "storefront.home.workflow.action": "Apri account",
  "storefront.home.workflow.afterSales.text":
    "Segui richieste, fatture e storico direttamente dall'account.",
  "storefront.home.workflow.afterSales.title": "Gestisci RMA e documenti",
  "storefront.home.workflow.catalog.text":
    "Filtra per brand, modello, categoria e disponibilità reale.",
  "storefront.home.workflow.catalog.title": "Trova il ricambio",
  "storefront.home.workflow.eyebrow": "Flusso B2B",
  "storefront.home.workflow.order.text":
    "Aggiungi MOQ, conferma IVA e spedizione, poi invia l'ordine.",
  "storefront.home.workflow.order.title": "Prepara l'ordine",
  "storefront.home.workflow.title": "Dalla ricerca al post-vendita senza passaggi manuali",
};

export const storefrontZhCN = {
  "storefront.data.brands.apple": "苹果",
  "storefront.data.brands.google": "谷歌",
  "storefront.data.brands.honor": "荣耀",
  "storefront.data.brands.huawei": "华为",
  "storefront.data.brands.onePlus": "一加",
  "storefront.data.brands.oppo": "OPPO",
  "storefront.data.brands.samsung": "三星",
  "storefront.data.brands.xiaomi": "小米",
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
  "storefront.catalog.allProducts": "全部目录",
  "storefront.catalog.availableOnly": "仅看有货",
  "storefront.catalog.availableOnlyAria": "仅筛选有货商品",
  "storefront.account.menuLabel": "账户区域",
  "storefront.account.openAccount": "B2B 账户",
  "storefront.account.openAdmin": "后台面板",
  "storefront.account.signOut": "退出账号",
  "storefront.account.staffRole": "员工权限",
  "storefront.common.b2bAccount": "B2B 账户",
  "storefront.common.checkout": "结账",
  "storefront.header.openAccount": "打开 B2B 账户",
  "storefront.header.openCart": "打开购物车",
  "storefront.header.openMenu": "打开菜单",
  "storefront.header.mobileMenuTitle": "PartsPro 菜单",
  "storefront.header.searchFull": "搜索 SKU、品牌、机型...",
  "storefront.logo.tagline": "意大利 B2B 手机配件",
  "storefront.home.brands.eyebrow": "品牌与机型",
  "storefront.home.brands.stats.brands": "管理品牌",
  "storefront.home.brands.stats.delivery": "意大利",
  "storefront.home.brands.stats.models": "已索引机型",
  "storefront.home.brands.stats.sku": "目录 SKU",
  "storefront.home.brands.title": "按兼容性快速导航",
  "storefront.home.categories.eyebrow": "目录",
  "storefront.home.categories.title": "维修店常用分类",
  "storefront.home.common.catalog": "目录",
  "storefront.home.common.openCatalog": "打开目录",
  "storefront.home.common.skuCount": "{count} SKU",
  "storefront.home.common.viewAll": "查看全部",
  "storefront.home.header.availableOnly": "仅看有货",
  "storefront.home.header.logoLabel": "返回 PartsPro 首页",
  "storefront.home.hero.badge": "意大利 B2B 供货",
  "storefront.home.hero.browseCatalog": "浏览目录",
  "storefront.home.hero.catalogFallback": "B2B 目录",
  "storefront.home.hero.description":
    "PartsPro 将 B2B 目录、本地库存、登录后专属价格、电子发票和可追踪 RMA 统一到一个面向意大利市场的采购流程中。",
  "storefront.home.hero.loginForPrices": "登录查看价格",
  "storefront.home.hero.stats.brands": "品牌与系列",
  "storefront.home.hero.stats.delivery": "意大利物流",
  "storefront.home.hero.stats.sku": "目录 SKU",
  "storefront.home.hero.title": "面向维修店和经销商的手机配件供货",
  "storefront.home.hero.visualText": "SKU、库存、起订量和兼容性信息都围绕高频补货采购设计。",
  "storefront.home.hero.visualTitle": "可操作目录，不是静态展示页",
  "storefront.home.notifications": "通知",
  "storefront.home.mobileMenuDescription": "移动菜单包含首页、目录和账户。",
  "storefront.home.mobileSearch": "搜索 SKU / 商品",
  "storefront.home.productCard.extraModels": "+{count} 个机型",
  "storefront.home.productCard.loginPrice": "登录后查看价格",
  "storefront.home.productCard.open": "查看",
  "storefront.home.productCard.openAria": "打开商品详情 {name}",
  "storefront.home.productCard.priceHint": "起订量 {moq} · B2B 价目表",
  "storefront.home.productCard.stockLine": "{status} · {count} 件",
  "storefront.home.products.action": "当前有货",
  "storefront.home.products.empty":
    "公共目录暂时不可用。你仍可以打开目录，或登录后查看完整价目表。",
  "storefront.home.products.eyebrow": "真实库存",
  "storefront.home.products.title": "可立即查看的现货配件",
  "storefront.home.rightRail.account.subtitle": "价格、订单和 RMA",
  "storefront.home.rightRail.account.title": "采购账户",
  "storefront.home.rightRail.cart.empty": "添加商品后即可准备结账和订单。",
  "storefront.home.rightRail.cart.manyLines": "{count} 行",
  "storefront.home.rightRail.cart.oneLine": "1 行",
  "storefront.home.rightRail.cart.quantity": "{count} 件",
  "storefront.home.rightRail.cart.subtotal": "小计",
  "storefront.home.rightRail.cart.title": "购物车预览",
  "storefront.home.rightRail.invoice.eInvoice": "支持 PEC / SDI 电子发票",
  "storefront.home.rightRail.invoice.payment": "审核后显示净价",
  "storefront.home.rightRail.invoice.title": "B2B 单据",
  "storefront.home.rightRail.invoice.trace": "订单中追踪 SKU 与批次",
  "storefront.home.searchPlaceholder": "搜索商品、SKU、品牌、机型...",
  "storefront.home.sidebar.subtitle": "品牌与机型",
  "storefront.home.sidebar.title": "快速目录",
  "storefront.home.trust.delivery.title": "意大利物流",
  "storefront.home.trust.delivery.value": "有货配件 24/48 小时配送",
  "storefront.home.trust.invoice.title": "B2B 发票",
  "storefront.home.trust.invoice.value": "PEC、SDI 和公司开票资料",
  "storefront.home.trust.localStock.title": "本地库存",
  "storefront.home.trust.localStock.value": "按 SKU 和机型更新可用库存",
  "storefront.home.trust.quality.title": "质量已验证",
  "storefront.home.trust.quality.value": "等级、批次和发货前质检",
  "storefront.home.trust.support.title": "可追踪 RMA",
  "storefront.home.trust.support.value": "为维修店提供售后支持",
  "storefront.home.workflow.account.text": "登录或申请审核后查看价格与采购条件。",
  "storefront.home.workflow.account.title": "验证 B2B 资料",
  "storefront.home.workflow.action": "打开账户",
  "storefront.home.workflow.afterSales.text": "在账户中追踪 RMA、发票和历史记录。",
  "storefront.home.workflow.afterSales.title": "管理 RMA 与单据",
  "storefront.home.workflow.catalog.text": "按品牌、机型、分类和真实库存筛选。",
  "storefront.home.workflow.catalog.title": "找到配件",
  "storefront.home.workflow.eyebrow": "B2B 流程",
  "storefront.home.workflow.order.text": "设置起订量，确认增值税与配送，然后提交订单。",
  "storefront.home.workflow.order.title": "准备订单",
  "storefront.home.workflow.title": "从搜索到售后，减少手动沟通",
};

export const storefrontDictionaries = {
  "it-IT": storefrontItIT,
  "zh-CN": storefrontZhCN,
};
