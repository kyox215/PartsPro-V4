import { calculateShippingCents } from "@/lib/partspro-shipping";

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
  | "submitted"
  | "accepted"
  | "paid"
  | "picking"
  | "packed"
  | "shipped"
  | "completed"
  | "delivered"
  | "cancelled";
export type RmaStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "replaced"
  | "refunded";
export type CustomerType = "retail" | "wholesale";
export type CustomerAssignmentStatus =
  | "needs_review"
  | "assigned"
  | "converted_to_employee"
  | "archived";
export type CustomerProfileKind =
  | "customer"
  | "employee_self"
  | "archived_customer";
export type CustomerLevel =
  | "bronze"
  | "silver"
  | "gold"
  | "emerald"
  | "diamond"
  | "master"
  | "king";

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
  warehouse: "Milano";
  moq: number;
  vatRate: number;
  rmaDays: number;
  leadTime: string;
  tags: string[];
  imageUrl?: string;
  imageAlt?: string;
  galleryImageUrls?: string[];
  basePrice?: number;
  customerLevel?: CustomerLevel | string;
  discountPercent?: number;
  levelDiscountAmount?: number;
  levelDiscountPercent?: number;
  marginPercent?: number;
  priceGroupDiscountPercent?: number;
  priceGroupId?: string | null;
  priceResolved?: boolean;
  priceResolvedAt?: string;
  priceSource?: string;
  priceVersion?: string;
};

export type DeviceModelSeriesGroup = {
  series: string;
  models: string[];
};

export type DeviceModelGroup = {
  brand: string;
  models: string[];
  series?: DeviceModelSeriesGroup[];
};

export type CompanyProfile = {
  id: string;
  name: string;
  partitaIva: string;
  codiceFiscale: string;
  pec: string;
  codiceDestinatario: string;
  status: CompanyStatus;
  priceList: CustomerLevel;
  customerType?: CustomerType;
  assignmentStatus?: CustomerAssignmentStatus;
  profileKind?: CustomerProfileKind;
  level?: CustomerLevel;
  lifetimeSpendNet?: number;
  profileCompletedAt?: string | null;
  billingAddress?: string;
  city: string;
  contactName?: string;
  email?: string;
  phone?: string;
  province: string;
  shippingAddress?: string;
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

export const deviceModels: DeviceModelGroup[] = [
  {
    brand: "Apple",
    models: [
      "iPhone 4",
      "iPhone 4S",
      "iPhone 5",
      "iPhone 5C",
      "iPhone 5S",
      "iPhone SE",
      "iPhone SE 2020",
      "iPhone SE 2022",
      "iPhone 6",
      "iPhone 6 Plus",
      "iPhone 6S",
      "iPhone 6S Plus",
      "iPhone 7",
      "iPhone 7 Plus",
      "iPhone 8",
      "iPhone 8 Plus",
      "iPhone X",
      "iPhone XR",
      "iPhone XS",
      "iPhone XS Max",
      "iPhone 11",
      "iPhone 11 Pro",
      "iPhone 11 Pro Max",
      "iPhone 12 Mini",
      "iPhone 12",
      "iPhone 12 Pro",
      "iPhone 12 Pro Max",
      "iPhone 13 Mini",
      "iPhone 13",
      "iPhone 13 Pro",
      "iPhone 13 Pro Max",
      "iPhone 14",
      "iPhone 14 Plus",
      "iPhone 14 Pro",
      "iPhone 14 Pro Max",
      "iPhone 15",
      "iPhone 15 Plus",
      "iPhone 15 Pro",
      "iPhone 15 Pro Max",
      "iPhone 16",
      "iPhone 16 Plus",
      "iPhone 16 Pro",
      "iPhone 16 Pro Max",
      "iPhone 16e",
      "iPhone 17",
      "iPhone 17 Pro",
      "iPhone 17 Pro Max",
    ],
  },
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
  const shipping = roundMoney(calculateShippingCents(Math.round(subtotal * 100)) / 100);

  return {
    lines,
    subtotal,
    shipping,
    vat: 0,
    total: roundMoney(subtotal + shipping),
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
