"use client";

/* eslint-disable react-hooks/incompatible-library */

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type Column,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as TanStackTable,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Bell,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Edit,
  Eye,
  Filter,
  HelpCircle,
  Home,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  Users,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label as FormLabel } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  categories,
  dashboardStats,
  inventoryMix,
  monthlyOrders,
  salesTrend,
  type PartProduct,
  type StockStatus,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { AdminActivityTimeline } from "./admin-activity-timeline";
import { AdminCustomersPanel } from "./admin-customers-panel";
import { AdminOrdersPanel } from "./admin-orders-panel";
import { PartsProLogo } from "./logo";
import { PartVisual } from "./part-visual";
import { useI18n } from "./i18n-provider";
import { LanguageSwitcher } from "./language-switcher";
import {
  formatAdminMessage,
  getAdminDictionary,
  type AdminText,
} from "@/i18n/dictionaries/admin";

const navItems = [
  { labelKey: "dashboard", icon: Home, active: true },
  { labelKey: "orders", icon: ClipboardList },
  { labelKey: "catalog", icon: Package },
  { labelKey: "warehouse", icon: Warehouse },
  { labelKey: "customers", icon: Users },
  { labelKey: "marketing", icon: Bell },
  { labelKey: "finance", icon: BarChart3 },
  { labelKey: "reports", icon: Boxes },
  { labelKey: "settings", icon: Settings },
] as const;

const lowStockThreshold = 10;
const productGrades = ["A+", "A", "B", "Refurbished"] as const;
const warehouses = ["Milano", "Roma", "Shenzhen"] as const;
const stockStatuses = ["In Stock", "Low Stock", "Out of Stock"] as const;
const productVisuals = [
  "screen",
  "battery",
  "cover",
  "port",
  "camera",
  "flex",
  "speaker",
  "frame",
] as const;
const adminProductsEndpoint = "/api/admin/products";

type StatusFilterValue = "all" | StockStatus;
type StockFilterValue = "all" | "available" | "under-10" | "empty";
type ProductSource = "supabase" | "api" | "empty";
type ProductNotice = {
  tone: "success" | "info" | "warning" | "error";
  message: string;
};
type ProductDataSource = {
  source: ProductSource;
  label: string;
  syncedAt: string | null;
  total: number;
  returned: number;
  error?: string;
};
type ProductsApiResult = {
  products: PartProduct[];
  source: ProductSource;
  total: number;
  returned: number;
};

function createProductSchema(text: AdminText) {
  return z.object({
    name: z.string().trim().min(2, text.schema.nameRequired),
    sku: z.string().trim().min(4, text.schema.skuRequired),
    category: z.string().min(1, text.schema.categoryRequired),
    brand: z.string().trim().min(1, text.schema.brandRequired),
    grade: z.enum(productGrades),
    price: z.coerce.number().positive(text.schema.pricePositive),
    stock: z.coerce.number().int().nonnegative(text.schema.stockNonNegative),
    warehouse: z.enum(warehouses),
    moq: z.coerce.number().int().positive(text.schema.moqPositive),
    leadTime: z.string().trim().min(2, text.schema.leadTimeRequired),
    compatibleWith: z.string().trim().min(2, text.schema.compatibleRequired),
    tags: z.string().optional(),
  });
}

type ProductSchema = ReturnType<typeof createProductSchema>;
type ProductFormInput = z.input<ProductSchema>;
type ProductFormValues = z.output<ProductSchema>;
type ProductFormApi = UseFormReturn<ProductFormInput, unknown, ProductFormValues>;

const defaultProductFormValues: ProductFormInput = {
  name: "",
  sku: "",
  category: "Schermi",
  brand: "OEM",
  grade: "A+",
  price: 0,
  stock: 1,
  warehouse: "Milano",
  moq: 1,
  leadTime: "24/48h Italia",
  compatibleWith: "Da configurare",
  tags: "Nuovo",
};

function useAdminText() {
  const { locale } = useI18n();

  return getAdminDictionary(locale).admin;
}

function stockStatusFromStock(stock: number): StockStatus {
  if (stock === 0) {
    return "Out of Stock";
  }

  if (stock < lowStockThreshold) {
    return "Low Stock";
  }

  return "In Stock";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function splitList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

function ensureUniqueSku(
  sku: string,
  products: PartProduct[],
  ignoredSku?: string
) {
  const requestedSku = sku.trim();
  const knownSkus = new Set(
    products
      .filter((product) => product.sku !== ignoredSku)
      .map((product) => product.sku.toLowerCase())
  );

  if (!knownSkus.has(requestedSku.toLowerCase())) {
    return requestedSku;
  }

  let index = 2;
  let nextSku = `${requestedSku}-${index}`;

  while (knownSkus.has(nextSku.toLowerCase())) {
    index += 1;
    nextSku = `${requestedSku}-${index}`;
  }

  return nextSku;
}

function productFormDefaults(product: PartProduct): ProductFormInput {
  return {
    name: product.name,
    sku: product.sku,
    category: product.category,
    brand: product.brand,
    grade: product.grade,
    price: product.price,
    stock: product.stock,
    warehouse: product.warehouse,
    moq: product.moq,
    leadTime: product.leadTime,
    compatibleWith: product.compatibleWith.join(", "),
    tags: product.tags.join(", "),
  };
}

function productFromForm(
  values: ProductFormValues,
  existingProduct?: PartProduct
): PartProduct {
  const category = categories.find((item) => item.label === values.category);
  const tags = splitList(values.tags);

  return {
    sku: values.sku,
    slug: slugify(values.sku),
    name: values.name,
    category: values.category,
    brand: values.brand,
    grade: values.grade,
    price: values.price,
    retailPrice: Number((values.price * 1.35).toFixed(2)),
    stock: values.stock,
    status: stockStatusFromStock(values.stock),
    updatedAt: formatTimestamp(),
    visual: category?.visual ?? existingProduct?.visual ?? "screen",
    compatibleWith: splitList(values.compatibleWith),
    warehouse: values.warehouse,
    moq: values.moq,
    vatRate: existingProduct?.vatRate ?? 22,
    rmaDays: existingProduct?.rmaDays ?? 30,
    leadTime: values.leadTime,
    tags: tags.length ? tags : existingProduct?.tags ?? ["Nuovo"],
  };
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadProductsCsv(products: PartProduct[], scope: "selected" | "view") {
  const headers = [
    "sku",
    "name",
    "category",
    "brand",
    "grade",
    "stock",
    "status",
    "price",
    "retailPrice",
    "warehouse",
    "leadTime",
    "updatedAt",
  ];
  const rows = products.map((product) => [
    product.sku,
    product.name,
    product.category,
    product.brand,
    product.grade,
    product.stock,
    product.status,
    product.price.toFixed(2),
    product.retailPrice.toFixed(2),
    product.warehouse,
    product.leadTime,
    product.updatedAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => csvEscape(value)).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `partspro-prodotti-${scope}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function fetchAdminProducts(signal?: AbortSignal): Promise<ProductsApiResult> {
  const response = await fetch(`${adminProductsEndpoint}?limit=100&sort=updated_desc`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET ${adminProductsEndpoint} responded ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  return parseProductsApiPayload(payload);
}

async function saveAdminProduct(
  product: PartProduct,
  mode: "create" | "update",
  originalSku?: string
) {
  const response = await fetch(adminProductsEndpoint, {
    method: mode === "create" ? "POST" : "PATCH",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      mode === "create"
        ? { product }
        : { product, sku: originalSku ?? product.sku }
    ),
  });

  if (!response.ok) {
    throw new Error(`${mode === "create" ? "POST" : "PATCH"} ${adminProductsEndpoint} responded ${response.status}`);
  }

  const payload = await readJsonResponse(response);

  return readSavedProduct(payload, product);
}

async function deleteAdminProducts(skus: string[]) {
  const response = await fetch(adminProductsEndpoint, {
    method: "DELETE",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ skus }),
  });

  if (!response.ok) {
    throw new Error(`DELETE ${adminProductsEndpoint} responded ${response.status}`);
  }
}

async function readJsonResponse(response: Response) {
  const body = await response.text();

  if (!body.trim()) {
    return null;
  }

  return JSON.parse(body) as unknown;
}

function parseProductsApiPayload(payload: unknown): ProductsApiResult {
  const rows = readProductsRows(payload);
  const products = rows
    .map((row) => normalizeProductApiRow(row))
    .filter((product): product is PartProduct => product !== null);
  const meta = readProductsMeta(payload);
  const source = readProductsSource(readString(meta.source), products.length);

  return {
    products,
    source,
    total: readNumber(meta.total) ?? products.length,
    returned: readNumber(meta.returned) ?? products.length,
  };
}

function readSavedProduct(payload: unknown, fallback: PartProduct) {
  const candidates = readSavedProductCandidates(payload);

  for (const candidate of candidates) {
    const product = normalizeProductApiRow(candidate);

    if (product) {
      return product;
    }
  }

  return fallback;
}

function readSavedProductCandidates(payload: unknown) {
  if (!isRecord(payload)) {
    return [];
  }

  const candidates: unknown[] = [payload.data, payload.product, payload];

  if (Array.isArray(payload.data)) {
    candidates.unshift(payload.data[0]);
  }

  if (isRecord(payload.data)) {
    candidates.unshift(payload.data.product);
  }

  return candidates;
}

function readProductsRows(payload: unknown) {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.products)) {
    return payload.data.products;
  }

  if (Array.isArray(payload.products)) {
    return payload.products;
  }

  return [];
}

function readProductsMeta(payload: unknown) {
  if (!isRecord(payload)) {
    return {};
  }

  if (isRecord(payload.meta)) {
    return payload.meta;
  }

  if (isRecord(payload.data) && isRecord(payload.data.meta)) {
    return payload.data.meta;
  }

  return {};
}

function normalizeProductApiRow(row: unknown): PartProduct | null {
  if (!isRecord(row)) {
    return null;
  }

  const sku = readString(row.sku);
  const name = readString(row.name);

  if (!sku || !name) {
    return null;
  }

  const category = readString(row.category) ?? "Schermi";
  const stock = readNumber(row.stock) ?? 0;
  const price =
    readNumber(row.price) ??
    readCents(row.priceCents) ??
    readCents(row.price_cents) ??
    0;
  const retailPrice =
    readNumber(row.retailPrice) ??
    readNumber(row.retail_price) ??
    readCents(row.retailPriceCents) ??
    readCents(row.retail_price_cents) ??
    Number((price * 1.35).toFixed(2));
  const categoryVisual = categories.find((item) => item.label === category)?.visual;

  return {
    sku,
    slug: readString(row.slug) ?? slugify(sku),
    name,
    category,
    brand: readString(row.brand) ?? "OEM",
    grade: normalizeProductGrade(row.grade),
    price,
    retailPrice,
    stock,
    status: normalizeStockStatus(row.status) ?? stockStatusFromStock(stock),
    updatedAt: readString(row.updatedAt) ?? readString(row.updated_at) ?? formatTimestamp(),
    visual: normalizeProductVisual(row.visual) ?? categoryVisual ?? "screen",
    compatibleWith:
      readStringList(row.compatibleWith) ??
      readStringList(row.compatible_with) ??
      [],
    warehouse: normalizeWarehouse(row.warehouse),
    moq: readNumber(row.moq) ?? 1,
    vatRate: readNumber(row.vatRate) ?? readNumber(row.vat_rate) ?? 22,
    rmaDays: readNumber(row.rmaDays) ?? readNumber(row.rma_days) ?? 30,
    leadTime:
      readString(row.leadTime) ?? readString(row.lead_time) ?? "24/48h Italia",
    tags: readStringList(row.tags) ?? [],
    imageUrl: readString(row.imageUrl) ?? readString(row.image_url),
    imageAlt: readString(row.imageAlt) ?? readString(row.image_alt),
    galleryImageUrls:
      readStringList(row.galleryImageUrls) ?? readStringList(row.gallery_image_urls),
  };
}

function normalizeProductGrade(value: unknown): PartProduct["grade"] {
  const grade = readString(value);

  return productGrades.find((item) => item === grade) ?? "A+";
}

function normalizeStockStatus(value: unknown): StockStatus | null {
  const status = readString(value);

  return stockStatuses.find((item) => item === status) ?? null;
}

function normalizeWarehouse(value: unknown): PartProduct["warehouse"] {
  const warehouse = readString(value);

  return warehouses.find((item) => item === warehouse) ?? "Milano";
}

function normalizeProductVisual(value: unknown): PartProduct["visual"] | null {
  const visual = readString(value);

  return productVisuals.find((item) => item === visual) ?? null;
}

function readProductsSource(value: string | undefined, productCount: number): ProductSource {
  if (value === "supabase") {
    return "supabase";
  }

  if (value === "empty" || productCount === 0) {
    return "empty";
  }

  return "api";
}

function productSourceLabel(source: ProductSource, text: AdminText) {
  if (source === "supabase") {
    return text.catalog.apiSourceSupabase;
  }

  if (source === "api") {
    return text.catalog.apiSourceApi;
  }

  return text.catalog.apiSourceEmpty;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));

    return Number.isFinite(normalized) ? normalized : undefined;
  }

  return undefined;
}

function readCents(value: unknown) {
  const cents = readNumber(value);

  return cents === undefined ? undefined : Number((cents / 100).toFixed(2));
}

function readStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => readString(item)).filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    return splitList(value);
  }

  return undefined;
}

export function AdminDashboard() {
  const text = useAdminText();
  const [products, setProducts] = React.useState<PartProduct[]>([]);
  const [productDataSource, setProductDataSource] =
    React.useState<ProductDataSource>(() => ({
      source: "empty",
      label: text.catalog.apiSourceEmpty,
      syncedAt: null,
      total: 0,
      returned: 0,
    }));
  const [isLoadingProducts, setIsLoadingProducts] = React.useState(false);
  const [isMutatingProducts, setIsMutatingProducts] = React.useState(false);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilterValue>("all");
  const [stockFilter, setStockFilter] = React.useState<StockFilterValue>("all");
  const [notice, setNotice] = React.useState<ProductNotice | null>(null);
  const [viewProduct, setViewProduct] = React.useState<PartProduct | null>(null);
  const [editProduct, setEditProduct] = React.useState<PartProduct | null>(null);

  const refreshProducts = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoadingProducts(true);

      try {
        const result = await fetchAdminProducts(signal);

        if (signal?.aborted) {
          return;
        }

        setProducts(result.products);
        setProductDataSource({
          source: result.source,
          label: productSourceLabel(result.source, text),
          syncedAt: formatTimestamp(),
          total: result.total,
          returned: result.returned,
        });
        setRowSelection({});
        setNotice({
          tone: result.products.length ? "success" : "info",
          message: result.products.length
            ? text.catalog.syncSuccess
            : text.catalog.syncEmpty,
        });
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        setProducts([]);
        setProductDataSource({
          source: "empty",
          label: text.catalog.apiSourceEmpty,
          syncedAt: formatTimestamp(),
          total: 0,
          returned: 0,
          error: getErrorMessage(error),
        });
        setRowSelection({});
        setNotice({
          tone: "error",
          message: text.catalog.syncError,
        });
      } finally {
        if (!signal?.aborted) {
          setIsLoadingProducts(false);
        }
      }
    },
    [text]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void refreshProducts(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refreshProducts]);

  const filteredProducts = React.useMemo(
    () =>
      products.filter((product) => {
        const matchesStatus =
          statusFilter === "all" || product.status === statusFilter;
        const matchesStock =
          stockFilter === "all" ||
          (stockFilter === "available" && product.stock > 0) ||
          (stockFilter === "under-10" &&
            product.stock > 0 &&
            product.stock < lowStockThreshold) ||
          (stockFilter === "empty" && product.stock === 0);

        return matchesStatus && matchesStock;
      }),
    [products, statusFilter, stockFilter]
  );

  const handleCreateProduct = React.useCallback(
    async (values: ProductFormValues) => {
      const sku = ensureUniqueSku(values.sku, products);
      const product = productFromForm({ ...values, sku });

      setIsMutatingProducts(true);

      try {
        const savedProduct = await saveAdminProduct(product, "create");

        setProducts((currentProducts) => [
          savedProduct,
          ...currentProducts.filter((item) => item.sku !== savedProduct.sku),
        ]);
        setProductDataSource((currentSource) => ({
          ...currentSource,
          source: currentSource.source === "empty" ? "api" : currentSource.source,
          label:
            currentSource.source === "empty"
              ? productSourceLabel("api", text)
              : currentSource.label,
          returned: currentSource.returned + 1,
          total: currentSource.total + 1,
          syncedAt: formatTimestamp(),
        }));
        setRowSelection({});
        setNotice({
          tone: "success",
          message: formatAdminMessage(text.catalog.createdNotice, {
            sku: savedProduct.sku,
          }),
        });

        return true;
      } catch {
        setNotice({
          tone: "error",
          message: text.catalog.saveError,
        });

        return false;
      } finally {
        setIsMutatingProducts(false);
      }
    },
    [products, text]
  );

  const handleUpdateProduct = React.useCallback(
    async (originalSku: string, values: ProductFormValues) => {
      const currentProduct = products.find((product) => product.sku === originalSku);

      if (!currentProduct) {
        return false;
      }

      const sku = ensureUniqueSku(values.sku, products, originalSku);
      const updatedProduct = productFromForm({ ...values, sku }, currentProduct);

      setIsMutatingProducts(true);

      try {
        const savedProduct = await saveAdminProduct(
          updatedProduct,
          "update",
          originalSku
        );

        setProducts((currentProducts) =>
          currentProducts.map((product) =>
            product.sku === originalSku ? savedProduct : product
          )
        );
        setProductDataSource((currentSource) => ({
          ...currentSource,
          syncedAt: formatTimestamp(),
        }));
        setRowSelection({});
        setEditProduct(null);
        setNotice({
          tone: "success",
          message: formatAdminMessage(text.catalog.updatedNotice, {
            sku: savedProduct.sku,
          }),
        });

        return true;
      } catch {
        setNotice({
          tone: "error",
          message: text.catalog.saveError,
        });

        return false;
      } finally {
        setIsMutatingProducts(false);
      }
    },
    [products, text]
  );

  const handleDeleteProducts = React.useCallback(
    async (skus: string[]) => {
      const skuSet = new Set(skus);
      const deletedCount = products.filter((product) => skuSet.has(product.sku)).length;

      if (deletedCount === 0) {
        return;
      }

      setIsMutatingProducts(true);

      try {
        await deleteAdminProducts(skus);

        setProducts((currentProducts) =>
          currentProducts.filter((product) => !skuSet.has(product.sku))
        );
        setProductDataSource((currentSource) => ({
          ...currentSource,
          returned: Math.max(0, currentSource.returned - deletedCount),
          total: Math.max(0, currentSource.total - deletedCount),
          syncedAt: formatTimestamp(),
        }));
        setRowSelection({});

        if (viewProduct && skuSet.has(viewProduct.sku)) {
          setViewProduct(null);
        }

        if (editProduct && skuSet.has(editProduct.sku)) {
          setEditProduct(null);
        }

        setNotice({
          tone: "info",
          message:
            deletedCount === 1
              ? text.catalog.deletedOneNotice
              : formatAdminMessage(text.catalog.deletedManyNotice, {
                  count: deletedCount,
                }),
        });
      } catch {
        setNotice({
          tone: "error",
          message: text.catalog.deleteError,
        });
      } finally {
        setIsMutatingProducts(false);
      }
    },
    [editProduct, products, text, viewProduct]
  );

  const handleDuplicateProduct = React.useCallback(
    async (product: PartProduct) => {
      const sku = ensureUniqueSku(`${product.sku}-COPY`, products);
      const duplicatedProduct: PartProduct = {
        ...product,
        sku,
        slug: slugify(sku),
        name: `${product.name} ${text.catalog.duplicatedSuffix}`,
        updatedAt: formatTimestamp(),
        tags: Array.from(new Set([...product.tags, text.catalog.duplicatedSuffix])),
      };

      setIsMutatingProducts(true);

      try {
        const savedProduct = await saveAdminProduct(duplicatedProduct, "create");

        setProducts((currentProducts) => [savedProduct, ...currentProducts]);
        setProductDataSource((currentSource) => ({
          ...currentSource,
          source: currentSource.source === "empty" ? "api" : currentSource.source,
          label:
            currentSource.source === "empty"
              ? productSourceLabel("api", text)
              : currentSource.label,
          returned: currentSource.returned + 1,
          total: currentSource.total + 1,
          syncedAt: formatTimestamp(),
        }));
        setRowSelection({});
        setNotice({
          tone: "success",
          message: formatAdminMessage(text.catalog.duplicatedNotice, {
            sku: savedProduct.sku,
          }),
        });
      } catch {
        setNotice({
          tone: "error",
          message: text.catalog.saveError,
        });
      } finally {
        setIsMutatingProducts(false);
      }
    },
    [products, text]
  );

  const handleExportProducts = React.useCallback(
    (items: PartProduct[], scope: "selected" | "view") => {
      if (items.length === 0) {
        return;
      }

      downloadProductsCsv(items, scope);
      setNotice({
        tone: "success",
        message:
          items.length === 1
            ? text.catalog.csvOneNotice
            : formatAdminMessage(text.catalog.csvManyNotice, {
                count: items.length,
              }),
      });
    },
    [text]
  );

  const columns = React.useMemo<ColumnDef<PartProduct>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label={text.catalog.selectAll}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={text.catalog.selectItem}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "sku",
        header: ({ column }) => <SortableHeader column={column} label={text.catalog.table.sku} />,
        cell: ({ row }) => (
          <div className="font-mono text-xs font-semibold text-slate-600">
            {row.original.sku}
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} label={text.catalog.table.product} />,
        cell: ({ row }) => (
          <div className="flex min-w-[230px] items-center gap-3">
            <PartVisual
              variant={row.original.visual}
              className="size-11 shrink-0 rounded-md"
            />
            <div>
              <div className="text-sm font-bold text-slate-900">{row.original.name}</div>
              <div className="mt-0.5 text-xs text-slate-500">{row.original.category}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "brand",
        header: ({ column }) => <SortableHeader column={column} label={text.catalog.table.brand} />,
        cell: ({ row }) => <span className="text-sm">{row.original.brand}</span>,
      },
      {
        accessorKey: "grade",
        header: ({ column }) => <SortableHeader column={column} label={text.catalog.table.quality} />,
        cell: ({ row }) => (
          <Badge className={gradeBadgeClass(row.original.grade)}>
            {text.enums.productGrade[row.original.grade]}
          </Badge>
        ),
      },
      {
        accessorKey: "stock",
        header: ({ column }) => <SortableHeader column={column} label={text.catalog.table.stock} />,
        cell: ({ row }) => (
          <span className={cn("font-semibold", row.original.stock === 0 && "text-red-500")}>
            {row.original.stock}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: ({ column }) => <SortableHeader column={column} label={text.catalog.table.price} />,
        cell: ({ row }) => (
          <span className="font-semibold">€{row.original.price.toFixed(2)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortableHeader column={column} label={text.catalog.table.status} />,
        cell: ({ row }) => (
          <Badge className={statusBadgeClass(row.original.status)}>
            {text.enums.stockStatus[row.original.status]}
          </Badge>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => <SortableHeader column={column} label={text.catalog.table.updated} />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-slate-500">
            {row.original.updatedAt}
          </span>
        ),
      },
      {
        id: "actions",
        header: text.catalog.table.actions,
        cell: ({ row }) => {
          const product = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewProduct(product)}>
                  <Eye className="size-4" />
                  {text.common.details}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditProduct(product)}>
                  <Edit className="size-4" />
                  {text.common.edit}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isMutatingProducts}
                  onClick={() => void handleDuplicateProduct(product)}
                >
                  <Copy className="size-4" />
                  {text.common.duplicate}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  disabled={isMutatingProducts}
                  onClick={() => void handleDeleteProducts([product.sku])}
                >
                  <Trash2 className="size-4" />
                  {text.common.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [handleDeleteProducts, handleDuplicateProduct, isMutatingProducts, text]
  );

  const table = useReactTable({
    data: filteredProducts,
    columns,
    getRowId: (row) => row.sku,
    state: {
      globalFilter,
      rowSelection,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
  });

  return (
    <main className="h-dvh overflow-y-auto overflow-x-clip text-slate-950">
      <div className="flex min-w-0">
        <AdminSidebar />
        <section className="w-full min-w-0 flex-1">
          <AdminTopbar />
          <div className="mx-auto w-full max-w-[1500px] min-w-0 px-3 pb-3 pt-0 sm:px-4 sm:py-4">
            <Tabs defaultValue="overview" className="flex min-w-0 flex-col gap-3 sm:gap-4">
              <div className="sticky top-16 z-20 order-1 -mx-3 max-w-[calc(100%+1.5rem)] border-b border-slate-200/80 bg-slate-50/95 px-3 py-2 shadow-sm backdrop-blur sm:-mx-4 sm:max-w-[calc(100%+2rem)] sm:px-4 lg:static lg:order-3 lg:mx-0 lg:max-w-full lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
                <div className="max-w-full overflow-x-auto lg:overflow-visible">
                  <TabsList className="h-9 min-w-max bg-white shadow-sm sm:h-10">
                    <TabsTrigger value="overview">
                      <BarChart3 className="size-4" />
                      {text.tabs.overview}
                    </TabsTrigger>
                    <TabsTrigger value="orders">
                      <ClipboardList className="size-4" />
                      {text.tabs.orders}
                    </TabsTrigger>
                    <TabsTrigger value="customers">
                      <Users className="size-4" />
                      {text.tabs.customers}
                    </TabsTrigger>
                    <TabsTrigger value="catalog">
                      <Package className="size-4" />
                      {text.tabs.catalog}
                    </TabsTrigger>
                    <TabsTrigger value="timeline">
                      <Bell className="size-4" />
                      {text.tabs.timeline}
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <TabsContent value="orders" className="order-4 mt-0 min-w-0">
                <AdminOrdersPanel />
              </TabsContent>
              <TabsContent value="customers" className="order-4 mt-0 min-w-0">
                <AdminCustomersPanel />
              </TabsContent>
              <TabsContent value="catalog" className="order-4 mt-0 min-w-0">
                <ProductsPanel
                  table={table}
                  dataSource={productDataSource}
                  isLoadingProducts={isLoadingProducts}
                  isMutatingProducts={isMutatingProducts}
                  globalFilter={globalFilter}
                  setGlobalFilter={setGlobalFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  stockFilter={stockFilter}
                  setStockFilter={setStockFilter}
                  notice={notice}
                  setNotice={setNotice}
                  onCreateProduct={handleCreateProduct}
                  onViewProduct={setViewProduct}
                  onEditProduct={setEditProduct}
                  onDuplicateProduct={handleDuplicateProduct}
                  onDeleteProducts={handleDeleteProducts}
                  onExportProducts={handleExportProducts}
                  onRefreshProducts={() => void refreshProducts()}
                />
              </TabsContent>
              <TabsContent value="timeline" className="order-4 mt-0 min-w-0">
                <AdminActivityTimeline />
              </TabsContent>
              <TabsContent value="overview" className="order-4 mt-0 min-w-0 space-y-4">
                <StatsGrid />
                <ChartsPanel />
                <LowerPanels products={products} />
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
      <ProductDetailsDialog
        product={viewProduct}
        open={Boolean(viewProduct)}
        onOpenChange={(open) => !open && setViewProduct(null)}
        onEdit={(product) => {
          setViewProduct(null);
          setEditProduct(product);
        }}
      />
      <EditProductDialog
        product={editProduct}
        open={Boolean(editProduct)}
        onOpenChange={(open) => !open && setEditProduct(null)}
        onSave={handleUpdateProduct}
      />
    </main>
  );
}

function AdminSidebar() {
  const text = useAdminText();

  return (
    <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
      <PartsProLogo />
      <nav className="mt-8 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.labelKey}
            href="#"
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-primary/8 hover:text-primary",
              "active" in item && item.active && "bg-primary/10 text-primary"
            )}
          >
            <item.icon className="size-4" />
            {text.nav[item.labelKey]}
            {item.labelKey === "catalog" && (
              <ChevronRight className="ml-auto size-4 opacity-60" />
            )}
          </a>
        ))}
      </nav>
      <div className="absolute bottom-4 left-4 right-4">
        <Separator className="mb-4" />
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <div className="grid size-9 place-items-center rounded-full bg-primary text-white">
            <User className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{text.topbar.adminName}</div>
            <div className="text-xs text-slate-500">{text.topbar.adminRole}</div>
          </div>
          <ChevronDown className="ml-auto size-4 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}

function AdminTopbar() {
  const text = useAdminText();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] min-w-0 items-center gap-3 px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-white lg:hidden">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[310px] p-0">
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>
                <PartsProLogo />
              </SheetTitle>
              <SheetDescription className="sr-only">
                {text.topbar.mobileNavigationDescription}
              </SheetDescription>
            </SheetHeader>
            <div className="p-4">
              <LanguageSwitcher scope="admin" className="mb-4" />
              {navItems.map((item) => (
                <a
                  key={item.labelKey}
                  href="#"
                  className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-primary/8 hover:text-primary"
                >
                  <item.icon className="size-4" />
                  {text.nav[item.labelKey]}
                </a>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1 sm:flex-none">
          <div className="truncate text-lg font-black">{text.topbar.title}</div>
          <div className="truncate text-xs text-slate-500">
            {text.topbar.subtitle}
          </div>
        </div>

        <div className="relative ml-auto hidden w-full max-w-md md:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="h-10 bg-white pl-9" placeholder={text.topbar.searchPlaceholder} />
        </div>

        <LanguageSwitcher scope="admin" compact className="hidden sm:inline-flex" />
        <Button variant="outline" size="icon" className="shrink-0 bg-white">
          <Calendar className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="relative hidden shrink-0 bg-white sm:inline-flex">
          <ShoppingCart className="size-4" />
          <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
        </Button>
        <Button variant="outline" asChild className="hidden bg-white sm:inline-flex">
          <Link href="/">{text.topbar.home}</Link>
        </Button>
      </div>
    </header>
  );
}

function StatsGrid() {
  return (
    <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      {dashboardStats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="border-slate-200 bg-white py-2 shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:py-4">
            <CardContent className="px-2.5 sm:px-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium leading-tight text-slate-500 sm:text-sm">
                    {stat.label}
                  </p>
                  <div className="mt-1 whitespace-nowrap text-xl font-black leading-none tracking-normal sm:mt-2 sm:text-3xl">
                    {stat.value}
                  </div>
                  <p className="mt-1 text-[11px] font-semibold leading-tight text-emerald-600 sm:mt-2 sm:text-xs">
                    {stat.delta} vs ieri
                  </p>
                </div>
                <div className="hidden size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:grid">
                  {index === 0 && <ClipboardList className="size-5" />}
                  {index === 1 && <BarChart3 className="size-5" />}
                  {index === 2 && <Users className="size-5" />}
                  {index === 3 && <Package className="size-5" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </section>
  );
}

function ChartsPanel() {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Vendite ultimi 7 giorni</CardTitle>
            <CardDescription>Calcolate sugli ordini effettivamente pagati</CardDescription>
          </div>
          <Select defaultValue="7">
            <SelectTrigger className="w-28 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 giorni</SelectItem>
              <SelectItem value="30">30 giorni</SelectItem>
              <SelectItem value="90">90 giorni</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="h-[280px]">
          <MeasuredChart height={280}>
            {(width, height) => (
              <AreaChart width={width} height={height} data={salesTrend}>
                <defs>
                  <linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3b5bff" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#3b5bff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5edf7" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #dfe6f1",
                    boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b5bff"
                  strokeWidth={3}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            )}
          </MeasuredChart>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle>Distribuzione stock</CardTitle>
            <CardDescription>Totale SKU 2.840</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="h-[180px]">
              <MeasuredChart height={180} compact>
                {(width, height) => (
                  <PieChart width={width} height={height}>
                    <Pie
                      data={inventoryMix}
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {inventoryMix.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                )}
              </MeasuredChart>
            </div>
            <div className="flex flex-col justify-center gap-3">
              {inventoryMix.map((item) => (
                <div key={item.name} className="flex items-center gap-3 text-sm">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="flex-1 text-slate-600">{item.name}</span>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle>Stato ordini</CardTitle>
            <CardDescription>Unità per mese</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px]">
            <MeasuredChart height={220}>
              {(width, height) => (
                <BarChart width={width} height={height} data={monthlyOrders}>
                  <CartesianGrid stroke="#e5edf7" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <RechartsTooltip cursor={{ fill: "rgba(59,91,255,0.06)" }} />
                  <Bar dataKey="paid" stackId="a" fill="#3b5bff" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pending" stackId="a" fill="#dbe5ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </MeasuredChart>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MeasuredChart({
  children,
  compact = false,
  height,
}: {
  children: (width: number, height: number) => React.ReactNode;
  compact?: boolean;
  height: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    let frame = 0;
    const updateWidth = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setWidth(Math.floor(element.getBoundingClientRect().width));
      });
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="h-full w-full min-w-0">
      {width > 0 ? children(width, height) : <ChartPlaceholder compact={compact} />}
    </div>
  );
}

function ChartPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full min-h-[160px] items-end gap-2 rounded-lg bg-slate-50 p-4">
      {Array.from({ length: compact ? 6 : 12 }).map((_, index) => (
        <div
          key={index}
          className="flex-1 rounded-t bg-primary/15"
          style={{ height: `${28 + ((index * 17) % 58)}%` }}
        />
      ))}
    </div>
  );
}

function SortableHeader<TData, TValue>({
  column,
  label,
}: {
  column: Column<TData, TValue>;
  label: string;
}) {
  const sorted = column.getIsSorted();
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 px-2 font-semibold text-slate-600"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      <Icon className="size-3.5" />
    </Button>
  );
}

type ProductsPanelProps = {
  table: TanStackTable<PartProduct>;
  dataSource: ProductDataSource;
  isLoadingProducts: boolean;
  isMutatingProducts: boolean;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  statusFilter: StatusFilterValue;
  setStatusFilter: (value: StatusFilterValue) => void;
  stockFilter: StockFilterValue;
  setStockFilter: (value: StockFilterValue) => void;
  notice: ProductNotice | null;
  setNotice: (notice: ProductNotice | null) => void;
  onCreateProduct: (values: ProductFormValues) => Promise<boolean>;
  onViewProduct: (product: PartProduct) => void;
  onEditProduct: (product: PartProduct) => void;
  onDuplicateProduct: (product: PartProduct) => Promise<void>;
  onDeleteProducts: (skus: string[]) => Promise<void>;
  onExportProducts: (products: PartProduct[], scope: "selected" | "view") => void;
  onRefreshProducts: () => void;
};

function ProductsPanel({
  table,
  dataSource,
  isLoadingProducts,
  isMutatingProducts,
  globalFilter,
  setGlobalFilter,
  statusFilter,
  setStatusFilter,
  stockFilter,
  setStockFilter,
  notice,
  setNotice,
  onCreateProduct,
  onViewProduct,
  onEditProduct,
  onDuplicateProduct,
  onDeleteProducts,
  onExportProducts,
  onRefreshProducts,
}: ProductsPanelProps) {
  const text = useAdminText();
  const selectedProducts = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);
  const pageRows = table.getRowModel().rows;
  const currentProducts = table.getPrePaginationRowModel().rows.map((row) => row.original);
  const hasFilters =
    Boolean(globalFilter) || statusFilter !== "all" || stockFilter !== "all";

  function updateGlobalFilter(value: string) {
    setGlobalFilter(value);
    table.setPageIndex(0);
  }

  function clearFilters() {
    setGlobalFilter("");
    setStatusFilter("all");
    setStockFilter("all");
    table.setPageIndex(0);
  }

  return (
    <Card className="border-slate-200 bg-white py-2 shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:py-4">
      <CardHeader className="gap-2 px-3 sm:gap-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="text-base sm:text-lg">
            {text.catalog.catalogTitle}
          </CardTitle>
          <CardDescription className="hidden sm:block">
            {text.catalog.catalogDescription}
          </CardDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge className={sourceBadgeClass(dataSource.source)}>
              {formatAdminMessage(text.catalog.sourceBadge, {
                source: dataSource.label,
              })}
            </Badge>
            <span>
              {dataSource.syncedAt
                ? formatAdminMessage(text.catalog.sourceStats, {
                    returned: dataSource.returned,
                    total: dataSource.total,
                    time: dataSource.syncedAt,
                  })
                : text.catalog.sourcePending}
            </span>
          </div>
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
          <div className="relative col-span-2 w-full lg:w-[240px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={globalFilter ?? ""}
              onChange={(event) => updateGlobalFilter(event.target.value)}
              className="h-9 w-full bg-white pl-9"
              placeholder={text.catalog.searchPlaceholder}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as StatusFilterValue);
              table.setPageIndex(0);
            }}
          >
            <SelectTrigger size="sm" className="w-full bg-white lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{text.catalog.allStatuses}</SelectItem>
              {stockStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {text.enums.stockStatus[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={stockFilter}
            onValueChange={(value) => {
              setStockFilter(value as StockFilterValue);
              table.setPageIndex(0);
            }}
          >
            <SelectTrigger size="sm" className="w-full bg-white lg:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{text.catalog.allStock}</SelectItem>
              <SelectItem value="available">{text.catalog.available}</SelectItem>
              <SelectItem value="under-10">{text.catalog.under10}</SelectItem>
              <SelectItem value="empty">{text.catalog.outOfStock}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={statusFilter === "Low Stock" ? "default" : "outline"}
            className={statusFilter === "Low Stock" ? "" : "bg-white"}
            onClick={() => {
              setStatusFilter(statusFilter === "Low Stock" ? "all" : "Low Stock");
              table.setPageIndex(0);
            }}
          >
            <Boxes className="size-4" />
            {text.catalog.lowStock}
          </Button>
          <Button
            variant="outline"
            className="bg-white"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            <Filter className="size-4" />
            {text.common.reset}
          </Button>
          <Button
            variant="outline"
            className="bg-white"
            onClick={onRefreshProducts}
            disabled={isLoadingProducts}
          >
            <RefreshCw className={cn("size-4", isLoadingProducts && "animate-spin")} />
            {text.catalog.syncProducts}
          </Button>
          <Button
            variant="outline"
            className="bg-white"
            onClick={() => onExportProducts(currentProducts, "view")}
            disabled={currentProducts.length === 0}
          >
            <Download className="size-4" />
            {text.common.exportView}
          </Button>
          <AddProductDialog
            disabled={isMutatingProducts}
            onCreateProduct={onCreateProduct}
          />
        </div>
      </CardHeader>
      <CardContent className="min-w-0 px-3 sm:px-4">
        {notice && (
          <div
            className={cn(
              "mb-3 flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium",
              noticeClassName(notice.tone)
            )}
          >
            <CheckCircle2 className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">{notice.message}</span>
            <Button
              variant="ghost"
              size="xs"
              className="text-current hover:bg-white/60"
              onClick={() => setNotice(null)}
            >
              {text.common.ok}
            </Button>
          </div>
        )}
        {isLoadingProducts && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
            <RefreshCw className="size-4 animate-spin" />
            {text.catalog.loadingProducts}
          </div>
        )}
        {selectedProducts.length > 0 && (
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:p-3">
            <div className="font-semibold text-slate-800">
              {formatAdminMessage(text.catalog.selectedCount, {
                count: selectedProducts.length,
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-white"
                onClick={() => onExportProducts(selectedProducts, "selected")}
              >
                <Download className="size-4" />
                {text.common.exportSelection}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isMutatingProducts}
                onClick={() =>
                  void onDeleteProducts(selectedProducts.map((product) => product.sku))
                }
              >
                <Trash2 className="size-4" />
                {text.common.delete}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => table.resetRowSelection()}
              >
                {text.common.deselect}
              </Button>
            </div>
          </div>
        )}
        {pageRows.length > 0 && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600 lg:hidden">
            <label className="flex min-w-0 items-center gap-2 font-semibold">
              <Checkbox
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label={text.catalog.selectPageAria}
              />
              <span>{text.catalog.selectPage}</span>
            </label>
            <span className="shrink-0 font-medium">
              {pageRows.length} {text.common.inPage}
            </span>
          </div>
        )}
        <div className="grid gap-2 lg:hidden">
          {pageRows.length ? (
            pageRows.map((row) => (
              <ProductMobileCard
                key={row.id}
                row={row}
                onViewProduct={onViewProduct}
                onEditProduct={onEditProduct}
                onDuplicateProduct={onDuplicateProduct}
                onDeleteProducts={onDeleteProducts}
                isMutatingProducts={isMutatingProducts}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm font-medium text-slate-500">
              <div>{isLoadingProducts ? text.catalog.loadingProducts : text.catalog.empty}</div>
              {!isLoadingProducts && dataSource.source === "empty" && (
                <div className="mt-1 text-xs font-normal">
                  {text.catalog.emptyDescription}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="hidden overflow-hidden rounded-lg border border-slate-200 lg:block">
          <div className="max-w-full overflow-x-auto">
            <Table className="min-w-[1080px]">
              <TableHeader className="bg-slate-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="whitespace-nowrap">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={table.getAllColumns().length} className="h-32 text-center">
                      <div className="font-medium">
                        {isLoadingProducts ? text.catalog.loadingProducts : text.catalog.empty}
                      </div>
                      {!isLoadingProducts && dataSource.source === "empty" && (
                        <div className="mt-1 text-xs text-slate-500">
                          {text.catalog.emptyDescription}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="hidden text-sm text-slate-500 sm:block">
            {formatAdminMessage(text.catalog.viewCount, {
              shown: table.getRowModel().rows.length,
              total: currentProducts.length,
              selected: selectedProducts.length,
            })}
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              className="bg-white"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: table.getPageCount() || 1 }).map((_, index) => (
              <Button
                key={index}
                variant={table.getState().pagination.pageIndex === index ? "default" : "outline"}
                size="icon-sm"
                className={table.getState().pagination.pageIndex === index ? "" : "bg-white"}
                onClick={() => table.setPageIndex(index)}
              >
                {index + 1}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon-sm"
              className="bg-white"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
                table.setPageIndex(0);
              }}
            >
              <SelectTrigger className="w-28 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {formatAdminMessage(text.common.pageSize, { count: pageSize })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductMobileCard({
  row,
  isMutatingProducts,
  onViewProduct,
  onEditProduct,
  onDuplicateProduct,
  onDeleteProducts,
}: {
  row: Row<PartProduct>;
  isMutatingProducts: boolean;
  onViewProduct: (product: PartProduct) => void;
  onEditProduct: (product: PartProduct) => void;
  onDuplicateProduct: (product: PartProduct) => Promise<void>;
  onDeleteProducts: (skus: string[]) => Promise<void>;
}) {
  const text = useAdminText();
  const product = row.original;

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
        row.getIsSelected() && "border-primary/45 bg-primary/5"
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`${text.catalog.selectItem} ${product.sku}`}
          className="mt-0.5"
        />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onViewProduct(product)}
        >
          <div className="break-words text-sm font-bold leading-snug text-slate-900">
            {product.name}
          </div>
          <div className="mt-0.5 break-all font-mono text-[11px] font-semibold leading-tight text-slate-500">
            {product.sku}
          </div>
        </button>
        <Badge className={cn("shrink-0", statusBadgeClass(product.status))}>
          {text.enums.stockStatus[product.status]}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" className="size-8 bg-white">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewProduct(product)}>
              <Eye className="size-4" />
              {text.common.details}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditProduct(product)}>
              <Edit className="size-4" />
              {text.common.edit}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isMutatingProducts}
              onClick={() => void onDuplicateProduct(product)}
            >
              <Copy className="size-4" />
              {text.common.duplicate}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              disabled={isMutatingProducts}
              onClick={() => void onDeleteProducts([product.sku])}
            >
              <Trash2 className="size-4" />
              {text.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
        <span>
          {text.common.stock}{" "}
          <span className={cn("font-black text-slate-950", product.stock === 0 && "text-red-500")}>
            {product.stock}
          </span>
        </span>
        <span>
          {text.common.price}{" "}
          <span className="font-black text-slate-950">€{product.price.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">{product.warehouse}</span>
      </div>
    </div>
  );
}

function AddProductDialog({
  disabled = false,
  onCreateProduct,
}: {
  disabled?: boolean;
  onCreateProduct: (values: ProductFormValues) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const text = useAdminText();
  const productSchema = React.useMemo(() => createProductSchema(text), [text]);
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultProductFormValues,
  });

  async function onSubmit(values: ProductFormValues) {
    const created = await onCreateProduct(values);

    if (created) {
      form.reset(defaultProductFormValues);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus className="size-4" />
          {text.catalog.form.newItem}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{text.catalog.form.newItem}</DialogTitle>
          <DialogDescription>
            {text.catalog.form.addDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <ProductFormFields form={form} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {text.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? text.catalog.savingProduct
                : text.common.saveItem}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductFormFields({ form }: { form: ProductFormApi }) {
  const text = useAdminText();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={text.catalog.form.name} error={form.formState.errors.name?.message}>
          <Input
            placeholder={text.catalog.form.namePlaceholder}
            {...form.register("name")}
          />
        </Field>
        <Field label={text.common.sku} error={form.formState.errors.sku?.message}>
          <Input placeholder={text.catalog.form.skuPlaceholder} {...form.register("sku")} />
        </Field>
        <Field label={text.catalog.form.category} error={form.formState.errors.category?.message}>
          <Select
            value={form.watch("category")}
            onValueChange={(value) =>
              form.setValue("category", value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.label} value={category.label}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={text.common.brand} error={form.formState.errors.brand?.message}>
          <Input placeholder={text.catalog.form.brandPlaceholder} {...form.register("brand")} />
        </Field>
        <Field label={text.common.quality} error={form.formState.errors.grade?.message}>
          <Select
            value={form.watch("grade")}
            onValueChange={(value) =>
              form.setValue("grade", value as ProductFormValues["grade"], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {productGrades.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={text.common.warehouse} error={form.formState.errors.warehouse?.message}>
          <Select
            value={form.watch("warehouse")}
            onValueChange={(value) =>
              form.setValue("warehouse", value as ProductFormValues["warehouse"], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse} value={warehouse}>
                  {warehouse}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={text.common.price} error={form.formState.errors.price?.message}>
            <Input type="number" step="0.01" {...form.register("price")} />
          </Field>
          <Field label={text.common.stock} error={form.formState.errors.stock?.message}>
            <Input type="number" {...form.register("stock")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={text.common.moq} error={form.formState.errors.moq?.message}>
            <Input type="number" {...form.register("moq")} />
          </Field>
          <Field label={text.common.leadTime} error={form.formState.errors.leadTime?.message}>
            <Input placeholder={text.catalog.form.leadTimePlaceholder} {...form.register("leadTime")} />
          </Field>
        </div>
      </div>
      <Field
        label={text.catalog.form.compatibility}
        error={form.formState.errors.compatibleWith?.message}
      >
        <Textarea
          placeholder={text.catalog.form.compatibilityPlaceholder}
          className="min-h-20"
          {...form.register("compatibleWith")}
        />
      </Field>
      <Field label={text.common.tag} error={form.formState.errors.tags?.message}>
        <Input placeholder={text.catalog.form.tagsPlaceholder} {...form.register("tags")} />
      </Field>
    </div>
  );
}

function ProductDetailsDialog({
  product,
  open,
  onOpenChange,
  onEdit,
}: {
  product: PartProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (product: PartProduct) => void;
}) {
  const text = useAdminText();

  if (!product) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>{product.sku}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          <PartVisual variant={product.visual} className="h-44 w-full rounded-lg" />
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label={text.common.category} value={product.category} />
            <DetailItem label={text.common.brand} value={product.brand} />
            <DetailItem
              label={text.common.quality}
              value={
                <Badge className={gradeBadgeClass(product.grade)}>
                  {text.enums.productGrade[product.grade]}
                </Badge>
              }
            />
            <DetailItem
              label={text.common.status}
              value={
                <Badge className={statusBadgeClass(product.status)}>
                  {text.enums.stockStatus[product.status]}
                </Badge>
              }
            />
            <DetailItem label={text.common.stock} value={product.stock} />
            <DetailItem label={text.catalog.priceNet} value={`€${product.price.toFixed(2)}`} />
            <DetailItem label={text.common.warehouse} value={product.warehouse} />
            <DetailItem label={text.common.moq} value={product.moq} />
            <DetailItem label={text.common.leadTime} value={product.leadTime} />
            <DetailItem label={text.common.updated} value={product.updatedAt} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              {text.common.compatibility}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.compatibleWith.map((item) => (
                <Badge key={item} variant="outline" className="bg-white">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              {text.common.tag}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="bg-white">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {text.common.close}
          </Button>
          <Button type="button" onClick={() => onEdit(product)}>
            <Edit className="size-4" />
            {text.common.edit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProductDialog({
  product,
  open,
  onOpenChange,
  onSave,
}: {
  product: PartProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (sku: string, values: ProductFormValues) => Promise<boolean>;
}) {
  const text = useAdminText();
  const productSchema = React.useMemo(() => createProductSchema(text), [text]);
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? productFormDefaults(product) : defaultProductFormValues,
  });
  const { reset } = form;

  React.useEffect(() => {
    if (product && open) {
      reset(productFormDefaults(product));
    }
  }, [open, product, reset]);

  if (!product) {
    return null;
  }

  const editingProduct = product;

  async function onSubmit(values: ProductFormValues) {
    const saved = await onSave(editingProduct.sku, values);

    if (saved) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{text.catalog.form.titleEdit}</DialogTitle>
          <DialogDescription>{editingProduct.sku}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <ProductFormFields form={form} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {text.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? text.catalog.savingProduct
                : text.common.saveChanges}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <FormLabel>{label}</FormLabel>
      {children}
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}

function LowerPanels({ products }: { products: PartProduct[] }) {
  const text = useAdminText();
  const alertProducts = products.filter((product) => product.stock <= 18);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.8fr)]">
      <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle>Flusso ordine</CardTitle>
          <CardDescription>Picking, pagamento, spedizione e completamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="mb-2 flex justify-between text-sm font-medium">
              <span>Avanzamento batch picking</span>
              <span>60%</span>
            </div>
            <Progress value={60} className="h-2" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {["Ordine", "Pagamento", "Spedizione", "Completato"].map((step, index) => (
              <div key={step} className="text-center">
                <div
                  className={cn(
                    "mx-auto grid size-8 place-items-center rounded-full text-xs font-bold",
                    index < 2 ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {index + 1}
                </div>
                <div className="mt-2 text-xs text-slate-500">{step}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative grid size-24 place-items-center rounded-full bg-[conic-gradient(#3b5bff_75%,#e7edff_0)]">
              <div className="grid size-18 place-items-center rounded-full bg-white text-lg font-black">
                75%
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                QC completato
              </div>
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-primary" />
                In attesa del corriere
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle>Azioni rapide</CardTitle>
          <CardDescription>Alert, riordino e automazioni operative</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Alert stock basso", "Avvisa buyer sotto 10 pezzi", true],
              ["Riordino automatico", "Stima sul venduto degli ultimi 7 giorni", true],
              ["Sync prezzi", "Aggiorna il listino fornitori", false],
              ["Reminder pagamento", "Sollecita ordini non pagati dopo 24h", true],
            ].map(([title, body, enabled]) => (
              <div key={title as string} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{title}</div>
                    <div className="mt-1 text-xs text-slate-500">{body}</div>
                  </div>
                  <Switch defaultChecked={Boolean(enabled)} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle>{text.catalog.lower.alertsTitle}</CardTitle>
          <CardDescription>{text.catalog.lower.alertsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertProducts.length ? (
            alertProducts.map((product) => (
              <div
                key={product.sku}
                className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
              >
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    product.stock === 0 ? "bg-red-500" : "bg-amber-500"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{product.sku}</div>
                  <div className="text-xs text-slate-500">
                    {formatAdminMessage(text.catalog.lower.stockLabel, {
                      count: product.stock,
                    })}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon-sm" className="bg-white">
                      <HelpCircle className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{text.catalog.noSupplierTooltip}</TooltipContent>
                </Tooltip>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm font-medium text-slate-500">
              {text.catalog.empty}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function statusBadgeClass(status: StockStatus) {
  if (status === "In Stock") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Low Stock") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function sourceBadgeClass(source: ProductSource) {
  if (source === "supabase") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (source === "api") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function noticeClassName(tone: ProductNotice["tone"]) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (tone === "error") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-sky-200 bg-sky-50 text-sky-800";
}

function gradeBadgeClass(grade: PartProduct["grade"]) {
  if (grade === "A+") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (grade === "A") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}
