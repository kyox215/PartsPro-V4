"use client";

import * as React from "react";
import Image from "next/image";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  LineChart,
  Package,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Truck,
  type LucideIcon,
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminSourceLabel,
  formatAdminMessage,
  getAdminDictionary,
  type AdminText,
} from "@/i18n/dictionaries/admin";
import { formatEuro, type StockStatus } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { AdminBusyRegion } from "./admin-feedback";
import { useI18n } from "./i18n-provider";

type AdminOverviewPanelValue =
  | "overview"
  | "orders"
  | "catalog"
  | "timeline"
  | "accounts"
  | "settings";

type AdminOverviewDashboardProps = {
  onPanelChange?: (panel: AdminOverviewPanelValue) => void;
  visiblePanels?: ReadonlySet<AdminOverviewPanelValue>;
};

type DashboardRange = (typeof dashboardRanges)[number];
type OrderStatus = (typeof orderStatuses)[number];
type PaymentStatus = "unpaid" | "authorized" | "paid" | "refunded";
type CatalogStatus = "active" | "draft" | "hidden" | "blocked";
type RiskLevel = "urgent" | "watch" | "ok";

type DashboardOrderLine = {
  sku: string;
  name: string;
  quantity: number;
  lineTotal: number;
};

type DashboardOrder = {
  id: string;
  company: string;
  createdAt: string;
  items: number;
  lines: DashboardOrderLine[];
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  total: number;
};

type DashboardProduct = {
  sku: string;
  name: string;
  brand: string;
  category: string;
  catalogStatus: CatalogStatus;
  galleryImagePaths: string[];
  galleryImageUrls: string[];
  imageAlt?: string;
  imagePath?: string;
  imageUrl?: string;
  lockedQty: number;
  price: number;
  status: StockStatus;
  stock: number;
  availableQty: number;
  updatedAt: string;
};

type DashboardSnapshot = {
  error: string | null;
  isLoading: boolean;
  orderSource: string;
  orderTotal: number;
  orders: DashboardOrder[];
  ordersReturned: number;
  productSource: string;
  productTotal: number;
  products: DashboardProduct[];
  productsReturned: number;
  syncedAt: string | null;
};

type SalesTrendPoint = {
  day: string;
  key: string;
  orders: number;
  pieces: number;
  sales: number;
};

type InventoryMixPoint = {
  fill: string;
  key: StockStatus;
  label: string;
  value: number;
};

type PipelinePoint = {
  count: number;
  key: OrderStatus;
  revenue: number;
};

type HotSkuRow = {
  availableQty: number | null;
  name: string;
  quantity: number;
  revenue: number;
  sku: string;
};

type HotStockAlert = {
  availableQty: number;
  coverageDays: number | null;
  galleryImagePaths: string[];
  galleryImageUrls: string[];
  imageAlt?: string;
  imagePath?: string;
  imageUrl?: string;
  name: string;
  risk: RiskLevel;
  sku: string;
  sold7d: number;
  stock: number;
};

type DashboardModel = {
  activeSku: number;
  averageOrder7d: number;
  catalogHealth: {
    active: number;
    blocked: number;
    completion: number;
    draft: number;
    hidden: number;
    missingImage: number;
    missingPrice: number;
  };
  fulfillmentQueue: number;
  hotSku: HotSkuRow[];
  hotStockAlerts: HotStockAlert[];
  inventoryMix: InventoryMixPoint[];
  inventoryTotals: {
    available: number;
    inStock: number;
    locked: number;
    lowStock: number;
    outOfStock: number;
  };
  paidOrders7d: number;
  pendingPayments: number;
  pipeline: PipelinePoint[];
  previousSales7d: number;
  sales7d: number;
  salesTrend: SalesTrendPoint[];
  stockAlerts: number;
  todayOrders: number;
  uniqueCustomers: number;
  yesterdayOrders: number;
};

type MetricCard = {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "blue" | "green" | "amber" | "red" | "violet" | "cyan";
  value: string;
};

const dashboardRanges = ["7", "30", "90"] as const;
const orderStatuses = [
  "submitted",
  "accepted",
  "picking",
  "packed",
  "shipped",
  "completed",
  "cancelled",
] as const;
const stockStatuses = ["In Stock", "Low Stock", "Out of Stock"] as const;
const catalogStatuses = ["active", "draft", "hidden", "blocked"] as const;
const productImagesBucket = "product-images";
const fulfillmentQueueStatuses = new Set<OrderStatus>([
  "submitted",
  "accepted",
  "picking",
  "packed",
  "shipped",
]);
const cardClass =
  "min-w-0 rounded-lg border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.045)]";

export function AdminOverviewDashboard({
  onPanelChange,
  visiblePanels,
}: AdminOverviewDashboardProps) {
  const { locale } = useI18n();
  const text = getAdminDictionary(locale).admin;
  const copy = text.dashboard.overview;
  const [salesRange, setSalesRange] = React.useState<DashboardRange>("7");
  const { refresh, snapshot } = useDashboardSnapshot();
  const model = React.useMemo(
    () => buildDashboardModel(snapshot, Number(salesRange)),
    [salesRange, snapshot]
  );
  const metrics = React.useMemo<MetricCard[]>(
    () => [
      {
        detail: `${formatDelta(model.todayOrders, model.yesterdayOrders)} ${copy.details.vsYesterday}`,
        icon: ClipboardList,
        label: copy.metrics.todayOrders,
        tone: "blue",
        value: formatCount(model.todayOrders, locale),
      },
      {
        detail: `${formatDelta(model.sales7d, model.previousSales7d)} ${copy.details.vsPrevious7d}`,
        icon: CircleDollarSign,
        label: copy.metrics.sales7d,
        tone: "green",
        value: formatEuro(model.sales7d),
      },
      {
        detail: copy.details.needsFollowUp,
        icon: ShoppingCart,
        label: copy.metrics.pendingPayments,
        tone: "amber",
        value: formatCount(model.pendingPayments, locale),
      },
      {
        detail: copy.details.lowOrOut,
        icon: ShieldAlert,
        label: copy.metrics.stockAlerts,
        tone: model.stockAlerts > 0 ? "red" : "green",
        value: formatCount(model.stockAlerts, locale),
      },
      {
        detail: copy.details.activeCatalog,
        icon: Package,
        label: copy.metrics.activeSku,
        tone: "violet",
        value: formatCount(model.activeSku, locale),
      },
      {
        detail: copy.details.openShipments,
        icon: Truck,
        label: copy.metrics.fulfillmentQueue,
        tone: "cyan",
        value: formatCount(model.fulfillmentQueue, locale),
      },
    ],
    [copy, locale, model]
  );

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <OverviewHeader
        copy={copy}
        locale={locale}
        onRefresh={refresh}
        snapshot={snapshot}
        text={text}
      />

      {snapshot.error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {copy.partialData}: {snapshot.error}
        </div>
      ) : null}

      <AdminBusyRegion
        contentClassName="space-y-2.5 sm:space-y-3"
        label={text.common.refreshing}
        pending={snapshot.isLoading}
        rows={6}
      >
        <MetricGrid metrics={metrics} />

        <section className="grid gap-2.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
          <SalesTrendCard
            copy={copy}
            model={model}
            onRangeChange={setSalesRange}
            range={salesRange}
            text={text}
          />
          <InventoryRiskCard copy={copy} locale={locale} model={model} />
        </section>

        <section className="grid gap-2.5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.85fr)]">
          <OrderPipelineCard model={model} text={text} />
          <HotSkuCard copy={copy} locale={locale} model={model} />
          <CatalogOpsCard
            copy={copy}
            model={model}
            onPanelChange={onPanelChange}
            text={text}
            visiblePanels={visiblePanels}
          />
        </section>
      </AdminBusyRegion>
    </div>
  );
}

function OverviewHeader({
  copy,
  locale,
  onRefresh,
  snapshot,
  text,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["dashboard"]["overview"];
  locale: string;
  onRefresh: () => void;
  snapshot: DashboardSnapshot;
  text: AdminText;
}) {
  const syncedAt = snapshot.syncedAt
    ? formatAdminMessage(copy.updated, {
        time: formatTime(snapshot.syncedAt, locale),
      })
    : copy.syncing;

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h1 className="truncate text-base font-black leading-5 text-slate-950 sm:text-lg">
              {copy.sections.operations}
            </h1>
            <Badge variant="outline" className="h-5 rounded-md border-slate-200 bg-slate-50 px-1.5 text-[10px]">
              {syncedAt}
            </Badge>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] font-semibold text-slate-500 sm:flex sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
            <span className="min-w-0 truncate rounded bg-slate-50 px-1.5 py-0.5 sm:bg-transparent sm:px-0 sm:py-0">
            {formatAdminMessage(copy.ordersSource, {
              returned: snapshot.ordersReturned,
              total: snapshot.orderTotal,
            })}
            </span>
            <span className="min-w-0 truncate rounded bg-slate-50 px-1.5 py-0.5 sm:bg-transparent sm:px-0 sm:py-0">
            {formatAdminMessage(copy.productsSource, {
              returned: snapshot.productsReturned,
              total: snapshot.productTotal,
            })}
            </span>
            <span className="col-span-2 min-w-0 truncate rounded bg-slate-50 px-1.5 py-0.5 sm:col-span-1 sm:bg-transparent sm:px-0 sm:py-0">
              {copy.source}: {sourceLabel(text, snapshot.orderSource)} / {sourceLabel(text, snapshot.productSource)}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 rounded-md bg-white px-2 text-[11px] sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs"
          disabled={snapshot.isLoading}
          onClick={onRefresh}
        >
          <RefreshCw className={cn("size-3.5", snapshot.isLoading && "animate-spin")} />
          <span>{snapshot.isLoading ? copy.syncing : copy.refresh}</span>
        </Button>
      </div>
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <Card key={metric.label} size="sm" className={cn(cardClass, "py-2.5")}>
          <CardContent className="px-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-500">
                  {metric.label}
                </p>
                <div className="mt-1 truncate font-mono text-xl font-black leading-none text-slate-950 sm:text-2xl">
                  {metric.value}
                </div>
              </div>
              <div
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-md",
                  metricToneClass(metric.tone)
                )}
              >
                <metric.icon className="size-4" />
              </div>
            </div>
            <p className="mt-2 truncate text-[11px] font-semibold text-slate-500">
              {metric.detail}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function SalesTrendCard({
  copy,
  model,
  onRangeChange,
  range,
  text,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["dashboard"]["overview"];
  model: DashboardModel;
  onRangeChange: (range: DashboardRange) => void;
  range: DashboardRange;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  const gradientId = React.useId().replaceAll(":", "");

  return (
    <Card className={cardClass}>
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm font-black">
            {copy.sections.salesTrend}
          </CardTitle>
          <CardDescription className="truncate text-xs">
            {copy.sections.salesTrendDescription}
          </CardDescription>
        </div>
        <Select
          value={range}
          onValueChange={(value) => {
            if (isDashboardRange(value)) {
              onRangeChange(value);
            }
          }}
        >
          <SelectTrigger
            className="h-8 w-[92px] rounded-md bg-white text-xs"
            aria-label={copy.sections.salesTrend}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{text.dashboard.charts.range7}</SelectItem>
            <SelectItem value="30">{text.dashboard.charts.range30}</SelectItem>
            <SelectItem value="90">{text.dashboard.charts.range90}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="grid gap-2 px-2 pb-2 sm:px-3 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="h-[220px] min-w-0">
          <MeasuredChart height={220}>
            {(width, height) => (
              <AreaChart width={width} height={height} data={model.salesTrend}>
                <defs>
                  <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5edf7" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="day"
                  fontSize={11}
                  interval="preserveStartEnd"
                  minTickGap={18}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  width={42}
                  fontSize={11}
                  tickFormatter={formatAxisEuro}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip
                  formatter={(value, name) => [
                    name === "sales" ? formatEuro(Number(value)) : value,
                    name === "sales" ? text.dashboard.charts.sales : name,
                  ]}
                  contentStyle={{
                    border: "1px solid #dfe6f1",
                    borderRadius: 8,
                    boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                />
              </AreaChart>
            )}
          </MeasuredChart>
        </div>
        <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-1">
          <MiniKpi
            icon={CircleDollarSign}
            label={copy.metrics.sales7d}
            value={formatEuro(model.sales7d)}
          />
          <MiniKpi
            icon={ShoppingCart}
            label={copy.details.paidOrders}
            value={String(model.paidOrders7d)}
          />
          <MiniKpi
            icon={Gauge}
            label={copy.details.fromLoadedOrders}
            value={formatEuro(model.averageOrder7d)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryRiskCard({
  copy,
  locale,
  model,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["dashboard"]["overview"];
  locale: string;
  model: DashboardModel;
}) {
  return (
    <Card className={cardClass}>
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm font-black">
            {copy.sections.inventoryRisk}
          </CardTitle>
          <CardDescription className="truncate text-xs">
            {copy.sections.inventoryRiskDescription}
          </CardDescription>
        </div>
        <Badge variant="outline" className="h-5 rounded-md border-red-200 bg-red-50 text-[10px] text-red-700">
          {model.stockAlerts}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-2 px-3 pb-3 md:grid-cols-[136px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[136px_minmax(0,1fr)]">
        <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-2 md:block xl:grid-cols-[116px_minmax(0,1fr)] 2xl:block">
          <div className="h-[116px]">
            {model.inventoryMix.some((item) => item.value > 0) ? (
              <MeasuredChart compact height={116}>
                {(width, height) => (
                  <PieChart width={width} height={height}>
                    <Pie
                      data={model.inventoryMix}
                      innerRadius={34}
                      outerRadius={52}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {model.inventoryMix.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                )}
              </MeasuredChart>
            ) : (
              <ChartPlaceholder compact />
            )}
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-1.5 text-[11px] md:mt-2 xl:mt-0 2xl:mt-2">
            {model.inventoryMix.map((item) => (
              <div key={item.key} className="flex min-w-0 items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: item.fill }} />
                <span className="min-w-0 flex-1 truncate text-slate-500">
                  {stockStatusLabel(item.key, copy)}
                </span>
                <span className="font-mono font-black">{formatCount(item.value, locale)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {model.hotStockAlerts.length > 0 ? (
            model.hotStockAlerts.map((alert) => (
              <InventoryAlertRow
                alert={alert}
                copy={copy}
                key={alert.sku}
                locale={locale}
              />
            ))
          ) : (
            <div className="grid min-h-[132px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-xs font-semibold text-slate-500">
              {copy.inventory.noAlerts}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryAlertRow({
  alert,
  copy,
  locale,
}: {
  alert: HotStockAlert;
  copy: ReturnType<typeof getAdminDictionary>["admin"]["dashboard"]["overview"];
  locale: string;
}) {
  const coverage =
    alert.coverageDays === null
      ? "--"
      : formatAdminMessage(copy.inventory.days, {
          count: Math.max(0, Math.ceil(alert.coverageDays)),
        });

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/70 px-2.5 py-2">
      <div className="flex min-w-0 gap-2">
        <InventoryAlertImage alert={alert} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-xs font-black leading-snug text-slate-900">
                {alert.name}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    alert.risk === "urgent"
                      ? "bg-red-500"
                      : alert.risk === "watch"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  )}
                />
                <span className="min-w-0 truncate font-mono text-[10px] font-black text-slate-500">
                  {alert.sku}
                </span>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "h-5 shrink-0 rounded-md px-1.5 text-[10px]",
                alert.risk === "urgent"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              )}
            >
              {alert.risk === "urgent" ? copy.inventory.urgent : copy.inventory.watch}
            </Badge>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
            <DenseFact label={copy.inventory.available} value={formatCount(alert.availableQty, locale)} />
            <DenseFact label={copy.inventory.sold7d} value={formatCount(alert.sold7d, locale)} />
            <DenseFact label={copy.inventory.coverage} value={coverage} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryAlertImage({ alert }: { alert: HotStockAlert }) {
  const candidates = React.useMemo(() => getOverviewProductImageCandidates(alert), [alert]);
  const [failedImageState, setFailedImageState] = React.useState<{
    sku: string;
    urls: string[];
  }>({ sku: alert.sku, urls: [] });
  const failedUrls = failedImageState.sku === alert.sku ? failedImageState.urls : [];
  const imageUrl = candidates.find((candidate) => !failedUrls.includes(candidate));

  return (
    <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alert.imageAlt || alert.name}
          fill
          sizes="48px"
          quality={72}
          loading="lazy"
          decoding="async"
          className="object-contain p-1"
          onError={() =>
            setFailedImageState((current) => {
              const urls = current.sku === alert.sku ? current.urls : [];

              if (urls.includes(imageUrl)) {
                return current.sku === alert.sku ? current : { sku: alert.sku, urls };
              }

              return { sku: alert.sku, urls: [...urls, imageUrl] };
            })
          }
        />
      ) : (
        <Package className="size-5 text-slate-300" />
      )}
    </div>
  );
}

function getOverviewProductImageCandidates(product: HotStockAlert) {
  const imagePathUrl = resolveOverviewProductImageUrl(product.imagePath);
  const galleryPathUrls = product.galleryImagePaths.map(resolveOverviewProductImageUrl);
  const candidates = [
    product.imageUrl,
    imagePathUrl,
    getExternalProductImageFallbackUrl(product.imageUrl),
    getExternalProductImageFallbackUrl(product.imagePath),
    ...product.galleryImageUrls,
    ...product.galleryImageUrls.map(getExternalProductImageFallbackUrl),
    ...galleryPathUrls,
    ...product.galleryImagePaths.map(getExternalProductImageFallbackUrl),
  ];

  return Array.from(
    new Set(candidates.map((candidate) => candidate?.trim()).filter(isNonEmptyString))
  );
}

function resolveOverviewProductImageUrl(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");

  return supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/${productImagesBucket}/${normalized.replace(/^\/+/, "")}`
    : "";
}

function getExternalProductImageFallbackUrl(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "";
  }

  const imageId = normalized.match(/-(\d+)\.(?:png|jpe?g|webp|gif)(?:$|\?)/i)?.[1];

  return imageId
    ? `https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/${imageId}?size=bg`
    : "";
}

function OrderPipelineCard({
  model,
  text,
}: {
  model: DashboardModel;
  text: ReturnType<typeof getAdminDictionary>["admin"];
}) {
  const maxCount = Math.max(1, ...model.pipeline.map((item) => item.count));

  return (
    <Card className={cardClass}>
      <CardHeader className="px-3">
        <CardTitle className="text-sm font-black">
          {text.dashboard.overview.sections.orderPipeline}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {model.pipeline.map((item) => (
          <div key={item.key} className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">
                {text.enums.adminOrderStatus[item.key]}
              </span>
              <span className="font-mono font-black text-slate-950">{item.count}</span>
            </div>
            <Progress value={(item.count / maxCount) * 100} className="h-1.5 bg-slate-100" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HotSkuCard({
  copy,
  locale,
  model,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["dashboard"]["overview"];
  locale: string;
  model: DashboardModel;
}) {
  return (
    <Card className={cardClass}>
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3">
        <CardTitle className="truncate text-sm font-black">
          {copy.sections.hotSku}
        </CardTitle>
        <LineChart className="size-4 text-slate-400" />
      </CardHeader>
      <CardContent className="space-y-1.5 px-3 pb-3">
        {model.hotSku.length > 0 ? (
          model.hotSku.map((item, index) => (
            <div
              key={item.sku}
              className="grid grid-cols-[22px_minmax(0,1fr)_44px_74px] items-center gap-2 rounded-md border border-slate-100 px-2 py-2 text-xs"
            >
              <span className="grid size-5 place-items-center rounded bg-slate-100 font-mono text-[10px] font-black text-slate-500">
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="truncate font-black text-slate-900">{item.sku}</div>
                <div className="truncate text-[11px] text-slate-500">{item.name}</div>
              </div>
              <div className="text-right font-mono font-black">
                {formatCount(item.quantity, locale)}
              </div>
              <div className="truncate text-right font-mono font-black text-emerald-700">
                {formatEuro(item.revenue)}
              </div>
            </div>
          ))
        ) : (
          <div className="grid min-h-[172px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-xs font-semibold text-slate-500">
            {copy.empty}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CatalogOpsCard({
  copy,
  model,
  onPanelChange,
  text,
  visiblePanels,
}: {
  copy: ReturnType<typeof getAdminDictionary>["admin"]["dashboard"]["overview"];
  model: DashboardModel;
  onPanelChange?: (panel: AdminOverviewPanelValue) => void;
  text: ReturnType<typeof getAdminDictionary>["admin"];
  visiblePanels?: ReadonlySet<AdminOverviewPanelValue>;
}) {
  const actions = [
    { icon: ClipboardList, label: copy.actions.openOrders, panel: "orders" },
    { icon: Package, label: copy.actions.openCatalog, panel: "catalog" },
    { icon: BarChart3, label: copy.actions.openTimeline, panel: "timeline" },
  ] as const;

  return (
    <Card className={cardClass}>
      <CardHeader className="px-3">
        <CardTitle className="text-sm font-black">
          {copy.sections.catalogHealth}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">{copy.sections.catalogHealth}</span>
            <span className="font-mono font-black text-slate-950">
              {model.catalogHealth.completion}%
            </span>
          </div>
          <Progress value={model.catalogHealth.completion} className="h-1.5 bg-white" />
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <DenseFact
              label={text.enums.catalogStatus.active}
              value={String(model.catalogHealth.active)}
            />
            <DenseFact
              label={text.enums.catalogStatus.draft}
              value={String(model.catalogHealth.draft)}
            />
            <DenseFact
              label={text.common.price}
              value={String(model.catalogHealth.missingPrice)}
            />
            <DenseFact
              label={text.common.media}
              value={String(model.catalogHealth.missingImage)}
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-100 bg-white px-2.5 py-2">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-900">
            <Boxes className="size-3.5 text-slate-400" />
            {copy.sections.quickOps}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {actions.map((action) => {
              const isVisible = !visiblePanels || visiblePanels.has(action.panel);

              if (!isVisible) {
                return null;
              }

              return (
                <Button
                  className="h-8 justify-between rounded-md px-2 text-xs"
                  disabled={!onPanelChange}
                  key={action.panel}
                  onClick={() => onPanelChange?.(action.panel)}
                  type="button"
                  variant="outline"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <action.icon className="size-3.5 shrink-0" />
                    <span className="truncate">{action.label}</span>
                  </span>
                  <ArrowRight className="size-3 shrink-0 text-slate-400" />
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKpi({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate font-mono text-sm font-black text-slate-950">
        {value}
      </div>
    </div>
  );
}

function DenseFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-slate-100 bg-white px-1.5 py-1">
      <div className="truncate text-[10px] font-semibold text-slate-400">{label}</div>
      <div className="truncate font-mono text-xs font-black text-slate-900">{value}</div>
    </div>
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
    <div className="flex h-full min-h-[96px] items-end gap-1.5 rounded-lg bg-slate-50 p-3">
      {Array.from({ length: compact ? 5 : 10 }).map((_, index) => (
        <div
          key={index}
          className="flex-1 rounded-t bg-primary/15"
          style={{ height: `${24 + ((index * 19) % 58)}%` }}
        />
      ))}
    </div>
  );
}

function useDashboardSnapshot() {
  const [reloadIndex, setReloadIndex] = React.useState(0);
  const [snapshot, setSnapshot] = React.useState<DashboardSnapshot>(() => ({
    ...emptyDashboardSnapshot(),
    isLoading: true,
  }));

  React.useEffect(() => {
    const controller = new AbortController();

    void Promise.allSettled([
      fetchDashboardOrders(controller.signal),
      fetchDashboardProducts(controller.signal),
    ]).then((results) => {
      if (controller.signal.aborted) {
        return;
      }

      const [ordersResult, productsResult] = results;
      const errors: string[] = [];

      setSnapshot((current) => {
        const next = { ...current };

        if (ordersResult.status === "fulfilled") {
          next.orders = ordersResult.value.orders;
          next.orderSource = ordersResult.value.source;
          next.orderTotal = ordersResult.value.total;
          next.ordersReturned = ordersResult.value.returned;
        } else {
          errors.push(readErrorMessage(ordersResult.reason));
        }

        if (productsResult.status === "fulfilled") {
          next.products = productsResult.value.products;
          next.productSource = productsResult.value.source;
          next.productTotal = productsResult.value.total;
          next.productsReturned = productsResult.value.returned;
        } else {
          errors.push(readErrorMessage(productsResult.reason));
        }

        return {
          ...next,
          error: errors.length > 0 ? errors.join(" ") : null,
          isLoading: false,
          syncedAt: new Date().toISOString(),
        };
      });
    });

    return () => {
      controller.abort();
    };
  }, [reloadIndex]);

  return {
    refresh: React.useCallback(() => {
      setSnapshot((current) => ({
        ...current,
        error: null,
        isLoading: true,
      }));
      setReloadIndex((value) => value + 1);
    }, []),
    snapshot,
  };
}

async function fetchDashboardOrders(signal: AbortSignal) {
  const params = new URLSearchParams({
    limit: "100",
    offset: "0",
    sort: "date_desc",
  });
  const response = await fetch(`/api/admin/orders?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/orders ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const meta = readMeta(payload);
  const rows = readRows(payload);
  const orders = rows.map(normalizeDashboardOrder).filter(isDefined);

  return {
    orders,
    returned: readNumber(meta.returned) ?? orders.length,
    source: readString(meta.source) ?? "empty",
    total: readNumber(meta.total) ?? orders.length,
  };
}

async function fetchDashboardProducts(signal: AbortSignal) {
  const params = new URLSearchParams({
    limit: "100",
    offset: "0",
    sort: "updated_desc",
  });
  const response = await fetch(`/api/admin/products?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/products ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const meta = readMeta(payload);
  const rows = readRows(payload);
  const products = rows.map(normalizeDashboardProduct).filter(isDefined);

  return {
    products,
    returned: readNumber(meta.returned) ?? products.length,
    source: readString(meta.source) ?? "empty",
    total: readNumber(meta.total) ?? products.length,
  };
}

function buildDashboardModel(snapshot: DashboardSnapshot, salesRange: number): DashboardModel {
  const now = new Date();
  const todayKey = dateKey(now);
  const yesterdayKey = dateKey(addDays(now, -1));
  const orders = snapshot.orders;
  const products = snapshot.products;
  const ordersToday = orders.filter((order) => dateKey(parseDate(order.createdAt)) === todayKey);
  const ordersYesterday = orders.filter(
    (order) => dateKey(parseDate(order.createdAt)) === yesterdayKey
  );
  const paidOrders = orders.filter(isPaidOrder);
  const sales7dWindow = buildWindow(now, 7);
  const previousSales7dWindow = buildWindow(addDays(now, -7), 7);
  const recentPaidOrders = paidOrders.filter((order) =>
    sales7dWindow.has(dateKey(parseDate(order.createdAt)))
  );
  const previousPaidOrders = paidOrders.filter((order) =>
    previousSales7dWindow.has(dateKey(parseDate(order.createdAt)))
  );
  const sales7d = sumBy(recentPaidOrders, (order) => order.total);
  const previousSales7d = sumBy(previousPaidOrders, (order) => order.total);
  const salesBySku = buildSkuSales(recentPaidOrders);
  const productBySku = new Map(products.map((product) => [product.sku.toLowerCase(), product]));
  const hotStockAlerts = buildHotStockAlerts(products, salesBySku);
  const hotSku = buildHotSkuRows(salesBySku, productBySku);
  const inStock = products.filter((product) => product.status === "In Stock").length;
  const lowStock = products.filter((product) => product.status === "Low Stock").length;
  const outOfStock = products.filter((product) => product.status === "Out of Stock").length;
  const active = products.filter((product) => product.catalogStatus === "active").length;
  const draft = products.filter((product) => product.catalogStatus === "draft").length;
  const hidden = products.filter((product) => product.catalogStatus === "hidden").length;
  const blocked = products.filter((product) => product.catalogStatus === "blocked").length;
  const missingImage = products.filter((product) => !product.imageUrl).length;
  const missingPrice = products.filter((product) => product.price <= 0).length;
  const completion = products.length
    ? Math.round(
        ((active + (products.length - missingImage) + (products.length - missingPrice)) /
          (products.length * 3)) *
          100
      )
    : 0;

  return {
    activeSku: active || products.filter((product) => product.stock > 0).length,
    averageOrder7d: recentPaidOrders.length > 0 ? sales7d / recentPaidOrders.length : 0,
    catalogHealth: {
      active,
      blocked,
      completion,
      draft,
      hidden,
      missingImage,
      missingPrice,
    },
    fulfillmentQueue: orders.filter((order) => fulfillmentQueueStatuses.has(order.status)).length,
    hotSku,
    hotStockAlerts,
    inventoryMix: [
      { fill: "#16a34a", key: "In Stock", label: "In Stock", value: inStock },
      { fill: "#f59e0b", key: "Low Stock", label: "Low Stock", value: lowStock },
      { fill: "#ef4444", key: "Out of Stock", label: "Out of Stock", value: outOfStock },
    ],
    inventoryTotals: {
      available: sumBy(products, (product) => product.availableQty),
      inStock,
      locked: sumBy(products, (product) => product.lockedQty),
      lowStock,
      outOfStock,
    },
    paidOrders7d: recentPaidOrders.length,
    pendingPayments: orders.filter(
      (order) => order.paymentStatus !== "paid" && order.status !== "cancelled"
    ).length,
    pipeline: orderStatuses.map((status) => {
      const statusOrders = orders.filter((order) => order.status === status);

      return {
        count: statusOrders.length,
        key: status,
        revenue: sumBy(statusOrders, (order) => order.total),
      };
    }),
    previousSales7d,
    sales7d,
    salesTrend: buildSalesTrend(paidOrders, salesRange, now),
    stockAlerts: lowStock + outOfStock,
    todayOrders: ordersToday.length,
    uniqueCustomers: new Set(orders.map((order) => order.company).filter(Boolean)).size,
    yesterdayOrders: ordersYesterday.length,
  };
}

function buildSalesTrend(orders: DashboardOrder[], rangeDays: number, anchor: Date) {
  const days = Array.from({ length: rangeDays }, (_, index) =>
    addDays(anchor, index - rangeDays + 1)
  );
  const buckets = new Map(
    days.map((day) => [
      dateKey(day),
      {
        day: formatDayLabel(day),
        key: dateKey(day),
        orders: 0,
        pieces: 0,
        sales: 0,
      } satisfies SalesTrendPoint,
    ])
  );

  for (const order of orders) {
    const bucket = buckets.get(dateKey(parseDate(order.createdAt)));

    if (!bucket) {
      continue;
    }

    bucket.orders += 1;
    bucket.pieces += order.items;
    bucket.sales += order.total;
  }

  return Array.from(buckets.values());
}

function buildSkuSales(orders: DashboardOrder[]) {
  const sales = new Map<
    string,
    { name: string; orderIds: Set<string>; quantity: number; revenue: number; sku: string }
  >();

  for (const order of orders) {
    for (const line of order.lines) {
      const key = line.sku.toLowerCase();
      const current =
        sales.get(key) ??
        {
          name: line.name,
          orderIds: new Set<string>(),
          quantity: 0,
          revenue: 0,
          sku: line.sku,
        };

      current.orderIds.add(order.id);
      current.quantity += line.quantity;
      current.revenue += line.lineTotal;
      sales.set(key, current);
    }
  }

  return sales;
}

function buildHotStockAlerts(
  products: DashboardProduct[],
  salesBySku: ReturnType<typeof buildSkuSales>
) {
  return products
    .map((product) => {
      const sales = salesBySku.get(product.sku.toLowerCase());
      const sold7d = sales?.quantity ?? 0;
      const velocity = sold7d / 7;
      const coverageDays = velocity > 0 ? product.availableQty / velocity : null;
      const risk = stockRisk(product, sold7d, coverageDays);
      const score =
        (risk === "urgent" ? 1000 : risk === "watch" ? 500 : 0) +
        sold7d * 12 -
        product.availableQty;

      return {
        alert: {
          availableQty: product.availableQty,
          coverageDays,
          galleryImagePaths: product.galleryImagePaths,
          galleryImageUrls: product.galleryImageUrls,
          imageAlt: product.imageAlt,
          imagePath: product.imagePath,
          imageUrl: product.imageUrl,
          name: product.name,
          risk,
          sku: product.sku,
          sold7d,
          stock: product.stock,
        },
        score,
      };
    })
    .filter(({ alert }) => alert.risk !== "ok")
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ alert }) => alert);
}

function buildHotSkuRows(
  salesBySku: ReturnType<typeof buildSkuSales>,
  productBySku: Map<string, DashboardProduct>
) {
  return Array.from(salesBySku.values())
    .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, 5)
    .map((item) => {
      const product = productBySku.get(item.sku.toLowerCase());

      return {
        availableQty: product?.availableQty ?? null,
        name: product?.name ?? item.name,
        quantity: item.quantity,
        revenue: item.revenue,
        sku: item.sku,
      };
    });
}

function normalizeDashboardOrder(row: unknown): DashboardOrder | null {
  if (!isRecord(row)) {
    return null;
  }

  const customer = isRecord(row.customer) ? row.customer : null;
  const totals = isRecord(row.totals) ? row.totals : null;
  const id = readString(readRecordValue(row, ["id", "number", "orderNo", "order_no"]));

  if (!id) {
    return null;
  }

  const status = normalizeOrderStatus(
    readRecordValue(row, ["status", "orderStatus", "order_status"])
  );
  const lines = (readArrayPayload(row, ["lines", "orderLines", "items"]) ?? [])
    .map(normalizeDashboardOrderLine)
    .filter(isDefined);
  const items =
    readNumber(readRecordValue(row, ["items", "itemCount", "items_count"])) ??
    sumBy(lines, (line) => line.quantity);

  return {
    company:
      readString(row.company) ??
      readString(readRecordValue(customer, ["name", "companyName", "company_name"])) ??
      "Customer",
    createdAt:
      readString(readRecordValue(row, ["createdAt", "created_at", "orderedAt", "date"])) ??
      "",
    id,
    items,
    lines,
    paymentStatus: normalizePaymentStatus(
      readRecordValue(row, ["paymentStatus", "payment_status"]),
      status
    ),
    status,
    total: readMoney(
      readRecordValue(row, ["total", "totalAmount", "total_amount", "grandTotal"]) ??
        readRecordValue(totals, ["total", "gross", "grandTotal", "grand_total"])
    ),
  };
}

function normalizeDashboardOrderLine(row: unknown): DashboardOrderLine | null {
  if (!isRecord(row)) {
    return null;
  }

  const product = isRecord(row.product) ? row.product : null;
  const sku =
    readString(readRecordValue(row, ["sku", "productSku", "product_sku"])) ??
    readString(readRecordValue(product, ["sku"]));
  const quantity =
    readNumber(readRecordValue(row, ["quantity", "qty"])) ??
    readNumber(readRecordValue(row, ["items"])) ??
    0;

  if (!sku || quantity <= 0) {
    return null;
  }

  const lineTotal = readMoney(readRecordValue(row, ["lineTotal", "line_total", "total"]));
  const unitPrice = readMoney(readRecordValue(row, ["unitPrice", "unit_price", "price"]));

  return {
    lineTotal: lineTotal > 0 ? lineTotal : unitPrice * quantity,
    name:
      readString(readRecordValue(row, ["name", "productName", "product_name"])) ??
      readString(readRecordValue(product, ["name"])) ??
      sku,
    quantity,
    sku,
  };
}

function normalizeDashboardProduct(row: unknown): DashboardProduct | null {
  if (!isRecord(row)) {
    return null;
  }

  const sku = readString(row.sku) ?? readString(row.sku_code);

  if (!sku) {
    return null;
  }

  const stock =
    readNumber(row.stockQty) ??
    readNumber(row.stock_qty) ??
    readNumber(row.stock) ??
    readNumber(row.availableQty) ??
    0;
  const availableQty =
    readNumber(row.availableQty) ??
    readNumber(row.available_qty) ??
    Math.max(0, stock - (readNumber(row.lockedQty) ?? readNumber(row.locked_qty) ?? 0));
  const lockedQty = readNumber(row.lockedQty) ?? readNumber(row.locked_qty) ?? 0;
  const status =
    normalizeStockStatus(row.stockStatus) ??
    normalizeStockStatus(row.stock_status) ??
    stockStatusFromStock(stock);

  return {
    availableQty,
    brand: readString(row.brand) ?? "OEM",
    catalogStatus:
      normalizeCatalogStatus(row.catalogStatus) ??
      normalizeCatalogStatus(row.catalog_status) ??
      normalizeCatalogStatus(row.status) ??
      "draft",
    category: readString(row.category) ?? "Ricambi",
    galleryImagePaths:
      readStringArray(row.galleryImagePaths) ??
      readStringArray(row.gallery_image_paths) ??
      [],
    galleryImageUrls:
      readStringArray(row.galleryImageUrls) ??
      readStringArray(row.gallery_image_urls) ??
      [],
    imageAlt: readString(row.imageAlt) ?? readString(row.image_alt),
    imagePath: readString(row.imagePath) ?? readString(row.image_path),
    imageUrl: readString(row.imageUrl) ?? readString(row.image_url),
    lockedQty,
    name: readString(row.name) ?? sku,
    price: readNumber(row.b2bPrice) ?? readNumber(row.b2b_price) ?? readNumber(row.price) ?? 0,
    sku,
    status,
    stock,
    updatedAt: readString(row.updatedAt) ?? readString(row.updated_at) ?? "",
  };
}

function emptyDashboardSnapshot(): DashboardSnapshot {
  return {
    error: null,
    isLoading: false,
    orderSource: "empty",
    orderTotal: 0,
    orders: [],
    ordersReturned: 0,
    productSource: "empty",
    productTotal: 0,
    products: [],
    productsReturned: 0,
    syncedAt: null,
  };
}

function stockRisk(
  product: DashboardProduct,
  sold7d: number,
  coverageDays: number | null
): RiskLevel {
  if (product.availableQty <= 0 || product.stock <= 0) {
    return "urgent";
  }

  if (coverageDays !== null && coverageDays <= 3) {
    return "urgent";
  }

  if (
    product.status === "Low Stock" ||
    product.availableQty <= 8 ||
    sold7d >= 5 ||
    (coverageDays !== null && coverageDays <= 10)
  ) {
    return "watch";
  }

  return "ok";
}

function isPaidOrder(order: DashboardOrder) {
  return order.paymentStatus === "paid";
}

function isDashboardRange(value: string): value is DashboardRange {
  return dashboardRanges.includes(value as DashboardRange);
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  if (orderStatuses.includes(value as OrderStatus)) {
    return value as OrderStatus;
  }

  if (value === "paid") {
    return "accepted";
  }

  if (value === "delivered") {
    return "completed";
  }

  return "submitted";
}

function normalizePaymentStatus(value: unknown, status: OrderStatus): PaymentStatus {
  if (value === "paid") {
    return "paid";
  }

  if (value === "authorized") {
    return "authorized";
  }

  if (value === "refunded" || value === "failed") {
    return "refunded";
  }

  void status;
  return "unpaid";
}

function normalizeStockStatus(value: unknown): StockStatus | null {
  const status = readString(value);
  return stockStatuses.find((item) => item === status) ?? null;
}

function normalizeCatalogStatus(value: unknown): CatalogStatus | null {
  const status = readString(value);
  return catalogStatuses.find((item) => item === status) ?? null;
}

function stockStatusFromStock(stock: number): StockStatus {
  if (stock <= 0) {
    return "Out of Stock";
  }

  if (stock <= 10) {
    return "Low Stock";
  }

  return "In Stock";
}

function stockStatusLabel(
  status: StockStatus,
  copy: ReturnType<typeof getAdminDictionary>["admin"]["dashboard"]["overview"]
) {
  if (status === "Low Stock") {
    return copy.inventory.lowStock;
  }

  if (status === "Out of Stock") {
    return copy.inventory.outOfStock;
  }

  return copy.inventory.inStock;
}

function readRows(payload: unknown) {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.rows)) {
    return payload.data.rows;
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.orders)) {
    return payload.data.orders;
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.products)) {
    return payload.data.products;
  }

  if (Array.isArray(payload.orders)) {
    return payload.orders;
  }

  if (Array.isArray(payload.products)) {
    return payload.products;
  }

  return [];
}

function readMeta(payload: unknown) {
  return isRecord(payload) && isRecord(payload.meta) ? payload.meta : {};
}

function readArrayPayload(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

function readRecordValue(
  record: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return undefined;
}

function readString(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.map(readString).filter(isDefined);
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value && value.length > 0);
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readMoney(value: unknown) {
  const direct = readNumber(value);

  if (direct !== undefined) {
    return direct;
  }

  if (!isRecord(value)) {
    return 0;
  }

  const amount = readNumber(value.amount);

  if (amount !== undefined) {
    return amount;
  }

  const cents = readNumber(value.cents);

  return cents !== undefined ? cents / 100 : 0;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown dashboard error.";
}

function sourceLabel(text: AdminText, source: string) {
  return adminSourceLabel(text, source, source);
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(Math.round(value));
}

function formatDelta(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? "+100%" : "0%";
  }

  const delta = ((current - previous) / previous) * 100;
  const fractionDigits = Math.abs(delta) >= 10 ? 0 : 1;

  return `${delta >= 0 ? "+" : ""}${delta.toFixed(fractionDigits)}%`;
}

function formatAxisEuro(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "";
  }

  if (Math.abs(amount) >= 1000) {
    return `€${Math.round(amount / 1000)}k`;
  }

  return `€${Math.round(amount)}`;
}

function formatTime(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDayLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildWindow(anchor: Date, days: number) {
  return new Set(
    Array.from({ length: days }, (_, index) => dateKey(addDays(anchor, index - days + 1)))
  );
}

function sumBy<T>(items: T[], readValue: (item: T) => number) {
  return items.reduce((total, item) => total + readValue(item), 0);
}

function metricToneClass(tone: MetricCard["tone"]) {
  switch (tone) {
    case "green":
      return "bg-emerald-50 text-emerald-700";
    case "amber":
      return "bg-amber-50 text-amber-700";
    case "red":
      return "bg-red-50 text-red-700";
    case "violet":
      return "bg-violet-50 text-violet-700";
    case "cyan":
      return "bg-cyan-50 text-cyan-700";
    case "blue":
    default:
      return "bg-blue-50 text-blue-700";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
