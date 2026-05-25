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
  products as initialProducts,
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

type StatusFilterValue = "all" | StockStatus;
type StockFilterValue = "all" | "available" | "under-10" | "empty";
type ProductNotice = {
  tone: "success" | "info";
  message: string;
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
  anchor.download = `partspro-catalogo-${scope}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AdminDashboard() {
  const text = useAdminText();
  const [products, setProducts] = React.useState<PartProduct[]>(initialProducts);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilterValue>("all");
  const [stockFilter, setStockFilter] = React.useState<StockFilterValue>("all");
  const [notice, setNotice] = React.useState<ProductNotice | null>(null);
  const [viewProduct, setViewProduct] = React.useState<PartProduct | null>(null);
  const [editProduct, setEditProduct] = React.useState<PartProduct | null>(null);

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
    (values: ProductFormValues) => {
      const sku = ensureUniqueSku(values.sku, products);
      const product = productFromForm({ ...values, sku });

      setProducts([product, ...products]);
      setRowSelection({});
      setNotice({
        tone: "success",
        message: formatAdminMessage(text.catalog.createdNotice, { sku }),
      });
    },
    [products, text]
  );

  const handleUpdateProduct = React.useCallback(
    (originalSku: string, values: ProductFormValues) => {
      const currentProduct = products.find((product) => product.sku === originalSku);

      if (!currentProduct) {
        return;
      }

      const sku = ensureUniqueSku(values.sku, products, originalSku);
      const updatedProduct = productFromForm({ ...values, sku }, currentProduct);

      setProducts(
        products.map((product) =>
          product.sku === originalSku ? updatedProduct : product
        )
      );
      setRowSelection({});
      setEditProduct(null);
      setNotice({
        tone: "success",
        message: formatAdminMessage(text.catalog.updatedNotice, { sku }),
      });
    },
    [products, text]
  );

  const handleDeleteProducts = React.useCallback(
    (skus: string[]) => {
      const skuSet = new Set(skus);
      const nextProducts = products.filter((product) => !skuSet.has(product.sku));
      const deletedCount = products.length - nextProducts.length;

      if (deletedCount === 0) {
        return;
      }

      setProducts(nextProducts);
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
    },
    [editProduct, products, text, viewProduct]
  );

  const handleDuplicateProduct = React.useCallback(
    (product: PartProduct) => {
      const sku = ensureUniqueSku(`${product.sku}-COPY`, products);
      const duplicatedProduct: PartProduct = {
        ...product,
        sku,
        slug: slugify(sku),
        name: `${product.name} ${text.catalog.duplicatedSuffix}`,
        updatedAt: formatTimestamp(),
        tags: Array.from(new Set([...product.tags, text.catalog.duplicatedSuffix])),
      };

      setProducts([duplicatedProduct, ...products]);
      setRowSelection({});
      setNotice({
        tone: "success",
        message: formatAdminMessage(text.catalog.duplicatedNotice, { sku }),
      });
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
                <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>
                  <Copy className="size-4" />
                  {text.common.duplicate}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => handleDeleteProducts([product.sku])}
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
    [handleDeleteProducts, handleDuplicateProduct, text]
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
                />
              </TabsContent>
              <TabsContent value="timeline" className="order-4 mt-0 min-w-0">
                <AdminActivityTimeline />
              </TabsContent>
              <TabsContent value="overview" className="order-4 mt-0 min-w-0 space-y-4">
                <StatsGrid />
                <ChartsPanel />
                <LowerPanels />
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
            <div className="truncate text-sm font-bold">Admin</div>
            <div className="text-xs text-slate-500">Amministratore</div>
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
                Navigazione mobile del pannello operativo PartsPro.
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
          <div className="truncate text-lg font-black">Pannello operativo</div>
          <div className="truncate text-xs text-slate-500">
            Ordini, stock, catalogo e clienti in una sola vista
          </div>
        </div>

        <div className="relative ml-auto hidden w-full max-w-md md:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="h-10 bg-white pl-9" placeholder="Cerca ordini, SKU, clienti..." />
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
          <Link href="/">Home</Link>
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
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  statusFilter: StatusFilterValue;
  setStatusFilter: (value: StatusFilterValue) => void;
  stockFilter: StockFilterValue;
  setStockFilter: (value: StockFilterValue) => void;
  notice: ProductNotice | null;
  setNotice: (notice: ProductNotice | null) => void;
  onCreateProduct: (values: ProductFormValues) => void;
  onViewProduct: (product: PartProduct) => void;
  onEditProduct: (product: PartProduct) => void;
  onDuplicateProduct: (product: PartProduct) => void;
  onDeleteProducts: (skus: string[]) => void;
  onExportProducts: (products: PartProduct[], scope: "selected" | "view") => void;
};

function ProductsPanel({
  table,
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
}: ProductsPanelProps) {
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
          <CardTitle className="text-base sm:text-lg">Catalogo operativo</CardTitle>
          <CardDescription className="hidden sm:block">
            Tabella stock con ricerca, paginazione e selezione multipla
          </CardDescription>
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
          <div className="relative col-span-2 w-full lg:w-[240px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={globalFilter ?? ""}
              onChange={(event) => updateGlobalFilter(event.target.value)}
              className="h-9 w-full bg-white pl-9"
              placeholder="Cerca SKU / prodotto / brand"
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
              <SelectItem value="all">Tutti gli stati</SelectItem>
              {stockStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
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
              <SelectItem value="all">Tutto stock</SelectItem>
              <SelectItem value="available">Disponibili</SelectItem>
              <SelectItem value="under-10">Sotto 10</SelectItem>
              <SelectItem value="empty">Esauriti</SelectItem>
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
            Stock basso
          </Button>
          <Button
            variant="outline"
            className="bg-white"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            <Filter className="size-4" />
            Reset
          </Button>
          <Button
            variant="outline"
            className="bg-white"
            onClick={() => onExportProducts(currentProducts, "view")}
            disabled={currentProducts.length === 0}
          >
            <Download className="size-4" />
            Esporta vista
          </Button>
          <AddProductDialog onCreateProduct={onCreateProduct} />
        </div>
      </CardHeader>
      <CardContent className="min-w-0 px-3 sm:px-4">
        {notice && (
          <div
            className={cn(
              "mb-3 flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium",
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-sky-200 bg-sky-50 text-sky-800"
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
              OK
            </Button>
          </div>
        )}
        {selectedProducts.length > 0 && (
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:p-3">
            <div className="font-semibold text-slate-800">
              {selectedProducts.length} selezionati
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-white"
                onClick={() => onExportProducts(selectedProducts, "selected")}
              >
                <Download className="size-4" />
                Esporta selezione
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  onDeleteProducts(selectedProducts.map((product) => product.sku))
                }
              >
                <Trash2 className="size-4" />
                Elimina
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => table.resetRowSelection()}
              >
                Deseleziona
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
                aria-label="Seleziona articoli in pagina"
              />
              <span>Seleziona pagina</span>
            </label>
            <span className="shrink-0 font-medium">{pageRows.length} in pagina</span>
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
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm font-medium text-slate-500">
              Nessun articolo corrispondente
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
                      Nessun articolo corrispondente
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="hidden text-sm text-slate-500 sm:block">
            Vista {table.getRowModel().rows.length} di {currentProducts.length} articoli
            {" · "}Selezionati {selectedProducts.length}
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
                    {pageSize} / pag.
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
  onViewProduct,
  onEditProduct,
  onDuplicateProduct,
  onDeleteProducts,
}: {
  row: Row<PartProduct>;
  onViewProduct: (product: PartProduct) => void;
  onEditProduct: (product: PartProduct) => void;
  onDuplicateProduct: (product: PartProduct) => void;
  onDeleteProducts: (skus: string[]) => void;
}) {
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
          aria-label={`Seleziona ${product.sku}`}
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
          {product.status}
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
              Dettagli
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditProduct(product)}>
              <Edit className="size-4" />
              Modifica
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicateProduct(product)}>
              <Copy className="size-4" />
              Duplica
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => onDeleteProducts([product.sku])}
            >
              <Trash2 className="size-4" />
              Elimina
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
        <span>
          Stock{" "}
          <span className={cn("font-black text-slate-950", product.stock === 0 && "text-red-500")}>
            {product.stock}
          </span>
        </span>
        <span>
          Prezzo <span className="font-black text-slate-950">€{product.price.toFixed(2)}</span>
        </span>
        <span className="text-slate-400">{product.warehouse}</span>
      </div>
    </div>
  );
}

function AddProductDialog({
  onCreateProduct,
}: {
  onCreateProduct: (values: ProductFormValues) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const text = useAdminText();
  const productSchema = React.useMemo(() => createProductSchema(text), [text]);
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultProductFormValues,
  });

  function onSubmit(values: ProductFormValues) {
    onCreateProduct(values);
    form.reset(defaultProductFormValues);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nuovo articolo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Nuovo articolo</DialogTitle>
          <DialogDescription>
            Aggiungi un ricambio al catalogo con SKU, qualità, prezzo netto e stock.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <ProductFormFields form={form} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit">Salva articolo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductFormFields({ form }: { form: ProductFormApi }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome prodotto" error={form.formState.errors.name?.message}>
          <Input placeholder="Es. Display OLED iPhone 13 Pro" {...form.register("name")} />
        </Field>
        <Field label="SKU" error={form.formState.errors.sku?.message}>
          <Input placeholder="Es. SKU-REALE-001" {...form.register("sku")} />
        </Field>
        <Field label="Categoria" error={form.formState.errors.category?.message}>
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
        <Field label="Brand" error={form.formState.errors.brand?.message}>
          <Input placeholder="OEM / Apple / Samsung" {...form.register("brand")} />
        </Field>
        <Field label="Qualità" error={form.formState.errors.grade?.message}>
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
        <Field label="Magazzino" error={form.formState.errors.warehouse?.message}>
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
          <Field label="Prezzo" error={form.formState.errors.price?.message}>
            <Input type="number" step="0.01" {...form.register("price")} />
          </Field>
          <Field label="Stock" error={form.formState.errors.stock?.message}>
            <Input type="number" {...form.register("stock")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="MOQ" error={form.formState.errors.moq?.message}>
            <Input type="number" {...form.register("moq")} />
          </Field>
          <Field label="Lead time" error={form.formState.errors.leadTime?.message}>
            <Input placeholder="24/48h Italia" {...form.register("leadTime")} />
          </Field>
        </div>
      </div>
      <Field
        label="Compatibilità"
        error={form.formState.errors.compatibleWith?.message}
      >
        <Textarea
          placeholder="iPhone 13 Pro, iPhone 13 Pro Max"
          className="min-h-20"
          {...form.register("compatibleWith")}
        />
      </Field>
      <Field label="Tag" error={form.formState.errors.tags?.message}>
        <Input placeholder="OLED, True Tone, Wholesale" {...form.register("tags")} />
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
            <DetailItem label="Categoria" value={product.category} />
            <DetailItem label="Brand" value={product.brand} />
            <DetailItem
              label="Qualità"
              value={<Badge className={gradeBadgeClass(product.grade)}>{product.grade}</Badge>}
            />
            <DetailItem
              label="Stato"
              value={
                <Badge className={statusBadgeClass(product.status)}>{product.status}</Badge>
              }
            />
            <DetailItem label="Stock" value={product.stock} />
            <DetailItem label="Prezzo netto" value={`€${product.price.toFixed(2)}`} />
            <DetailItem label="Magazzino" value={product.warehouse} />
            <DetailItem label="MOQ" value={product.moq} />
            <DetailItem label="Lead time" value={product.leadTime} />
            <DetailItem label="Aggiornato" value={product.updatedAt} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Compatibilità
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
            <div className="text-xs font-semibold uppercase text-slate-500">Tag</div>
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
            Chiudi
          </Button>
          <Button type="button" onClick={() => onEdit(product)}>
            <Edit className="size-4" />
            Modifica
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
  onSave: (sku: string, values: ProductFormValues) => void;
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

  function onSubmit(values: ProductFormValues) {
    onSave(editingProduct.sku, values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Modifica articolo</DialogTitle>
          <DialogDescription>{editingProduct.sku}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <ProductFormFields form={form} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit">Salva modifiche</Button>
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

function LowerPanels() {
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
          <CardTitle>Alert magazzino</CardTitle>
          <CardDescription>Priorità da gestire oggi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {initialProducts
            .filter((product) => product.stock <= 18)
            .map((product) => (
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
                  <div className="text-xs text-slate-500">Stock: {product.stock}</div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon-sm" className="bg-white">
                      <HelpCircle className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vedi fornitore e suggerimento di acquisto</TooltipContent>
                </Tooltip>
              </div>
            ))}
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

function gradeBadgeClass(grade: PartProduct["grade"]) {
  if (grade === "A+") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (grade === "A") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}
