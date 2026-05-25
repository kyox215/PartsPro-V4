export type PartVisual =
  | "screen"
  | "battery"
  | "cover"
  | "port"
  | "camera"
  | "flex"
  | "speaker"
  | "frame";

export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";
export type ProductGrade = "A+" | "A" | "B" | "Refurbished";
export type CompanyStatus = "pending" | "approved" | "rejected" | "suspended";
export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "picking"
  | "shipped"
  | "delivered"
  | "cancelled";
export type RmaStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "replaced"
  | "refunded";

export type PartProduct = {
  sku: string;
  slug: string;
  name: string;
  category: string;
  brand: string;
  grade: ProductGrade;
  price: number;
  retailPrice: number;
  stock: number;
  status: StockStatus;
  updatedAt: string;
  visual: PartVisual;
  compatibleWith: string[];
  warehouse: "Milano" | "Roma" | "Shenzhen";
  moq: number;
  vatRate: number;
  rmaDays: number;
  leadTime: string;
  tags: string[];
};

export type SourcedApplePart = {
  id: string;
  model: string;
  part: string;
  title: string;
  reference: string;
  imageUrl: string;
  sourceUrl: string;
  sourceName: string;
};

export type CompanyProfile = {
  id: string;
  name: string;
  partitaIva: string;
  codiceFiscale: string;
  pec: string;
  codiceDestinatario: string;
  status: CompanyStatus;
  priceList: "Standard" | "Pro" | "Partner";
  city: string;
  province: string;
};

export type OrderSummary = {
  id: string;
  date: string;
  status: OrderStatus;
  company: string;
  total: number;
  items: number;
};

export type RmaRequest = {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  status: RmaStatus;
  reason: string;
  createdAt: string;
  resolution: string;
};

export const deviceModels = [
  { brand: "Apple", models: ["iPhone 11", "iPhone 12", "iPhone 13", "iPhone 14", "iPhone 15"] },
  { brand: "Samsung", models: ["Galaxy S21", "Galaxy S22", "Galaxy A52", "Galaxy A54"] },
  { brand: "Xiaomi", models: ["Redmi Note 12", "Mi 11", "Poco F5"] },
  { brand: "Huawei", models: ["P30", "P40", "Mate 40"] },
  { brand: "Oppo", models: ["Find X5", "Reno 8", "A96"] },
  { brand: "Honor", models: ["Honor 70", "Honor 90", "Magic 5"] },
];

export const categories = [
  { label: "Schermi", value: "Screen", visual: "screen" as const, count: 168 },
  { label: "Batterie", value: "Battery", visual: "battery" as const, count: 96 },
  { label: "Back Cover", value: "Back Cover", visual: "cover" as const, count: 74 },
  { label: "Connettori", value: "Port", visual: "port" as const, count: 45 },
  { label: "Fotocamere", value: "Camera", visual: "camera" as const, count: 58 },
  { label: "Flat Cable", value: "Flex Cable", visual: "flex" as const, count: 121 },
  { label: "Speaker", value: "Speaker", visual: "speaker" as const, count: 64 },
  { label: "Frame", value: "Middle Frame", visual: "frame" as const, count: 37 },
];

export const products: PartProduct[] = [
  {
    sku: "IP13P-OLED-A+",
    slug: "iphone-13-pro-oled-a-plus",
    name: "Display OLED iPhone 13 Pro",
    category: "Schermi",
    brand: "Apple",
    grade: "A+",
    price: 45.9,
    retailPrice: 62.9,
    stock: 25,
    status: "In Stock",
    updatedAt: "2026-05-18 10:30",
    visual: "screen",
    compatibleWith: ["iPhone 13 Pro"],
    warehouse: "Milano",
    moq: 1,
    vatRate: 22,
    rmaDays: 30,
    leadTime: "24/48h Italia",
    tags: ["OLED", "True Tone", "Wholesale"],
  },
  {
    sku: "SAM-S21-BAT",
    slug: "samsung-s21-battery-oem",
    name: "Batteria Samsung Galaxy S21",
    category: "Batterie",
    brand: "Samsung",
    grade: "A",
    price: 28.5,
    retailPrice: 39.9,
    stock: 18,
    status: "Low Stock",
    updatedAt: "2026-05-18 09:20",
    visual: "battery",
    compatibleWith: ["Galaxy S21"],
    warehouse: "Milano",
    moq: 2,
    vatRate: 22,
    rmaDays: 30,
    leadTime: "24/48h Italia",
    tags: ["OEM", "Alta capacità"],
  },
  {
    sku: "IP12-LCD-INC",
    slug: "iphone-12-lcd-compatible",
    name: "Display LCD compatibile iPhone 12",
    category: "Schermi",
    brand: "Apple",
    grade: "B",
    price: 26,
    retailPrice: 34.9,
    stock: 0,
    status: "Out of Stock",
    updatedAt: "2026-05-18 08:15",
    visual: "screen",
    compatibleWith: ["iPhone 12", "iPhone 12 Pro"],
    warehouse: "Roma",
    moq: 1,
    vatRate: 22,
    rmaDays: 14,
    leadTime: "Riassortimento 5 giorni",
    tags: ["Compatibile", "Economy"],
  },
  {
    sku: "USB-C-DOCK",
    slug: "usb-c-charging-dock-board",
    name: "Scheda connettore USB-C",
    category: "Connettori",
    brand: "Xiaomi",
    grade: "A+",
    price: 4.8,
    retailPrice: 8.9,
    stock: 50,
    status: "In Stock",
    updatedAt: "2026-05-17 16:45",
    visual: "port",
    compatibleWith: ["Redmi Note 12", "Poco F5"],
    warehouse: "Milano",
    moq: 5,
    vatRate: 22,
    rmaDays: 30,
    leadTime: "24/48h Italia",
    tags: ["USB-C", "Fast moving"],
  },
  {
    sku: "IP11-CAM",
    slug: "iphone-11-camera-module",
    name: "Modulo fotocamera iPhone 11",
    category: "Fotocamere",
    brand: "Apple",
    grade: "A",
    price: 19,
    retailPrice: 29,
    stock: 12,
    status: "In Stock",
    updatedAt: "2026-05-17 14:30",
    visual: "camera",
    compatibleWith: ["iPhone 11"],
    warehouse: "Roma",
    moq: 1,
    vatRate: 22,
    rmaDays: 30,
    leadTime: "48h Italia",
    tags: ["OEM pull", "Testato"],
  },
  {
    sku: "PXR-LCD",
    slug: "pixel-8-lcd-refurbished",
    name: "Display Pixel 8 ricondizionato",
    category: "Schermi",
    brand: "Google",
    grade: "Refurbished",
    price: 31.2,
    retailPrice: 44.9,
    stock: 3,
    status: "Low Stock",
    updatedAt: "2026-05-16 18:10",
    visual: "screen",
    compatibleWith: ["Pixel 8"],
    warehouse: "Milano",
    moq: 1,
    vatRate: 22,
    rmaDays: 14,
    leadTime: "24/48h Italia",
    tags: ["Ricondizionato", "QC passato"],
  },
  {
    sku: "HON90-FLEX",
    slug: "honor-90-main-flex-cable",
    name: "Flat cable principale Honor 90",
    category: "Flat Cable",
    brand: "Honor",
    grade: "A",
    price: 7.4,
    retailPrice: 12.5,
    stock: 36,
    status: "In Stock",
    updatedAt: "2026-05-16 12:20",
    visual: "flex",
    compatibleWith: ["Honor 90"],
    warehouse: "Milano",
    moq: 3,
    vatRate: 22,
    rmaDays: 30,
    leadTime: "24/48h Italia",
    tags: ["Compatibile", "Alta rotazione"],
  },
  {
    sku: "OPPO-X5-COVER",
    slug: "oppo-find-x5-back-cover",
    name: "Back cover Oppo Find X5",
    category: "Back Cover",
    brand: "Oppo",
    grade: "A+",
    price: 12.9,
    retailPrice: 21.5,
    stock: 22,
    status: "In Stock",
    updatedAt: "2026-05-15 11:05",
    visual: "cover",
    compatibleWith: ["Find X5"],
    warehouse: "Roma",
    moq: 2,
    vatRate: 22,
    rmaDays: 30,
    leadTime: "48h Italia",
    tags: ["Nero", "Vetro"],
  },
];

export const mobilaxAppleParts: SourcedApplePart[] = [
  {
    id: "mobilax-ip13p-display-661-21993",
    model: "iPhone 13 Pro",
    part: "Display Touchscreen",
    title: "Original Display Touchscreen Apple iPhone 13 Pro 661-21993 (Service Pack) Universal Black",
    reference: "3000000208380",
    imageUrl:
      "https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/51052?size=bg",
    sourceUrl:
      "https://www.mobilax.com/original-screen-touch-apple-iphone-13-pro-661-21993-black",
    sourceName: "Mobilax",
  },
  {
    id: "mobilax-ip13-battery-661-21991",
    model: "iPhone 13",
    part: "Original Battery",
    title: "Original Battery Apple iPhone 13 661-21991 (Service Pack)",
    reference: "3000000410875",
    imageUrl:
      "https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/87622?size=bg",
    sourceUrl: "https://www.mobilax.com/original-battery-apple-iphone-13-661-21991",
    sourceName: "Mobilax",
  },
  {
    id: "mobilax-ip15pm-back-cover",
    model: "iPhone 15 Pro Max",
    part: "Back Cover",
    title: "Premium Back Cover Apple iPhone 15 Pro Max (Without Part) Black Titanium",
    reference: "3000000288559",
    imageUrl:
      "https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/55323?size=bg",
    sourceUrl:
      "https://www.mobilax.com/back-cover-premium-apple-iphone-15-pro-max-titanium-black",
    sourceName: "Mobilax",
  },
  {
    id: "mobilax-ip14p-fpc-connector",
    model: "iPhone 14 Pro / 14 Pro Max",
    part: "LCD FPC Connector",
    title: "FPC Connector Apple iPhone 14 Pro & 14 Pro Max LCD Screen and Digitizer 50 Pins",
    reference: "3000000356210",
    imageUrl:
      "https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/73700?size=bg",
    sourceUrl:
      "https://www.mobilax.com/fpc-connector-apple-iphone-14-pro-iphone-14-pro-max-ecran-lcd-et-numeriseur-50-pins",
    sourceName: "Mobilax",
  },
  {
    id: "mobilax-ip13pm-soft-oled",
    model: "iPhone 13 Pro Max",
    part: "Soft OLED Display",
    title: "Soft Oled Display Touchscreen Diagnostic Apple iPhone 13 Pro Max (120Hz) Black",
    reference: "3000000396193",
    imageUrl:
      "https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/92447?size=bg",
    sourceUrl:
      "https://www.mobilax.com/soft-oled-display-touchscreen-diagnostic-apple-iphone-13-pro-max-120hz-black",
    sourceName: "Mobilax",
  },
  {
    id: "mobilax-ip15-dock-connector",
    model: "iPhone 15",
    part: "Dock Connector",
    title: "Original Pulled Dock Connector Apple iPhone 15 Black",
    reference: "3000000255940",
    imageUrl:
      "https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/82710?size=bg",
    sourceUrl: "https://www.mobilax.com/dock-connector-apple-iphone-15-black",
    sourceName: "Mobilax",
  },
];

export const companyProfiles: CompanyProfile[] = [
  {
    id: "cmp-001",
    name: "RiparaMi S.r.l.",
    partitaIva: "IT12345678901",
    codiceFiscale: "12345678901",
    pec: "amministrazione@riparami.pec.it",
    codiceDestinatario: "M5UXCR1",
    status: "approved",
    priceList: "Pro",
    city: "Milano",
    province: "MI",
  },
  {
    id: "cmp-002",
    name: "TechFix Roma",
    partitaIva: "IT09876543210",
    codiceFiscale: "09876543210",
    pec: "techfixroma@pec.it",
    codiceDestinatario: "0000000",
    status: "pending",
    priceList: "Standard",
    city: "Roma",
    province: "RM",
  },
];

export const orderSummaries: OrderSummary[] = [
  {
    id: "ORD-2026-0567",
    date: "24/05/2026",
    status: "picking",
    company: "RiparaMi S.r.l.",
    total: 284.62,
    items: 9,
  },
  {
    id: "ORD-2026-0566",
    date: "23/05/2026",
    status: "shipped",
    company: "MobileCare Firenze",
    total: 117.3,
    items: 3,
  },
  {
    id: "ORD-2026-0565",
    date: "22/05/2026",
    status: "pending_payment",
    company: "TechFix Roma",
    total: 82.96,
    items: 4,
  },
];

export const rmaRequests: RmaRequest[] = [
  {
    id: "RMA-2026-014",
    orderId: "ORD-2026-0566",
    sku: "IP12-LCD-INC",
    productName: "Display LCD compatibile iPhone 12",
    status: "requested",
    reason: "Touch non risponde dopo installazione",
    createdAt: "24/05/2026",
    resolution: "In attesa di verifica laboratorio",
  },
  {
    id: "RMA-2026-011",
    orderId: "ORD-2026-0558",
    sku: "SAM-S21-BAT",
    productName: "Batteria Samsung Galaxy S21",
    status: "replaced",
    reason: "Capacità sotto soglia test",
    createdAt: "18/05/2026",
    resolution: "Sostituzione spedita",
  },
];

export const dashboardStats = [
  { label: "Ordini oggi", value: "128", delta: "+12.5%", tone: "blue" },
  { label: "Fatturato", value: "€12,450", delta: "+8.21%", tone: "green" },
  { label: "Clienti B2B", value: "856", delta: "+15.2%", tone: "violet" },
  { label: "SKU attivi", value: "3,251", delta: "+5.7%", tone: "cyan" },
];

export const salesTrend = [
  { day: "18/05", sales: 1800, orders: 72 },
  { day: "19/05", sales: 2650, orders: 96 },
  { day: "20/05", sales: 3020, orders: 104 },
  { day: "21/05", sales: 2760, orders: 92 },
  { day: "22/05", sales: 4120, orders: 138 },
  { day: "23/05", sales: 3290, orders: 116 },
  { day: "24/05", sales: 4680, orders: 154 },
];

export const monthlyOrders = [
  { month: "Gen", paid: 2400, pending: 980 },
  { month: "Feb", paid: 1800, pending: 760 },
  { month: "Mar", paid: 3200, pending: 1210 },
  { month: "Apr", paid: 2600, pending: 840 },
  { month: "Mag", paid: 3650, pending: 1020 },
  { month: "Giu", paid: 2860, pending: 720 },
  { month: "Lug", paid: 1980, pending: 540 },
];

export const inventoryMix = [
  { name: "In Stock", value: 1931, fill: "#38bdf8" },
  { name: "Low Stock", value: 511, fill: "#f59e0b" },
  { name: "Out of Stock", value: 398, fill: "#ef4444" },
];

export const brands = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Huawei",
  "Oppo",
  "Honor",
  "Google",
  "OnePlus",
];

export const cartItems = [
  { sku: "IP13P-OLED-A+", quantity: 2 },
  { sku: "SAM-S21-BAT", quantity: 3 },
  { sku: "USB-C-DOCK", quantity: 8 },
];

export function getProductBySkuOrSlug(value: string) {
  return products.find((product) => product.sku === value || product.slug === value);
}

export function getCartLines() {
  return cartItems
    .map((item) => {
      const product = products.find((entry) => entry.sku === item.sku);

      if (!product) {
        return null;
      }

      return {
        ...item,
        product,
        lineTotal: product.price * item.quantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export function calculateCartTotals() {
  const lines = getCartLines();
  const subtotal = roundMoney(lines.reduce((total, line) => total + line.lineTotal, 0));
  const shipping = subtotal > 250 ? 0 : 12.9;
  const vat = roundMoney((subtotal + shipping) * 0.22);

  return {
    lines,
    subtotal,
    shipping,
    vat,
    total: roundMoney(subtotal + shipping + vat),
  };
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
