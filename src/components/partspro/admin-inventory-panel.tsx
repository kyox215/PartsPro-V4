"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Clipboard,
  Download,
  PackageX,
  RefreshCw,
  Search,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { cn } from "@/lib/utils";
import { AdminBusyRegion, AdminSkeletonRows } from "./admin-feedback";
import { useI18n } from "./i18n-provider";

type ShortageType = "out_of_stock" | "low_stock";
type ShortageSort = "urgency" | "sold_desc" | "stock_asc" | "last_sold_desc";

type SoldStockShortageRow = {
  sku: string;
  sourceSku: string;
  name: string;
  brand: string | null;
  model: string | null;
  modelSeries: string | null;
  category: string | null;
  qualityGrade: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  soldQty: number;
  orderCount: number;
  lastSoldAt: string | null;
  startingAvailableQty: number;
  availableQty: number;
  actualQty: number;
  lockedQty: number;
  stockQty: number;
  shortageType: ShortageType;
  suggestedRestockQty: number;
};

type SoldStockShortageSummary = {
  outOfStock: number;
  lowStock: number;
  totalSoldQty: number;
  suggestedRestockQty: number;
  total: number;
  windowDays: number;
  lowStockThreshold: number;
};

type SoldStockShortagePayload = {
  data?: unknown;
  meta?: {
    summary?: unknown;
    total?: unknown;
    returned?: unknown;
  };
};

const endpoint = "/api/admin/sold-stock-shortages";
const pageSize = 50;
const defaultSummary: SoldStockShortageSummary = {
  outOfStock: 0,
  lowStock: 0,
  totalSoldQty: 0,
  suggestedRestockQty: 0,
  total: 0,
  windowDays: 30,
  lowStockThreshold: 10,
};

export function AdminInventoryPanel() {
  const { locale } = useI18n();
  const dictionary = getAdminDictionary(locale).admin;
  const text = dictionary.inventoryPanel;
  const [rows, setRows] = React.useState<SoldStockShortageRow[]>([]);
  const [summary, setSummary] =
    React.useState<SoldStockShortageSummary>(defaultSummary);
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [windowDays, setWindowDays] = React.useState("30");
  const [lowStockThreshold, setLowStockThreshold] = React.useState("10");
  const [sort, setSort] = React.useState<ShortageSort>("urgency");
  const [pending, setPending] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedSku, setCopiedSku] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    (signal?: AbortSignal) => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        lowStockThreshold,
        sort,
        windowDays,
      });

      if (query.trim().length >= 2) {
        params.set("q", query.trim());
      }

      setPending(true);
      setError(null);

      void fetch(`${endpoint}?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as unknown;

          if (!response.ok) {
            throw new Error(`${response.status}`);
          }

          return parseSoldStockShortagePayload(payload);
        })
        .then((payload) => {
          setRows(payload.rows);
          setSummary(payload.summary);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === "AbortError") {
            return;
          }

          setRows([]);
          setSummary(defaultSummary);
          setError(text.error);
        })
        .finally(() => {
          if (!signal?.aborted) {
            setPending(false);
          }
        });
    },
    [lowStockThreshold, query, sort, text.error, windowDays]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => refresh(controller.signal), 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [refresh]);

  const submitSearch = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setQuery(queryInput.trim());
    },
    [queryInput]
  );

  const exportCsv = React.useCallback(() => {
    const csv = buildCsv(rows, text);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `partspro-sold-stock-shortages-${windowDays}d.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [rows, text, windowDays]);

  const copySku = React.useCallback(
    async (sku: string) => {
      await navigator.clipboard?.writeText(sku);
      setCopiedSku(sku);
      window.setTimeout(() => setCopiedSku(null), 1400);
    },
    []
  );

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            <Warehouse className="size-3.5" />
            {text.eyebrow}
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-normal text-slate-950">
            {text.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-600">
            {text.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="bg-white"
            onClick={() => refresh()}
          >
            <RefreshCw className={cn("size-4", pending && "animate-spin")} />
            {text.refresh}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="bg-white"
            disabled={rows.length === 0}
            onClick={exportCsv}
          >
            <Download className="size-4" />
            {text.exportCsv}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InventoryMetric
          icon={PackageX}
          label={text.outOfStock}
          tone="red"
          value={summary.outOfStock}
        />
        <InventoryMetric
          icon={AlertTriangle}
          label={text.lowStock}
          tone="amber"
          value={summary.lowStock}
        />
        <InventoryMetric
          icon={TrendingUp}
          label={text.recentSoldQty}
          tone="blue"
          value={summary.totalSoldQty}
        />
        <InventoryMetric
          icon={Boxes}
          label={text.suggestedRestockQty}
          tone="green"
          value={summary.suggestedRestockQty}
        />
      </div>

      <Card className="overflow-hidden rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
        <CardHeader className="border-b bg-white">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle className="text-base font-black text-slate-950">
              {text.tableTitle}
            </CardTitle>
            <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_130px_130px_150px]">
              <form className="relative min-w-0" onSubmit={submitSearch}>
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="bg-white pl-9"
                  value={queryInput}
                  placeholder={text.searchPlaceholder}
                  onChange={(event) => setQueryInput(event.target.value)}
                />
              </form>
              <Select value={windowDays} onValueChange={setWindowDays}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{text.window7}</SelectItem>
                  <SelectItem value="30">{text.window30}</SelectItem>
                  <SelectItem value="90">{text.window90}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={lowStockThreshold} onValueChange={setLowStockThreshold}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">{text.threshold5}</SelectItem>
                  <SelectItem value="10">{text.threshold10}</SelectItem>
                  <SelectItem value="20">{text.threshold20}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sort}
                onValueChange={(value) => setSort(value as ShortageSort)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgency">{text.sortUrgency}</SelectItem>
                  <SelectItem value="sold_desc">{text.sortSold}</SelectItem>
                  <SelectItem value="stock_asc">{text.sortStock}</SelectItem>
                  <SelectItem value="last_sold_desc">{text.sortLastSold}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <AdminBusyRegion
            label={dictionary.common.refreshing}
            pending={pending}
            contentClassName="min-h-[360px]"
          >
            {pending && rows.length === 0 ? (
              <div className="p-4">
                <AdminSkeletonRows rows={6} />
              </div>
            ) : error ? (
              <InventoryEmptyState title={text.errorTitle} description={error} />
            ) : rows.length === 0 ? (
              <InventoryEmptyState
                title={text.emptyTitle}
                description={text.emptyDescription}
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{text.product}</TableHead>
                        <TableHead className="text-center">{text.soldQty}</TableHead>
                        <TableHead className="text-center">{text.stockFlow}</TableHead>
                        <TableHead className="text-center">{text.currentStock}</TableHead>
                        <TableHead className="text-center">{text.suggestedRestock}</TableHead>
                        <TableHead>{text.lastSoldAt}</TableHead>
                        <TableHead className="text-right">{dictionary.common.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.sku}>
                          <TableCell>
                            <InventoryProductCell row={row} />
                          </TableCell>
                          <TableCell className="text-center font-black">
                            {row.soldQty}
                          </TableCell>
                          <TableCell className="text-center">
                            <StockFlow row={row} />
                          </TableCell>
                          <TableCell className="text-center">
                            <ShortageBadge row={row} text={text} />
                          </TableCell>
                          <TableCell className="text-center font-black text-slate-950">
                            {row.suggestedRestockQty}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {formatDate(row.lastSoldAt, locale)}
                          </TableCell>
                          <TableCell className="text-right">
                            <InventoryRowActions
                              copied={copiedSku === row.sku}
                              row={row}
                              text={text}
                              onCopy={copySku}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-3 p-3 lg:hidden">
                  {rows.map((row) => (
                    <div
                      key={row.sku}
                      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <InventoryProductVisual row={row} />
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-sm font-black text-slate-950">
                            {row.name}
                          </div>
                          <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                            {row.sku}
                          </div>
                        </div>
                        <ShortageBadge row={row} text={text} compact />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <MobileMetric label={text.soldQty} value={row.soldQty} />
                        <MobileMetric
                          label={text.stockFlow}
                          value={`${row.startingAvailableQty} -> ${row.availableQty}`}
                        />
                        <MobileMetric
                          label={text.suggestedRestock}
                          value={row.suggestedRestockQty}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-semibold text-slate-500">
                          {formatDate(row.lastSoldAt, locale)}
                        </span>
                        <InventoryRowActions
                          copied={copiedSku === row.sku}
                          row={row}
                          text={text}
                          onCopy={copySku}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </AdminBusyRegion>
        </CardContent>
      </Card>
    </section>
  );
}

function InventoryMetric({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "amber" | "blue" | "green" | "red";
  value: number;
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={cn("inline-flex rounded-lg border p-2", toneClass)}>
        <Icon className="size-4" />
      </div>
      <div className="mt-3 text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-normal text-slate-500">
        {label}
      </div>
    </div>
  );
}

function InventoryProductCell({ row }: { row: SoldStockShortageRow }) {
  return (
    <div className="flex min-w-[280px] items-center gap-3">
      <InventoryProductVisual row={row} />
      <div className="min-w-0">
        <div className="line-clamp-2 font-bold text-slate-950">{row.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
          <span>{row.sku}</span>
          {row.brand ? <span>{row.brand}</span> : null}
          {row.model ? <span>{row.model}</span> : null}
          {row.qualityGrade ? <span>{row.qualityGrade}</span> : null}
        </div>
      </div>
    </div>
  );
}

function InventoryProductVisual({ row }: { row: SoldStockShortageRow }) {
  if (!row.imageUrl) {
    return (
      <div className="grid size-12 shrink-0 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-400">
        <Boxes className="size-5" />
      </div>
    );
  }

  return (
    <Image
      src={row.imageUrl}
      alt={row.imageAlt ?? row.name}
      width={48}
      height={48}
      className="size-12 shrink-0 rounded-md border border-slate-200 object-cover"
    />
  );
}

function StockFlow({ row }: { row: SoldStockShortageRow }) {
  return (
    <div className="inline-flex min-w-[86px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-black text-slate-950">
      <span>{row.startingAvailableQty}</span>
      <span className="text-slate-400">-&gt;</span>
      <span className={row.availableQty <= 0 ? "text-rose-700" : "text-amber-700"}>
        {row.availableQty}
      </span>
    </div>
  );
}

function ShortageBadge({
  compact = false,
  row,
  text,
}: {
  compact?: boolean;
  row: SoldStockShortageRow;
  text: ReturnType<typeof getAdminDictionary>["admin"]["inventoryPanel"];
}) {
  const out = row.shortageType === "out_of_stock";

  return (
    <Badge
      className={cn(
        "max-w-full truncate",
        out
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
        compact && "max-w-[86px]"
      )}
    >
      {out ? text.outOfStock : text.lowStock}
    </Badge>
  );
}

function InventoryRowActions({
  copied,
  onCopy,
  row,
  text,
}: {
  copied: boolean;
  onCopy: (sku: string) => void;
  row: SoldStockShortageRow;
  text: ReturnType<typeof getAdminDictionary>["admin"]["inventoryPanel"];
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="bg-white"
        title={copied ? text.copied : text.copySku}
        onClick={() => onCopy(row.sku)}
      >
        <Clipboard className="size-4" />
      </Button>
      <Button type="button" variant="outline" size="icon-sm" asChild className="bg-white">
        <Link href={`/admin?panel=catalog&sku=${encodeURIComponent(row.sku)}`} title={text.openCatalog}>
          <ArrowUpRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function MobileMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="truncate text-[11px] font-bold uppercase tracking-normal text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-black text-slate-950">{value}</div>
    </div>
  );
}

function InventoryEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="grid min-h-[360px] place-items-center p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid size-12 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <Warehouse className="size-5" />
        </div>
        <h2 className="mt-4 text-base font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
          {description}
        </p>
      </div>
    </div>
  );
}

function parseSoldStockShortagePayload(payload: unknown) {
  const record = isRecord(payload) ? (payload as SoldStockShortagePayload) : {};
  const rows = Array.isArray(record.data)
    ? record.data.map(parseSoldStockShortageRow).filter(isDefined)
    : [];
  const summary = parseSummary(record.meta?.summary);

  return { rows, summary };
}

function parseSoldStockShortageRow(value: unknown): SoldStockShortageRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const sku = readString(value.sku);
  const name = readString(value.name);
  const shortageType = readString(value.shortageType);

  if (
    !sku ||
    !name ||
    (shortageType !== "out_of_stock" && shortageType !== "low_stock")
  ) {
    return null;
  }

  return {
    sku,
    sourceSku: readString(value.sourceSku) ?? sku,
    name,
    brand: readString(value.brand),
    model: readString(value.model),
    modelSeries: readString(value.modelSeries),
    category: readString(value.category),
    qualityGrade: readString(value.qualityGrade),
    imageUrl: readString(value.imageUrl),
    imageAlt: readString(value.imageAlt),
    soldQty: readNumber(value.soldQty),
    orderCount: readNumber(value.orderCount),
    lastSoldAt: readString(value.lastSoldAt),
    startingAvailableQty: readNumber(value.startingAvailableQty),
    availableQty: readNumber(value.availableQty),
    actualQty: readNumber(value.actualQty),
    lockedQty: readNumber(value.lockedQty),
    stockQty: readNumber(value.stockQty),
    shortageType,
    suggestedRestockQty: readNumber(value.suggestedRestockQty),
  };
}

function parseSummary(value: unknown): SoldStockShortageSummary {
  if (!isRecord(value)) {
    return defaultSummary;
  }

  return {
    outOfStock: readNumber(value.outOfStock),
    lowStock: readNumber(value.lowStock),
    totalSoldQty: readNumber(value.totalSoldQty),
    suggestedRestockQty: readNumber(value.suggestedRestockQty),
    total: readNumber(value.total),
    windowDays: readNumber(value.windowDays) || 30,
    lowStockThreshold: readNumber(value.lowStockThreshold) || 10,
  };
}

function buildCsv(
  rows: SoldStockShortageRow[],
  text: ReturnType<typeof getAdminDictionary>["admin"]["inventoryPanel"]
) {
  const headers = [
    text.sku,
    text.product,
    text.soldQty,
    text.startingStock,
    text.currentStock,
    text.suggestedRestock,
    text.lastSoldAt,
  ];
  const body = rows.map((row) => [
    row.sku,
    row.name,
    row.soldQty,
    row.startingAvailableQty,
    row.availableQty,
    row.suggestedRestockQty,
    row.lastSoldAt ?? "",
  ]);

  return [headers, ...body]
    .map((line) => line.map((cell) => csvCell(String(cell))).join(","))
    .join("\n");
}

function csvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
