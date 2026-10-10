"use client";

import * as React from "react";
import { useAdminMemoryQuery, usePersistentAdminValue } from "./admin-workspace-state";
import {
  AlertTriangle,
  Banknote,
  Calculator,
  Download,
  FileSpreadsheet,
  HandCoins,
  Plus,
  Pencil,
  ReceiptText,
  RefreshCw,
  Scale,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { financeEditableId, financeGross, financeLocalDateTimeToIso, isFinanceDate, localFinanceDate, localFinanceDateTime, parseFinanceMoney } from "@/lib/admin-finance-input.mjs";
import { useI18n } from "./i18n-provider";

type FinanceConfidence = "exact" | "estimated" | "unmatched";

type FinanceSummary = {
  accountsPayable: number;
  cogsNet: number;
  currency: string;
  expenseNet: number;
  grossMarginRate: number;
  grossProfit: number;
  inventoryCostValue: number;
  operatingProfit: number;
  pendingReceivables: number;
  purchaseNet: number;
  salesNet: number;
  supplierPaymentsNet: number;
  vatAmbiguousPurchaseNet: number;
  walletAppliedNet: number;
  confidence: Record<FinanceConfidence, number>;
};

type FinanceLedgerRow = {
  id: string;
  type: "sale" | "receivable" | "purchase" | "cogs" | "expense" | "supplier_payment";
  date: string;
  title: string;
  amountNet: number;
  currency: string;
  orderNo: string | null;
  skuCode: string | null;
  batchId: string | null;
  batchCode: string | null;
  supplierName: string | null;
  category: string | null;
  status: string | null;
  confidence: FinanceConfidence | null;
};

type FinanceAllocation = {
  id: string;
  orderNo: string | null;
  skuCode: string;
  productName: string | null;
  batchCode: string | null;
  supplierName: string | null;
  quantity: number;
  unitCostNet: number;
  totalCostNet: number;
  currency: string;
  status: string;
  confidence: FinanceConfidence;
  source: string;
  recognizedAt: string | null;
  createdAt: string;
};

type ApiListResponse<T> = {
  data: T[];
  meta?: {
    total?: number;
    returned?: number;
    limit?: number;
    offset?: number;
    summary?: FinanceSummary;
  };
};

type ApiItemResponse<T> = {
  data: T;
};

type FinanceFilters = {
  category: string;
  confidence: string;
  dateFrom: string;
  dateMode: string;
  dateTo: string;
  q: string;
  supplier: string;
};

const expenseCategories = [
  "rent",
  "salary",
  "shipping",
  "platform_fee",
  "utilities",
  "tax",
  "supplier_fee",
  "bank_fee",
  "other",
] as const;

const emptySummary: FinanceSummary = {
  accountsPayable: 0,
  cogsNet: 0,
  confidence: { exact: 0, estimated: 0, unmatched: 0 },
  currency: "EUR",
  expenseNet: 0,
  grossMarginRate: 0,
  grossProfit: 0,
  inventoryCostValue: 0,
  operatingProfit: 0,
  pendingReceivables: 0,
  purchaseNet: 0,
  salesNet: 0,
  supplierPaymentsNet: 0,
  vatAmbiguousPurchaseNet: 0,
  walletAppliedNet: 0,
};

export function AdminFinancePanel(props: { permissions: string[]; currentUserId?: string }) {
  return <AdminFinancePanelContent key={props.currentUserId ?? "finance-user"} {...props} />;
}

function AdminFinancePanelContent({ permissions, currentUserId }: { permissions: string[]; currentUserId?: string }) {
  const { locale } = useI18n();
  const copy = React.useMemo(() => financeCopy(locale), [locale]);
  const canManage = permissions.includes("finance.manage");
  const canExport = permissions.includes("finance.export") && (permissions.includes("finance.read") || canManage);
  const [filters, setFilters] = useAdminMemoryQuery<FinanceFilters>("finance.filters", () => ({
    category: "all", confidence: "all", dateFrom: dateDaysAgo(30), dateMode: "created", dateTo: todayDate(), q: "", supplier: "",
  }));
  const [tab, setTab] = usePersistentAdminValue("finance.tab", "overview");
  const [ledgerPage, setLedgerPage] = usePersistentAdminValue("finance.ledgerPage", 0);
  const [cogsPage, setCogsPage] = usePersistentAdminValue("finance.cogsPage", 0);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [savedNotice, setSavedNotice] = React.useState("");
  const updateFilters: React.Dispatch<React.SetStateAction<FinanceFilters>> = (update) => {
    setFilters(update); setLedgerPage(0); setCogsPage(0);
  };
  const ledgerView = tab === "purchases" || tab === "expenses" ? tab : "margin";
  const baseParams = buildFinanceParams(filters);
  const ledgerParams = new URLSearchParams(baseParams);
  ledgerParams.set("ledgerView", ledgerView); ledgerParams.set("limit", "50"); ledgerParams.set("offset", String(ledgerPage * 50));
  const cogsParams = new URLSearchParams(baseParams);
  cogsParams.set("limit", "50"); cogsParams.set("offset", String(cogsPage * 50));
  const summaryResource = useFinanceResource<ApiItemResponse<FinanceSummary>>(`/api/admin/finance/summary?${baseParams}`, reloadKey, copy.loadError);
  const ledgerResource = useFinanceResource<ApiListResponse<FinanceLedgerRow>>(`/api/admin/finance/ledger?${ledgerParams}`, reloadKey, copy.loadError);
  const cogsResource = useFinanceResource<ApiListResponse<FinanceAllocation>>(`/api/admin/finance/cogs?${cogsParams}`, reloadKey, copy.loadError);
  const summary = summaryResource.data?.data ?? emptySummary;
  const ledgerRows = ledgerResource.data?.data ?? [];
  const allocations = cogsResource.data?.data ?? [];
  const loading = { summary: summaryResource.loading, ledger: ledgerResource.loading, cogs: cogsResource.loading };
  const errors = { summary: summaryResource.error, ledger: ledgerResource.error, cogs: cogsResource.error };
  const isLoading = loading.summary || loading.ledger || loading.cogs;
  const onSaved = () => { setSavedNotice(copy.saved); setReloadKey((value) => value + 1); };
  const retry = () => setReloadKey((value) => value + 1);
  const exportCsvHref = `/api/admin/finance/export?${buildFinanceParams(filters, "csv")}`;
  const exportXlsxHref = `/api/admin/finance/export?${buildFinanceParams(filters, "xlsx")}`;
  const chartData = [
    { label: copy.salesNet, value: summary.salesNet }, { label: "COGS", value: summary.cogsNet },
    { label: copy.grossProfit, value: summary.grossProfit }, { label: copy.expenses, value: summary.expenseNet },
    { label: copy.operatingProfit, value: summary.operatingProfit },
  ];
  const ledgerTableProps = { copy, isLoading: loading.ledger, error: errors.ledger, stale: ledgerResource.stale, onRetry: retry,
    meta: ledgerResource.data?.meta, page: ledgerPage, setPage: setLedgerPage, canManage, onSaved, currentUserId };

  return (
    <section className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-black text-slate-950">{copy.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
              {copy.refresh}
            </Button>
            {canManage ? <React.Fragment key={currentUserId ?? "finance-user"}>
              <FinanceEntryDialog type="expense" copy={copy} onSaved={onSaved} />
              <FinanceEntryDialog type="supplier_payment" copy={copy} onSaved={onSaved} />
            </React.Fragment> : <p className="self-center text-xs text-slate-500">{copy.readOnly}</p>}
          </div>
        </div>
        <FinanceFiltersBar filters={filters} setFilters={updateFilters} copy={copy} />
      </div>

      {savedNotice ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{savedNotice}</div> : null}
      <Tabs value={tab} onValueChange={(value) => { setTab(value); setLedgerPage(0); }} className="min-w-0">
        <TabsList className="grid h-auto group-data-horizontal/tabs:h-auto w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 sm:grid-cols-5">
          {(["overview", "margin", "purchases", "expenses", "export"] as const).map((value) => <TabsTrigger key={value} value={value} className="h-auto min-h-10 whitespace-normal break-words px-2 py-2 text-center leading-tight">{copy.tabs[value]}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="overview" className="mt-3 min-w-0">
          <FinanceReadNotice copy={copy} error={errors.summary} stale={summaryResource.stale} loading={loading.summary} onRetry={retry} />
          {!summaryResource.data ? (
            <div role="status" aria-busy={loading.summary} className="rounded-lg border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500">
              {loading.summary ? copy.loading : errors.summary || copy.empty}
            </div>
          ) : <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={TrendingUp} label={copy.salesNet} value={formatMoney(summary.salesNet, locale)} />
            <MetricCard icon={Scale} label="COGS" value={formatMoney(summary.cogsNet, locale)} />
            <MetricCard icon={Calculator} label={copy.grossProfit} value={formatMoney(summary.grossProfit, locale)} hint={`${summary.grossMarginRate.toFixed(1)}%`} />
            <MetricCard icon={Banknote} label={copy.operatingProfit} value={formatMoney(summary.operatingProfit, locale)} />
            <MetricCard icon={ReceiptText} label={copy.purchaseNet} value={formatMoney(summary.purchaseNet, locale)} />
            <MetricCard icon={HandCoins} label={copy.inventoryCost} value={formatMoney(summary.inventoryCostValue, locale)} />
            <MetricCard icon={AlertTriangle} label={copy.receivables} value={formatMoney(summary.pendingReceivables, locale)} />
            <MetricCard icon={FileSpreadsheet} label={copy.payables} value={formatMoney(summary.accountsPayable, locale)} />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
            <Card className="rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black">{copy.netChart}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={56} />
                      <ChartTooltip formatter={(value) => formatMoney(Number(value), locale)} />
                      <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black">{copy.costConfidence}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(["exact", "estimated", "unmatched"] as const).map((confidence) => (
                  <div key={confidence} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                    <ConfidenceBadge confidence={confidence} />
                    <span className="font-mono text-lg font-black">{summary.confidence[confidence] ?? 0}</span>
                  </div>
                ))}
                {summary.vatAmbiguousPurchaseNet > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    {copy.vatReview}: {formatMoney(summary.vatAmbiguousPurchaseNet, locale)}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
          </>}
        </TabsContent>

        <TabsContent value="margin" className="mt-3 min-w-0">
          <FinanceTable
            {...ledgerTableProps}
            rows={ledgerRows}
          />
          <CogsTable allocations={allocations} copy={copy} isLoading={loading.cogs} locale={locale} error={errors.cogs} stale={cogsResource.stale} onRetry={retry} meta={cogsResource.data?.meta} page={cogsPage} setPage={setCogsPage} />
        </TabsContent>

        <TabsContent value="purchases" className="mt-3 min-w-0">
          <FinanceTable
            {...ledgerTableProps}
            rows={ledgerRows}
          />
        </TabsContent>

        <TabsContent value="expenses" className="mt-3 min-w-0">
          <FinanceTable
            {...ledgerTableProps}
            rows={ledgerRows}
          />
        </TabsContent>

        <TabsContent value="export" className="mt-3 min-w-0">
          <Card className="rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black">{copy.exportTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {canExport ? <><Button asChild>
                <a href={exportCsvHref}>
                  <Download className="size-4" />
                  CSV
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={exportXlsxHref}>
                  <FileSpreadsheet className="size-4" />
                  XLSX
                </a>
              </Button></> : <p className="text-sm text-slate-500">{copy.exportDenied}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function FinanceFiltersBar({
  copy,
  filters,
  setFilters,
}: {
  copy: FinanceCopy;
  filters: FinanceFilters;
  setFilters: React.Dispatch<React.SetStateAction<FinanceFilters>>;
}) {
  const id = React.useId();
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[140px_140px_150px_150px_minmax(180px,1fr)_minmax(160px,1fr)_150px]">
      <div className="grid gap-1"><Label htmlFor={`${id}-dateMode`}>{copy.dateBasis}</Label><Select value={filters.dateMode} onValueChange={(value) => setFilters((current) => ({ ...current, dateMode: value }))}>
        <SelectTrigger id={`${id}-dateMode`} className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created">{copy.dateModes.created}</SelectItem>
          <SelectItem value="paid">{copy.dateModes.paid}</SelectItem>
          <SelectItem value="received">{copy.dateModes.received}</SelectItem>
          <SelectItem value="invoice">{copy.dateModes.invoice}</SelectItem>
          <SelectItem value="recognized">{copy.dateModes.recognized}</SelectItem>
        </SelectContent>
      </Select></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-confidence`}>{copy.table.confidence}</Label><Select value={filters.confidence} onValueChange={(value) => setFilters((current) => ({ ...current, confidence: value }))}>
        <SelectTrigger id={`${id}-confidence`} className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{copy.allConfidence}</SelectItem>
          <SelectItem value="exact">exact</SelectItem>
          <SelectItem value="estimated">estimated</SelectItem>
          <SelectItem value="unmatched">unmatched</SelectItem>
        </SelectContent>
      </Select></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-from`}>{copy.dateFrom}</Label><Input id={`${id}-from`} type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-to`}>{copy.dateTo}</Label><Input id={`${id}-to`} type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-q`}>{copy.searchPlaceholder}</Label><Input id={`${id}-q`} value={filters.q} placeholder={copy.searchPlaceholder} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} /></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-supplier`}>{copy.supplierPlaceholder}</Label><Input id={`${id}-supplier`} value={filters.supplier} placeholder={copy.supplierPlaceholder} onChange={(event) => setFilters((current) => ({ ...current, supplier: event.target.value }))} /></div>
      <div className="grid gap-1"><Label htmlFor={`${id}-category`}>{copy.expenseCategory}</Label><Select value={filters.category} onValueChange={(value) => setFilters((current) => ({ ...current, category: value }))}>
        <SelectTrigger id={`${id}-category`} className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{copy.allCategories}</SelectItem>
          <SelectItem value="sales">{copy.salesNet}</SelectItem>
          <SelectItem value="purchase">{copy.purchaseNet}</SelectItem>
          <SelectItem value="cogs">cogs</SelectItem>
          <SelectItem value="supplier_payment">{copy.addPayment}</SelectItem>
          {expenseCategories.map((category) => (
            <SelectItem key={category} value={category}>
              {expenseCategoryLabel(category, copy.locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select></div>
    </div>
  );
}

function MetricCard({
  hint,
  icon: Icon,
  label,
  value,
}: {
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
      <CardContent className="flex min-h-[112px] items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-500">{label}</div>
          <div className="mt-2 truncate font-mono text-2xl font-black text-slate-950">{value}</div>
          {hint ? <div className="mt-1 text-xs font-semibold text-emerald-600">{hint}</div> : null}
        </div>
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceTable({
  copy,
  isLoading,
  rows, error, stale, onRetry, meta, page, setPage, canManage, onSaved, currentUserId,
}: {
  copy: FinanceCopy; isLoading: boolean; rows: FinanceLedgerRow[]; error: string; stale: boolean; onRetry: () => void;
  meta?: ApiListResponse<FinanceLedgerRow>["meta"]; page: number; setPage: React.Dispatch<React.SetStateAction<number>>;
  canManage: boolean; onSaved: () => void; currentUserId?: string;
}) {
  const { locale } = useI18n();

  return (
    <Card className="rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
      <CardContent className="p-0">
        <FinanceReadNotice copy={copy} error={error} stale={stale} loading={isLoading} onRetry={onRetry} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.table.date}</TableHead>
                <TableHead>{copy.table.type}</TableHead>
                <TableHead>{copy.table.title}</TableHead>
                <TableHead>{copy.table.ref}</TableHead>
                <TableHead>{copy.table.supplier}</TableHead>
                <TableHead className="text-right">{copy.table.amount}</TableHead>
                <TableHead>{copy.table.confidence}</TableHead>
                {canManage ? <TableHead>{copy.edit}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 8 : 7} className="h-28 text-center text-sm text-slate-500">
                    {copy.loading}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 8 : 7} className="h-28 text-center text-sm text-slate-500">
                    {error ? copy.loadError : copy.empty}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{formatDate(row.date)}</TableCell>
                    <TableCell><TypeBadge type={row.type} /></TableCell>
                    <TableCell className="min-w-[220px]">
                      <div className="font-semibold text-slate-900">{row.title}</div>
                      <div className="text-xs text-slate-500">{row.category ? expenseCategoryLabel(row.category, locale) : row.status ?? ""}</div>
                    </TableCell>
                    <TableCell className="min-w-[160px] text-xs text-slate-600">
                      {[row.orderNo, row.skuCode, row.batchCode].filter(Boolean).join(" / ")}
                    </TableCell>
                    <TableCell className="min-w-[150px] text-xs text-slate-600">{row.supplierName ?? "--"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono font-black">
                      {formatFinanceMoney(row.amountNet, locale, row.currency)}
                    </TableCell>
                    <TableCell>{row.confidence ? <ConfidenceBadge confidence={row.confidence} /> : "--"}</TableCell>
                    {canManage ? <TableCell>{financeEditableId(row.type, row.id) ? <FinanceEntryDialog key={`${currentUserId}:${row.id}`} type={row.type as "expense" | "supplier_payment"} row={row} copy={copy} onSaved={onSaved} /> : "--"}</TableCell> : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <FinancePagination copy={copy} meta={meta} page={page} setPage={setPage} loading={isLoading || stale} />
      </CardContent>
    </Card>
  );
}

function CogsTable({
  allocations,
  copy,
  isLoading,
  locale, error, stale, onRetry, meta, page, setPage,
}: {
  allocations: FinanceAllocation[]; copy: FinanceCopy; isLoading: boolean; locale: Parameters<typeof formatMoney>[1];
  error: string; stale: boolean; onRetry: () => void; meta?: ApiListResponse<FinanceAllocation>["meta"];
  page: number; setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <Card className="mt-3 rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black">{copy.cogsDetail}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <FinanceReadNotice copy={copy} error={error} stale={stale} loading={isLoading} onRetry={onRetry} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.table.ref}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>{copy.table.batch}</TableHead>
                <TableHead>{copy.table.qty}</TableHead>
                <TableHead className="text-right">{copy.table.unitCost}</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead>{copy.table.confidence}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && allocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                    {copy.loading}
                  </TableCell>
                </TableRow>
              ) : allocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                    {error ? copy.loadError : copy.empty}
                  </TableCell>
                </TableRow>
              ) : (
                allocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell className="whitespace-nowrap text-xs">{allocation.orderNo ?? "--"}</TableCell>
                    <TableCell className="min-w-[220px]">
                      <div className="font-mono text-xs font-bold">{allocation.skuCode}</div>
                      <div className="truncate text-xs text-slate-500">{allocation.productName ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-xs">{allocation.batchCode ?? "--"}</TableCell>
                    <TableCell className="font-mono">{allocation.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{formatFinanceMoney(allocation.unitCostNet, locale, allocation.currency)}</TableCell>
                    <TableCell className="text-right font-mono font-black">{formatFinanceMoney(allocation.totalCostNet, locale, allocation.currency)}</TableCell>
                    <TableCell><ConfidenceBadge confidence={allocation.confidence} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <FinancePagination copy={copy} meta={meta} page={page} setPage={setPage} loading={isLoading || stale} />
      </CardContent>
    </Card>
  );
}

type EditableFinanceEntry = {
  id: string; currency: string; amountNet: number; vatAmount: number; amountGross: number; status: "pending" | "paid" | "cancelled";
  category?: string; description?: string; occurredAt?: string; paidAt?: string | null; notes?: string | null; note?: string | null;
  batchId?: string | null; batchCode?: string | null; supplierName?: string | null; version: string;
};
type FinanceBatchOption = {
  id: string; batchCode: string; supplierName: string | null; currency: string; paidNet: number | null;
  outstandingNet: number | null; latestPaidAt: string | null; costBasis: "confirmed_net" | "estimated" | "unknown";
};
type FinanceEntryForm = {
  amountNet: string; vatAmount: string; category: string; description: string; occurredAt: string;
  paidAt: string; note: string; batchId: string; status: "pending" | "paid" | "cancelled"; correctionReason: string;
};
function emptyEntryForm(now = new Date()): FinanceEntryForm {
  return { amountNet: "", vatAmount: "0", category: "other", description: "", occurredAt: todayDate(),
    paidAt: localFinanceDateTime(now), note: "", batchId: "", status: "paid", correctionReason: "" };
}

function FinanceEntryDialog({ type, copy, onSaved, row }: {
  type: "expense" | "supplier_payment"; copy: FinanceCopy; onSaved: () => void; row?: FinanceLedgerRow;
}) {
  const { locale } = useI18n();
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [uncertain, setUncertain] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [initialPaidAt, setInitialPaidAt] = React.useState(() => new Date());
  const [form, setForm] = React.useState<FinanceEntryForm>(() => emptyEntryForm(initialPaidAt));
  const [loadedForm, setLoadedForm] = React.useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== loadedForm;
  const [original, setOriginal] = React.useState<EditableFinanceEntry | null>(null);
  const [entryLoading, setEntryLoading] = React.useState(false);
  const [detailReload, setDetailReload] = React.useState(0);
  const [batchSearch, setBatchSearch] = React.useState({ q: "", supplier: "", page: 0 });
  const [batchData, setBatchData] = React.useState<ApiListResponse<FinanceBatchOption> | null>(null);
  const [batchLoading, setBatchLoading] = React.useState(false);
  const [batchError, setBatchError] = React.useState("");
  const [selectedBatch, setSelectedBatch] = React.useState<FinanceBatchOption | null>(null);
  const isExpense = type === "expense";
  const editing = Boolean(row);
  const currency = original?.currency ?? "EUR";
  const recordId = row ? financeEditableId(type, row.id) : null;
  const net = parseFinanceMoney(form.amountNet);
  const vat = parseFinanceMoney(form.vatAmount);
  const previewGross = net.ok && vat.ok ? financeGross(net.value, vat.value) : null;
  const title = editing ? copy.edit : isExpense ? copy.addExpense : copy.addPayment;
  const updateField = <K extends keyof FinanceEntryForm>(key: K, value: FinanceEntryForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  };
  const fieldProps = (key: string) => ({ id: `${id}-${key}`, "aria-invalid": Boolean(fieldErrors[key]), "aria-describedby": fieldErrors[key] ? `${id}-${key}-error` : undefined });
  const detailLoadError = React.useEffectEvent(() => copy.loadError);
  const fieldError = (key: string) => fieldErrors[key] ? <p id={`${id}-${key}-error`} className="text-xs text-red-700">{fieldErrors[key]}</p> : null;

  React.useEffect(() => {
    if (!open || !recordId) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setEntryLoading(true); setOriginal(null); setError(""); } });
    void (async () => {
      try {
        const payload = await fetchFinanceJson<ApiItemResponse<EditableFinanceEntry>>(`/api/admin/finance/entries/${type}/${recordId}`, detailLoadError(), controller.signal);
        if (!controller.signal.aborted) {
          const entry = payload.data;
          setOriginal(entry);
          const loaded: FinanceEntryForm = { amountNet: entry.amountNet.toFixed(2), vatAmount: entry.vatAmount.toFixed(2), category: entry.category ?? "other",
            description: entry.description ?? "", occurredAt: entry.occurredAt ?? todayDate(),
            paidAt: entry.paidAt ? localFinanceDateTime(new Date(entry.paidAt)) : "", note: entry.notes ?? entry.note ?? "",
            batchId: entry.batchId ?? "", status: entry.status, correctionReason: "" };
          setForm(loaded); setLoadedForm(JSON.stringify(loaded));
        }
      } catch (failure) { if (!controller.signal.aborted) setError(financeErrorMessage(failure, detailLoadError())); }
      finally { if (!controller.signal.aborted) setEntryLoading(false); }
    })();
    return () => controller.abort();
  }, [detailReload, open, recordId, type]);

  React.useEffect(() => {
    if (!open || isExpense || editing) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "20", offset: String(batchSearch.page * 20) });
    if (batchSearch.q.trim()) params.set("q", batchSearch.q.trim());
    if (batchSearch.supplier.trim()) params.set("supplier", batchSearch.supplier.trim());
    queueMicrotask(() => { if (!controller.signal.aborted) { setBatchLoading(true); setBatchError(""); } });
    const timer = window.setTimeout(() => {
      void fetchFinanceJson<ApiListResponse<FinanceBatchOption>>(`/api/admin/finance/supplier-batch-options?${params}`, copy.loadError, controller.signal)
        .then((payload) => { if (!controller.signal.aborted) setBatchData(payload); })
        .catch((failure) => { if (!controller.signal.aborted) setBatchError(financeErrorMessage(failure, copy.loadError)); })
        .finally(() => { if (!controller.signal.aborted) setBatchLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [batchSearch, copy.loadError, detailReload, editing, isExpense, open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || uncertain) return;
    const issues: Record<string, string> = {};
    if (!net.ok) issues.amountNet = copy.invalidMoney;
    if (!vat.ok) issues.vatAmount = copy.invalidMoney;
    if (isExpense && !form.description.trim()) issues.description = copy.required;
    if (isExpense && !isFinanceDate(form.occurredAt)) issues.occurredAt = copy.invalidDate;
    if (!isExpense && !form.batchId && !editing) issues.batchId = copy.required;
    if (!isExpense && form.status === "paid" && !form.paidAt) issues.paidAt = copy.required;
    const paidAt = form.paidAt ? financeLocalDateTimeToIso(form.paidAt) : null;
    if (!isExpense && form.paidAt && !paidAt) issues.paidAt = copy.invalidDate;
    if (editing && !form.correctionReason.trim()) issues.correctionReason = copy.required;
    if (editing && !original) issues.correctionReason = copy.loadError;
    if (Object.keys(issues).length || !net.ok || !vat.ok) { setFieldErrors(issues); return; }
    const body = isExpense ? {
      amountNet: net.value, vatAmount: vat.value, category: form.category, description: form.description.trim(),
      occurredAt: form.occurredAt, status: form.status, notes: form.note.trim() || null,
    } : {
      amountNet: net.value, vatAmount: vat.value, amountGross: financeGross(net.value, vat.value),
      ...(!editing ? { batchId: form.batchId } : {}), paidAt: original?.paidAt && form.paidAt === localFinanceDateTime(new Date(original.paidAt)) ? original.paidAt : !editing && form.paidAt === localFinanceDateTime(initialPaidAt) ? initialPaidAt.toISOString() : paidAt, note: form.note.trim() || null, status: form.status,
    };
    const editPayload = editing ? { correctionReason: form.correctionReason.trim(), expectedUpdatedAt: original?.version } : {};
    setError(""); setFieldErrors({}); setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/finance/${isExpense ? "expenses" : "supplier-payments"}${editing ? `/${recordId}` : ""}`, {
        body: JSON.stringify({ ...body, ...editPayload }), headers: { "Content-Type": "application/json" }, method: editing ? "PATCH" : "POST",
      });
      if (!response.ok) {
        const failure = await financeResponseError(response, copy.saveError);
        setFieldErrors(Object.fromEntries(Object.entries(failure.fields).map(([field, message]) => [field,
          ["amountNet", "vatAmount", "amountGross"].includes(field) ? copy.invalidMoney : message]))); throw failure;
      }
      // A successful write is final. Report refresh failures in the panel; never replay it.
      setOpen(false); setOriginal(null); const nextPaidAt = new Date(); setInitialPaidAt(nextPaidAt); setForm(emptyEntryForm(nextPaidAt)); setLoadedForm(JSON.stringify(emptyEntryForm(nextPaidAt))); setSelectedBatch(null); onSaved();
    } catch (failure) {
      if (!(failure instanceof FinanceApiError)) setUncertain(true);
      setError(financeErrorMessage(failure, copy.saveError));
    } finally { setIsSaving(false); }
  }

  React.useEffect(() => { const protect = (event: BeforeUnloadEvent) => { if (open && (dirty || isSaving)) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect); }, [open, dirty, isSaving]);
  const close = (value: boolean) => {
    if (isSaving) return;
    if (!value && dirty) {
      if (!window.confirm(locale.startsWith("zh") ? "放弃未保存记账内容？" : "Scartare i dati contabili non salvati?")) return;
      const reset = emptyEntryForm(new Date()); setForm(reset); setLoadedForm(JSON.stringify(reset)); setUncertain(false); setError("");
    }
    setOpen(value);
  };
  return <Dialog open={open} onOpenChange={close}>
    <DialogTrigger asChild><Button type="button" variant="outline" className="bg-white" size={editing ? "sm" : "default"}>
      {editing ? <Pencil className="size-4" /> : isExpense ? <Plus className="size-4" /> : <HandCoins className="size-4" />}{title}
    </Button></DialogTrigger>
    <DialogContent data-admin-dirty={open && dirty ? "true" : "false"} data-admin-mutating={isSaving ? "true" : "false"} scrollLayout="body" className="sm:max-w-xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{editing ? copy.correctionDescription : copy.dialogDescription}</DialogDescription></DialogHeader>
      <form onSubmit={submit} noValidate className="contents">
        <DialogBody className="space-y-4">
          {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}
            {editing && !original ? <Button variant="outline" type="button" onClick={() => setDetailReload((value) => value + 1)}>{copy.retry}</Button> : null}</div> : null}
          {uncertain ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{copy.uncertain}<Button type="button" variant="outline" className="mt-2 block h-auto whitespace-normal" onClick={() => { setUncertain(false); setError(""); }}>{copy.allowRetryAfterReview}</Button></p> : null}
          {entryLoading ? <p role="status">{copy.loading}</p> : null}
          {original ? <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
            <strong>{copy.original} · {original.id}</strong><p>{original.description ?? original.batchCode ?? copy.addPayment} · {original.occurredAt ?? original.paidAt ?? "--"} · {formatFinanceMoney(original.amountNet, locale, original.currency)} + IVA {formatFinanceMoney(original.vatAmount, locale, original.currency)} = {formatFinanceMoney(original.amountGross, locale, original.currency)} · {original.status}</p>
          </div> : null}
          <fieldset disabled={isSaving || entryLoading || (editing && !original) || uncertain} className="space-y-3 disabled:opacity-70">
            {isExpense ? <>
              <div className="grid gap-2"><Label htmlFor={`${id}-category`}>{copy.expenseCategory}</Label>
                <Select value={form.category} onValueChange={(value) => updateField("category", value)}><SelectTrigger {...fieldProps("category")} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{expenseCategories.map((category) => <SelectItem key={category} value={category}>{expenseCategoryLabel(category, locale)}</SelectItem>)}</SelectContent></Select>{fieldError("category")}</div>
              <div className="grid gap-2"><Label htmlFor={`${id}-description`}>{copy.description}</Label><Input {...fieldProps("description")} maxLength={240} value={form.description} onChange={(event) => updateField("description", event.target.value)} />{fieldError("description")}</div>
            </> : editing ? <p className="text-sm">{copy.batch}: {original?.batchCode ?? row?.batchCode ?? "--"} / {original?.supplierName ?? row?.supplierName ?? "--"}</p> : <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`${id}-batch-search`}>{copy.searchPlaceholder}</Label><Input id={`${id}-batch-search`} value={batchSearch.q} onChange={(event) => setBatchSearch((current) => ({ ...current, q: event.target.value, page: 0 }))} /></div>
                <div className="grid gap-2"><Label htmlFor={`${id}-supplier-search`}>{copy.supplierPlaceholder}</Label><Input id={`${id}-supplier-search`} value={batchSearch.supplier} onChange={(event) => setBatchSearch((current) => ({ ...current, supplier: event.target.value, page: 0 }))} /></div></div>
              <Label htmlFor={`${id}-batchId`}>{copy.batch}</Label>
              <Select value={form.batchId} onValueChange={(value) => { updateField("batchId", value); setSelectedBatch(batchData?.data.find((batch) => batch.id === value) ?? null); }}>
                <SelectTrigger {...fieldProps("batchId")} disabled={batchLoading || Boolean(batchError)} className="w-full"><SelectValue placeholder={selectedBatch ? `${selectedBatch.batchCode} / ${selectedBatch.supplierName}` : copy.batchPlaceholder} /></SelectTrigger>
                <SelectContent>{selectedBatch && !batchData?.data.some((batch) => batch.id === selectedBatch.id) ? <SelectItem value={selectedBatch.id}>{selectedBatch.batchCode} / {selectedBatch.supplierName}</SelectItem> : null}
                  {batchData?.data.map((batch) => <SelectItem key={batch.id} value={batch.id}>{batch.batchCode} / {batch.supplierName}{batch.outstandingNet !== null ? ` / ${formatFinanceMoney(batch.outstandingNet, locale, batch.currency)}` : ""}</SelectItem>)}</SelectContent></Select>
              {fieldError("batchId")}
              {batchLoading ? <p role="status" className="text-xs text-slate-500">{copy.loading}</p> : batchError ? <div role="alert" className="text-sm text-red-700">{batchError}<Button type="button" variant="outline" onClick={() => setDetailReload((value) => value + 1)}>{copy.retry}</Button></div> : batchData?.data.length === 0 ? <p className="text-xs text-slate-500">{copy.empty}</p> : null}
              <FinancePagination copy={copy} meta={batchData?.meta} page={batchSearch.page} setPage={(update) => setBatchSearch((current) => ({ ...current, page: typeof update === "function" ? update(current.page) : update }))} loading={batchLoading || Boolean(batchError)} />
              {selectedBatch ? <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p>{copy.paymentCurrency}: EUR · {copy.batch}: {selectedBatch.currency}</p>
                {copy.payables}: {selectedBatch.outstandingNet === null ? copy.balanceUnknown : formatFinanceMoney(selectedBatch.outstandingNet, locale, selectedBatch.currency)} · {copy.alreadyPaid}: {selectedBatch.paidNet === null ? copy.balanceUnknown : formatFinanceMoney(selectedBatch.paidNet, locale, selectedBatch.currency)}
                <p>{copy.latestPayment}: {selectedBatch.latestPaidAt ? new Date(selectedBatch.latestPaidAt).toLocaleString(locale) : "--"}</p>
                {selectedBatch.costBasis !== "confirmed_net" ? <p className="text-amber-800">{copy.estimatedBalance}</p> : null}
                {selectedBatch.outstandingNet !== null && selectedBatch.currency === currency && net.ok && form.status === "paid" ? <p>{copy.balanceAfter}: {formatMoney(Math.max(0, financeGross(selectedBatch.outstandingNet, -net.value)), locale)}{net.value > selectedBatch.outstandingNet ? ` · ${copy.overpayment}` : ""}</p> : null}
              </div> : null}
            </div>}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2"><Label htmlFor={`${id}-amountNet`}>{copy.amountNet}</Label><Input {...fieldProps("amountNet")} inputMode="decimal" value={form.amountNet} onChange={(event) => updateField("amountNet", event.target.value)} />{fieldError("amountNet")}</div>
              <div className="grid gap-2"><Label htmlFor={`${id}-vatAmount`}>IVA</Label><Input {...fieldProps("vatAmount")} inputMode="decimal" value={form.vatAmount} onChange={(event) => updateField("vatAmount", event.target.value)} />{fieldError("vatAmount")}</div>
              <div className="grid gap-2"><Label htmlFor={`${id}-${isExpense ? "occurredAt" : "paidAt"}`}>{copy.date}</Label><Input {...fieldProps(isExpense ? "occurredAt" : "paidAt")} type={isExpense ? "date" : "datetime-local"} value={isExpense ? form.occurredAt : form.paidAt} onChange={(event) => updateField(isExpense ? "occurredAt" : "paidAt", event.target.value)} />{fieldError(isExpense ? "occurredAt" : "paidAt")}</div>
            </div>
            <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm">{copy.preview}: {net.ok ? formatFinanceMoney(net.value, locale, currency) : "--"} + IVA {vat.ok ? formatFinanceMoney(vat.value, locale, currency) : "--"} = {previewGross !== null ? formatFinanceMoney(previewGross, locale, currency) : "--"}</p>{fieldError("amountGross")}
            {editing ? <div className="grid gap-2"><Label htmlFor={`${id}-status`}>{copy.status}</Label><Select value={form.status} onValueChange={(value) => updateField("status", value as FinanceEntryForm["status"])}><SelectTrigger {...fieldProps("status")} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{(["pending", "paid", "cancelled"] as const).map((value) => <SelectItem key={value} value={value}>{copy.statuses[value]}</SelectItem>)}</SelectContent></Select><p className="text-xs text-slate-500">{isExpense ? copy.expenseStatusMeaning : copy.statusMeaning}</p>{fieldError("status")}</div> : null}
            <div className="grid gap-2"><Label htmlFor={`${id}-note`}>{copy.note}</Label><Textarea {...fieldProps("note")} maxLength={500} value={form.note} onChange={(event) => updateField("note", event.target.value)} />{fieldError("note")}{fieldError("notes")}</div>
            {editing ? <div className="grid gap-2"><Label htmlFor={`${id}-correctionReason`}>{copy.reason}</Label><Textarea {...fieldProps("correctionReason")} maxLength={500} value={form.correctionReason} onChange={(event) => updateField("correctionReason", event.target.value)} />{fieldError("correctionReason")}</div> : null}
          </fieldset>
        </DialogBody>
        <DialogFooter><Button type="submit" disabled={isSaving || entryLoading || (editing && !original) || uncertain}>{isSaving ? copy.saving : copy.save}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

class FinanceApiError extends Error {
  constructor(message: string, readonly fields: Record<string, string> = {}) { super(message); }
}
function financeErrorMessage(failure: unknown, fallback: string) { return failure instanceof Error ? failure.message : fallback; }
async function financeResponseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string; details?: { issues?: { path: string; message: string }[] } } } | null;
  const fields: Record<string, string> = {};
  for (const issue of payload?.error?.details?.issues ?? []) fields[issue.path] = issue.message;
  return new FinanceApiError(payload?.error?.message || fallback, fields);
}
async function fetchFinanceJson<T>(url: string, fallback: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw await financeResponseError(response, fallback);
  const payload = await response.json() as { data?: unknown };
  if (!payload || typeof payload !== "object" || payload.data === undefined || payload.data === null || typeof payload.data !== "object") throw new FinanceApiError(fallback);
  return payload as T;
}
function useFinanceResource<T>(url: string, reloadKey: number, fallback: string) {
  const [state, setState] = React.useState<{ data: T | null; loading: boolean; error: string; loadedUrl: string }>({ data: null, loading: true, error: "", loadedUrl: "" });
  React.useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) setState((current) => ({ ...current, loading: true, error: "" })); });
    void fetchFinanceJson<T>(url, fallback, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ data, loading: false, error: "", loadedUrl: url }); })
      .catch((failure) => { if (!controller.signal.aborted) setState((current) => ({ ...current, loading: false, error: financeErrorMessage(failure, fallback) })); });
    return () => controller.abort();
  }, [fallback, reloadKey, url]);
  return { ...state, stale: Boolean(state.data) && (state.loadedUrl !== url || Boolean(state.error) || state.loading) };
}
function FinanceReadNotice({ copy, error, stale, loading, onRetry }: { copy: FinanceCopy; error: string; stale: boolean; loading: boolean; onRetry: () => void }) {
  if (!error && !stale) return null;
  return <div role={error ? "alert" : "status"} className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
    {error || (loading ? copy.loading : "")} {stale ? copy.stale : ""}{error ? <Button type="button" size="sm" variant="outline" onClick={onRetry}>{copy.retry}</Button> : null}
  </div>;
}
function FinancePagination({ copy, meta, page, setPage, loading }: { copy: FinanceCopy; meta?: ApiListResponse<unknown>["meta"]; page: number; setPage: React.Dispatch<React.SetStateAction<number>>; loading: boolean }) {
  if (!meta) return null;
  const offset = meta.offset ?? 0; const returned = meta.returned ?? 0; const total = meta.total ?? returned; const limit = meta.limit ?? 50;
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs text-slate-600">
    <span>{copy.showing} {returned ? offset + 1 : 0}–{offset + returned} / {total}</span><div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" disabled={loading || page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>{copy.previous}</Button>
      <Button type="button" variant="outline" size="sm" disabled={loading || offset + returned >= total || returned === 0 || offset + limit > 5000} onClick={() => setPage((value) => value + 1)}>{copy.next}</Button>
    </div>{offset + limit > 5000 && offset + returned < total ? <span>{copy.narrowFilters}</span> : null}
  </div>;
}
function formatFinanceMoney(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
function expenseCategoryLabel(category: string, locale: string) {
  const labels: Record<string, [string, string]> = { rent: ["租金", "Affitto"], salary: ["工资", "Stipendi"], shipping: ["运输", "Spedizioni"], platform_fee: ["平台费", "Commissioni piattaforma"], utilities: ["水电", "Utenze"], tax: ["税费", "Imposte"], supplier_fee: ["供应商费用", "Costi fornitore"], bank_fee: ["银行费用", "Commissioni bancarie"], other: ["其他", "Altro"], purchase: ["采购", "Acquisti"], supplier_payment: ["供应商付款", "Pagamento fornitore"] };
  return labels[category]?.[locale.startsWith("it") ? 1 : 0] ?? category;
}

function ConfidenceBadge({ confidence }: { confidence: FinanceConfidence }) {
  const className =
    confidence === "exact"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : confidence === "estimated"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <Badge variant="outline" className={className}>
      {confidence}
    </Badge>
  );
}

function TypeBadge({ type }: { type: FinanceLedgerRow["type"] }) {
  return (
    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
      {type}
    </Badge>
  );
}

type FinanceCopy = ReturnType<typeof financeCopy>;

function financeCopy(locale: string) {
  const isItalian = locale.startsWith("it");

  if (isItalian) {
    return {
      locale, dateFrom: "Dal", dateTo: "Al", dateBasis: "Data di riferimento", saved: "Registrazione salvata. Se l’aggiornamento fallisce, riprova la lettura senza registrare di nuovo.", readOnly: "Solo lettura: manca il permesso di registrazione.", exportDenied: "Manca il permesso di export.",
      edit: "Correggi", retry: "Riprova", previous: "Precedente", next: "Successiva", showing: "Voci", narrowFilters: "Restringi i filtri o esporta per continuare.",
      stale: "Risultati precedenti: non ancora aggiornati ai filtri / alla lettura corrente.", invalidMoney: "Inserisci un importo positivo o zero, con massimo 2 decimali (12,50 o 12.50).", invalidDate: "Inserisci una data/ora locale valida.", required: "Campo obbligatorio.",
      preview: "Netto + IVA = Totale", original: "Registrazione originale", reason: "Motivo della correzione", status: "Stato", statuses: { pending: "In sospeso", paid: "Pagato", cancelled: "Annullato" },
      statusMeaning: "Pagato conta come pagamento; annullato esclude la voce dalla contabilità. La correzione resta nell’audit.", correctionDescription: "Aggiorna questa registrazione e conserva la sua identità e l’audit. Inserisci il motivo; verifica i valori originali e la nuova anteprima.",
      expenseStatusMeaning: "In sospeso / pagato resta un costo; annullato esclude la spesa dal totale. La correzione resta nell’audit.",
      paymentCurrency: "Valuta pagamento", allowRetryAfterReview: "Ho verificato il ledger: nessun duplicato, riabilita invio",
      uncertain: "Esito non confermato. Controlla il ledger aggiornato prima di registrare di nuovo.", balanceUnknown: "Da verificare", estimatedBalance: "Saldo indicativo: base costo / IVA da verificare.", alreadyPaid: "Già pagato (netto)", latestPayment: "Ultimo pagamento", balanceAfter: "Residuo netto dopo il pagamento", overpayment: "L’importo supera il residuo",
      addExpense: "Aggiungi spesa",
      addPayment: "Registra pagamento",
      allCategories: "Tutte le categorie",
      allConfidence: "Tutte le confidence",
      amountNet: "Netto",
      batch: "Batch",
      cogsDetail: "Dettaglio COGS",
      costConfidence: "Confidence costi",
      date: "Data",
      dateModes: {
        created: "Creato",
        invoice: "Fattura",
        paid: "Pagato",
        received: "Ricevuto",
        recognized: "Riconosciuto",
      },
      description: "Descrizione",
      dialogDescription: "Operazione registrata nel ledger e audit admin.",
      empty: "Nessun dato",
      expenseCategory: "Categoria",
      expenses: "Spese",
      exportTitle: "Export",
      grossProfit: "Margine lordo",
      inventoryCost: "Valore costo stock",
      loadError: "Dati finanza non disponibili.",
      loading: "Caricamento...",
      netChart: "Netto operativo",
      batchPlaceholder: "Seleziona batch",
      note: "Nota",
      operatingProfit: "Utile operativo",
      payables: "Debiti fornitori",
      purchaseNet: "Costo acquisti",
      receivables: "Da incassare",
      refresh: "Aggiorna",
      salesNet: "Vendite nette",
      save: "Salva",
      saveError: "Salvataggio non riuscito.",
      saving: "Salvataggio...",
      searchPlaceholder: "Ordine, SKU, batch...",
      subtitle: "Vendite, COGS, acquisti, spese e riconciliazione costi",
      supplierPlaceholder: "Fornitore",
      table: {
        amount: "Importo",
        batch: "Batch",
        confidence: "Confidence",
        date: "Data",
        qty: "Qta",
        ref: "Ref",
        supplier: "Fornitore",
        title: "Voce",
        type: "Tipo",
        unitCost: "Costo unit.",
      },
      tabs: {
        expenses: "Spese",
        export: "Export",
        margin: "Vendite e margine",
        overview: "Panoramica",
        purchases: "Acquisti e debiti",
      },
      title: "Finanza",
      vatReview: "IVA da verificare",
    };
  }

  return {
    locale, dateFrom: "开始日期", dateTo: "结束日期", dateBasis: "日期依据", saved: "记账已保存。若刷新读取失败，请重试读取，无需再次登记。", readOnly: "只读：没有记账权限。", exportDenied: "没有财务导出权限。",
    edit: "更正", retry: "重试读取", previous: "上一页", next: "下一页", showing: "记录", narrowFilters: "请缩小筛选范围或导出后继续查阅。",
    stale: "当前显示此前结果，尚未更新到本次筛选或读取状态。", invalidMoney: "请输入非负金额，最多两位小数（12,50 或 12.50）。", invalidDate: "请输入有效的本地日期/时间。", required: "此字段必填。",
    preview: "净额 + IVA = 总额", original: "原记录", reason: "更正原因", status: "状态", statuses: { pending: "待支付", paid: "已支付", cancelled: "已取消" },
    statusMeaning: "已支付计入付款；已取消不计入核算。更正会保留审计记录。", correctionDescription: "原位更新这条记录并保留记录编号与审计。请填写原因，核对原值与新的金额预览。",
    expenseStatusMeaning: "待支付和已支付费用均计入成本；取消后不计入费用总额。更正保留审计。",
    paymentCurrency: "记账币种", allowRetryAfterReview: "已核对账本无重复记录，恢复提交",
    uncertain: "提交结果尚未确认。请先刷新账本核对，不要重复登记。", balanceUnknown: "待核对", estimatedBalance: "余额为估算，成本或IVA口径尚待核对。", alreadyPaid: "已付净额", latestPayment: "最近付款", balanceAfter: "付款后剩余净额", overpayment: "付款额超过剩余金额",
    addExpense: "新增费用",
    addPayment: "登记供应商付款",
    allCategories: "全部分类",
    allConfidence: "全部可信度",
    amountNet: "净额",
    batch: "批次",
    cogsDetail: "COGS 明细",
    costConfidence: "成本可信度",
    date: "日期",
    dateModes: {
      created: "创建",
      invoice: "发票",
      paid: "付款",
      received: "到货",
      recognized: "确认",
    },
    description: "说明",
    dialogDescription: "操作会写入账本并记录后台审计。",
    empty: "暂无数据",
    expenseCategory: "费用分类",
    expenses: "费用",
    exportTitle: "导出",
    grossProfit: "毛利",
    inventoryCost: "库存成本价值",
    loadError: "财务数据暂时不可用。",
    loading: "加载中...",
    netChart: "经营净额",
    batchPlaceholder: "选择批次",
    note: "备注",
    operatingProfit: "经营利润",
    payables: "应付供应商",
    purchaseNet: "进货净成本",
    receivables: "待收款",
    refresh: "刷新",
    salesNet: "销售净额",
    save: "保存",
    saveError: "保存失败。",
    saving: "保存中...",
    searchPlaceholder: "订单、SKU、批次...",
    subtitle: "销售、COGS、采购、费用与成本核对",
    supplierPlaceholder: "供应商",
    table: {
      amount: "金额",
      batch: "批次",
      confidence: "可信度",
      date: "日期",
      qty: "数量",
      ref: "引用",
      supplier: "供应商",
      title: "项目",
      type: "类型",
      unitCost: "单位成本",
    },
    tabs: {
      expenses: "费用账本",
      export: "导出/核对",
      margin: "销售与毛利",
      overview: "总览",
      purchases: "进货与应付",
    },
    title: "财务",
    vatReview: "IVA 待核对",
  };
}

function buildFinanceParams(filters: FinanceFilters, format?: "csv" | "xlsx") {
  const params = new URLSearchParams();

  params.set("dateMode", filters.dateMode);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.supplier.trim()) params.set("supplier", filters.supplier.trim());
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.confidence !== "all") params.set("confidence", filters.confidence);
  if (format) params.set("format", format);

  return params.toString();
}

function todayDate() {
  return localFinanceDate();
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localFinanceDate(date);
}

function formatDate(value: string) {
  return value ? value.slice(0, 10) : "--";
}
