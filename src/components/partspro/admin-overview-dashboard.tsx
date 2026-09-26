"use client";

import * as React from "react";
import Image from "./optimized-image";
import Link from "next/link";
import dynamic from "next/dynamic";
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
  Sparkles,
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
import { buildOverviewModel, type OverviewModel } from "@/lib/partspro-overview-model";
import { cn } from "@/lib/utils";
import { AdminBusyRegion } from "./admin-feedback";
import { useI18n } from "./i18n-provider";

type AdminOverviewPanelValue =
  | "overview"
  | "orders"
  | "rma"
  | "catalog"
  | "finance"
  | "inventory"
  | "marketplace"
  | "support"
  | "timeline"
  | "accounts"
  | "settings";

type AdminOverviewDashboardProps = {
  onPanelChange?: (panel: AdminOverviewPanelValue) => void;
  visiblePanels?: ReadonlySet<AdminOverviewPanelValue>;
};

type AdminSalesTrendChartProps = {
  data: readonly SalesTrendPoint[];
  salesLabel: string;
};

type AdminInventoryMixChartProps = {
  data: readonly InventoryMixPoint[];
};

type DashboardRange = (typeof dashboardRanges)[number];

type DashboardSnapshot = {
  error: string | null;
  isLoading: boolean;
  model: OverviewModel | null;
  modelRange: DashboardRange | null;
  orderSource: string;
  orderTotal: number;
  ordersReturned: number;
  productSource: string;
  productTotal: number;
  productsReturned: number;
  syncedAt: string | null;
};

type DashboardModel = OverviewModel;
type SalesTrendPoint = DashboardModel["salesTrend"][number];
type InventoryMixPoint = DashboardModel["inventoryMix"][number];
type HotStockAlert = DashboardModel["hotStockAlerts"][number];

type MetricCard = {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "blue" | "green" | "amber" | "red" | "violet" | "cyan";
  value: string;
};

const dashboardRanges = ["7", "30", "90"] as const;
const productImagesBucket = "product-images";
const cardClass =
  "min-w-0 rounded-lg border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.045)]";

const AdminSalesTrendChart = dynamic<AdminSalesTrendChartProps>(
  () =>
    import("./admin-overview-charts").then(
      (module) => module.AdminSalesTrendChart
    ),
  {
    ssr: false,
    loading: () => <ChartPlaceholder />,
  }
);
const AdminInventoryMixChart = dynamic<AdminInventoryMixChartProps>(
  () =>
    import("./admin-overview-charts").then(
      (module) => module.AdminInventoryMixChart
    ),
  {
    ssr: false,
    loading: () => <ChartPlaceholder compact />,
  }
);

export function AdminOverviewDashboard({
  onPanelChange,
  visiblePanels,
}: AdminOverviewDashboardProps) {
  const { locale } = useI18n();
  const text = getAdminDictionary(locale).admin;
  const copy = text.dashboard.overview;
  const [salesRange, setSalesRange] = React.useState<DashboardRange>("7");
  const { refresh, snapshot } = useDashboardSnapshot(salesRange);
  const model = snapshot.modelRange === salesRange && snapshot.model
    ? snapshot.model
    : buildOverviewModel([], [], Number(salesRange) as 7 | 30 | 90, new Date(), "UTC");
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

      {(snapshot.isLoading && !snapshot.syncedAt) || snapshot.modelRange !== salesRange ? (
        <OverviewDashboardSkeleton />
      ) : (
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
      )}
    </div>
  );
}

function OverviewDashboardSkeleton() {
  return (
    <div className="space-y-2.5 sm:space-y-3" aria-hidden="true">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white p-3">
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="mt-4 h-6 w-16 rounded bg-slate-100" />
            <div className="mt-3 h-3 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <section className="grid gap-2.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <div className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white" />
        <div className="h-80 animate-pulse rounded-lg border border-slate-200 bg-white" />
      </section>
      <section className="grid gap-2.5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.85fr)]">
        <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white" />
        <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white" />
        <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white" />
      </section>
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
          <AdminSalesTrendChart
            data={model.salesTrend}
            salesLabel={text.dashboard.charts.sales}
          />
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
            <AdminInventoryMixChart data={model.inventoryMix} />
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
            {!visiblePanels || visiblePanels.has("catalog") ? (
              <Button asChild className="h-8 justify-between rounded-md border-purple-200 bg-purple-50 px-2 text-xs text-purple-900 hover:bg-purple-100" variant="outline">
                <Link href="/admin/remax">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Sparkles className="size-3.5 shrink-0" />
                    <span className="truncate">REMAX preordini</span>
                  </span>
                  <ArrowRight className="size-3 shrink-0 text-purple-500" />
                </Link>
              </Button>
            ) : null}
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

function useDashboardSnapshot(range: DashboardRange) {
  const [reloadIndex, setReloadIndex] = React.useState(0);
  const [snapshot, setSnapshot] = React.useState<DashboardSnapshot>(() => ({
    ...emptyDashboardSnapshot(),
    isLoading: true,
  }));

  React.useEffect(() => {
    const controller = new AbortController();
    void fetchDashboardOverview(controller.signal, range)
      .then((overview) => {
        if (controller.signal.aborted) {
          return;
        }

        setSnapshot((current) => ({
          ...current,
          error: overview.errors.length > 0 ? overview.errors.join(" ") : null,
          isLoading: false,
          orderSource: overview.orderSource,
          orderTotal: overview.orderTotal,
          model: overview.model,
          modelRange: range,
          ordersReturned: overview.ordersReturned,
          productSource: overview.productSource,
          productTotal: overview.productTotal,
          productsReturned: overview.productsReturned,
          syncedAt: new Date().toISOString(),
        }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setSnapshot((current) => ({
          ...current,
          error: readErrorMessage(error),
          isLoading: false,
          model: current.modelRange === range ? current.model : null,
          modelRange: range,
          syncedAt: new Date().toISOString(),
        }));
      });

    return () => {
      controller.abort();
    };
  }, [reloadIndex, range]);

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

async function fetchDashboardOverview(signal: AbortSignal, range: DashboardRange) {
  const params = new URLSearchParams({
    view: "compact",
    range,
    anchor: new Date().toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const response = await fetch(`/api/admin/overview?${params}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`GET /api/admin/overview ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  const meta = readMeta(payload);
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
  if (!isRecord(data.model)) {
    throw new Error("Admin overview compact model is unavailable.");
  }
  return {
    errors: readStringArray(meta.errors) ?? [],
    model: data.model as OverviewModel,
    orderSource: readString(meta.orderSource) ?? "empty",
    orderTotal: readNumber(meta.orderTotal) ?? 0,
    ordersReturned: readNumber(meta.ordersReturned) ?? 0,
    productSource: readString(meta.productSource) ?? "empty",
    productTotal: readNumber(meta.productTotal) ?? 0,
    productsReturned: readNumber(meta.productsReturned) ?? 0,
  };
}

function emptyDashboardSnapshot(): DashboardSnapshot {
  return {
    error: null,
    isLoading: false,
    orderSource: "empty",
    orderTotal: 0,
    model: null,
    modelRange: null,
    ordersReturned: 0,
    productSource: "empty",
    productTotal: 0,
    productsReturned: 0,
    syncedAt: null,
  };
}

function isDashboardRange(value: string): value is DashboardRange {
  return dashboardRanges.includes(value as DashboardRange);
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

function readMeta(payload: unknown) {
  return isRecord(payload) && isRecord(payload.meta) ? payload.meta : {};
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

  return value.map(readString).filter((item): item is string => item !== undefined);
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
