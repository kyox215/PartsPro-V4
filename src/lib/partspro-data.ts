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
  { label: "Schermi", value: "Screen", visual: "screen" as const, count: 0 },
  { label: "Batterie", value: "Battery", visual: "battery" as const, count: 0 },
  { label: "Back Cover", value: "Back Cover", visual: "cover" as const, count: 0 },
  { label: "Connettori", value: "Port", visual: "port" as const, count: 0 },
  { label: "Fotocamere", value: "Camera", visual: "camera" as const, count: 0 },
  { label: "Flat Cable", value: "Flex Cable", visual: "flex" as const, count: 0 },
  { label: "Speaker", value: "Speaker", visual: "speaker" as const, count: 0 },
  { label: "Frame", value: "Middle Frame", visual: "frame" as const, count: 0 },
];

export const products: PartProduct[] = [];

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

export const companyProfiles: CompanyProfile[] = [];

export const orderSummaries: OrderSummary[] = [];

export const rmaRequests: RmaRequest[] = [];

export type DashboardStat = {
  label: string;
  value: string;
  delta: string;
  tone: "blue" | "green" | "violet" | "cyan";
};

export type SalesTrendPoint = {
  day: string;
  sales: number;
  orders: number;
};

export type MonthlyOrderPoint = {
  month: string;
  paid: number;
  pending: number;
};

export type InventoryMixItem = {
  name: StockStatus;
  value: number;
  fill: string;
};

export const dashboardStats: DashboardStat[] = [];

export const salesTrend: SalesTrendPoint[] = [];

export const monthlyOrders: MonthlyOrderPoint[] = [];

export const inventoryMix: InventoryMixItem[] = [];

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

export const cartItems: Array<{ sku: string; quantity: number }> = [];

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
