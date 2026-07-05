"use client";

import * as React from "react";
import {
  AlertTriangle,
  Banknote,
  Calculator,
  Download,
  FileSpreadsheet,
  HandCoins,
  Plus,
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

export function AdminFinancePanel() {
  const { locale } = useI18n();
  const copy = React.useMemo(() => financeCopy(locale), [locale]);
  const [filters, setFilters] = React.useState<FinanceFilters>(() => ({
    category: "all",
    confidence: "all",
    dateFrom: dateDaysAgo(30),
    dateMode: "created",
    dateTo: todayDate(),
    q: "",
    supplier: "",
  }));
  const [summary, setSummary] = React.useState<FinanceSummary>(emptySummary);
  const [ledgerRows, setLedgerRows] = React.useState<FinanceLedgerRow[]>([]);
  const [allocations, setAllocations] = React.useState<FinanceAllocation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = buildFinanceParams(filters);

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsLoading(true);
        setError(null);
      }
    });

    Promise.all([
      fetch(`/api/admin/finance/summary?${params}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }),
      fetch(`/api/admin/finance/ledger?${params}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }),
      fetch(`/api/admin/finance/cogs?${params}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }),
    ])
      .then(async ([summaryResponse, ledgerResponse, cogsResponse]) => {
        if (!summaryResponse.ok || !ledgerResponse.ok || !cogsResponse.ok) {
          throw new Error(copy.loadError);
        }

        const summaryPayload = (await summaryResponse.json()) as ApiItemResponse<FinanceSummary>;
        const ledgerPayload = (await ledgerResponse.json()) as ApiListResponse<FinanceLedgerRow>;
        const cogsPayload = (await cogsResponse.json()) as ApiListResponse<FinanceAllocation>;

        setSummary(summaryPayload.data ?? emptySummary);
        setLedgerRows(Array.isArray(ledgerPayload.data) ? ledgerPayload.data : []);
        setAllocations(Array.isArray(cogsPayload.data) ? cogsPayload.data : []);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : copy.loadError);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [copy.loadError, filters, reloadKey]);

  const exportCsvHref = `/api/admin/finance/export?${buildFinanceParams(filters, "csv")}`;
  const exportXlsxHref = `/api/admin/finance/export?${buildFinanceParams(filters, "xlsx")}`;
  const chartData = [
    { label: copy.salesNet, value: summary.salesNet },
    { label: "COGS", value: summary.cogsNet },
    { label: copy.grossProfit, value: summary.grossProfit },
    { label: copy.expenses, value: summary.expenseNet },
    { label: copy.operatingProfit, value: summary.operatingProfit },
  ];
  const batchOptions = ledgerRows
    .filter((row) => row.type === "purchase" && row.batchId)
    .slice(0, 80);

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
            <ExpenseDialog copy={copy} onSaved={() => setReloadKey((value) => value + 1)} />
            <SupplierPaymentDialog
              batchOptions={batchOptions}
              copy={copy}
              onSaved={() => setReloadKey((value) => value + 1)}
            />
          </div>
        </div>
        <FinanceFiltersBar filters={filters} setFilters={setFilters} copy={copy} />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 shadow-[0_8px_22px_rgba(15,23,42,0.04)] sm:grid-cols-5">
          <TabsTrigger value="overview">{copy.tabs.overview}</TabsTrigger>
          <TabsTrigger value="margin">{copy.tabs.margin}</TabsTrigger>
          <TabsTrigger value="purchases">{copy.tabs.purchases}</TabsTrigger>
          <TabsTrigger value="expenses">{copy.tabs.expenses}</TabsTrigger>
          <TabsTrigger value="export">{copy.tabs.export}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3 min-w-0">
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
        </TabsContent>

        <TabsContent value="margin" className="mt-3 min-w-0">
          <FinanceTable
            copy={copy}
            isLoading={isLoading}
            rows={ledgerRows.filter((row) => row.type === "sale" || row.type === "cogs" || row.type === "receivable")}
          />
          <CogsTable allocations={allocations} copy={copy} isLoading={isLoading} locale={locale} />
        </TabsContent>

        <TabsContent value="purchases" className="mt-3 min-w-0">
          <FinanceTable
            copy={copy}
            isLoading={isLoading}
            rows={ledgerRows.filter((row) => row.type === "purchase" || row.type === "supplier_payment")}
          />
        </TabsContent>

        <TabsContent value="expenses" className="mt-3 min-w-0">
          <FinanceTable
            copy={copy}
            isLoading={isLoading}
            rows={ledgerRows.filter((row) => row.type === "expense")}
          />
        </TabsContent>

        <TabsContent value="export" className="mt-3 min-w-0">
          <Card className="rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black">{copy.exportTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild>
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
              </Button>
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
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[140px_140px_150px_150px_minmax(180px,1fr)_minmax(160px,1fr)_150px]">
      <Select value={filters.dateMode} onValueChange={(value) => setFilters((current) => ({ ...current, dateMode: value }))}>
        <SelectTrigger className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created">{copy.dateModes.created}</SelectItem>
          <SelectItem value="paid">{copy.dateModes.paid}</SelectItem>
          <SelectItem value="received">{copy.dateModes.received}</SelectItem>
          <SelectItem value="invoice">{copy.dateModes.invoice}</SelectItem>
          <SelectItem value="recognized">{copy.dateModes.recognized}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.confidence} onValueChange={(value) => setFilters((current) => ({ ...current, confidence: value }))}>
        <SelectTrigger className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{copy.allConfidence}</SelectItem>
          <SelectItem value="exact">exact</SelectItem>
          <SelectItem value="estimated">estimated</SelectItem>
          <SelectItem value="unmatched">unmatched</SelectItem>
        </SelectContent>
      </Select>
      <Input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
      <Input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
      <Input value={filters.q} placeholder={copy.searchPlaceholder} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} />
      <Input value={filters.supplier} placeholder={copy.supplierPlaceholder} onChange={(event) => setFilters((current) => ({ ...current, supplier: event.target.value }))} />
      <Select value={filters.category} onValueChange={(value) => setFilters((current) => ({ ...current, category: value }))}>
        <SelectTrigger className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{copy.allCategories}</SelectItem>
          <SelectItem value="sales">sales</SelectItem>
          <SelectItem value="purchase">purchase</SelectItem>
          <SelectItem value="cogs">cogs</SelectItem>
          <SelectItem value="supplier_payment">supplier_payment</SelectItem>
          {expenseCategories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  rows,
}: {
  copy: FinanceCopy;
  isLoading: boolean;
  rows: FinanceLedgerRow[];
}) {
  const { locale } = useI18n();

  return (
    <Card className="rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
      <CardContent className="p-0">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-sm text-slate-500">
                    {copy.loading}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-sm text-slate-500">
                    {copy.empty}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{formatDate(row.date)}</TableCell>
                    <TableCell><TypeBadge type={row.type} /></TableCell>
                    <TableCell className="min-w-[220px]">
                      <div className="font-semibold text-slate-900">{row.title}</div>
                      <div className="text-xs text-slate-500">{row.category ?? row.status ?? ""}</div>
                    </TableCell>
                    <TableCell className="min-w-[160px] text-xs text-slate-600">
                      {[row.orderNo, row.skuCode, row.batchCode].filter(Boolean).join(" / ")}
                    </TableCell>
                    <TableCell className="min-w-[150px] text-xs text-slate-600">{row.supplierName ?? "--"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono font-black">
                      {formatMoney(row.amountNet, locale)}
                    </TableCell>
                    <TableCell>{row.confidence ? <ConfidenceBadge confidence={row.confidence} /> : "--"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CogsTable({
  allocations,
  copy,
  isLoading,
  locale,
}: {
  allocations: FinanceAllocation[];
  copy: FinanceCopy;
  isLoading: boolean;
  locale: Parameters<typeof formatMoney>[1];
}) {
  return (
    <Card className="mt-3 rounded-lg border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-black">{copy.cogsDetail}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                    {copy.loading}
                  </TableCell>
                </TableRow>
              ) : allocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                    {copy.empty}
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
                    <TableCell className="text-right font-mono">{formatMoney(allocation.unitCostNet, locale)}</TableCell>
                    <TableCell className="text-right font-mono font-black">{formatMoney(allocation.totalCostNet, locale)}</TableCell>
                    <TableCell><ConfidenceBadge confidence={allocation.confidence} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpenseDialog({ copy, onSaved }: { copy: FinanceCopy; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    amountNet: "",
    category: "other",
    description: "",
    occurredAt: todayDate(),
    vatAmount: "0",
  });

  async function submit() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/finance/expenses", {
        body: JSON.stringify({
          amountNet: Number(form.amountNet),
          category: form.category,
          description: form.description,
          occurredAt: form.occurredAt,
          vatAmount: Number(form.vatAmount),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(copy.saveError);
      }

      setOpen(false);
      setForm({ amountNet: "", category: "other", description: "", occurredAt: todayDate(), vatAmount: "0" });
      onSaved();
    } catch {
      window.alert(copy.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="bg-white">
          <Plus className="size-4" />
          {copy.addExpense}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.addExpense}</DialogTitle>
          <DialogDescription className="sr-only">{copy.dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label>{copy.expenseCategory}</Label>
          <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {expenseCategories.map((category) => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label>{copy.description}</Label>
          <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>{copy.amountNet}</Label>
              <Input inputMode="decimal" value={form.amountNet} onChange={(event) => setForm((current) => ({ ...current, amountNet: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>IVA</Label>
              <Input inputMode="decimal" value={form.vatAmount} onChange={(event) => setForm((current) => ({ ...current, vatAmount: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{copy.date}</Label>
              <Input type="date" value={form.occurredAt} onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSaving || !form.description || !form.amountNet} onClick={submit}>
            {isSaving ? copy.saving : copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierPaymentDialog({
  batchOptions,
  copy,
  onSaved,
}: {
  batchOptions: FinanceLedgerRow[];
  copy: FinanceCopy;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    amountNet: "",
    batchId: "",
    note: "",
    paidAt: new Date().toISOString().slice(0, 16),
    vatAmount: "0",
  });

  async function submit() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/finance/supplier-payments", {
        body: JSON.stringify({
          amountNet: Number(form.amountNet),
          batchId: form.batchId || undefined,
          note: form.note || undefined,
          paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : undefined,
          vatAmount: Number(form.vatAmount),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(copy.saveError);
      }

      setOpen(false);
      setForm({ amountNet: "", batchId: "", note: "", paidAt: new Date().toISOString().slice(0, 16), vatAmount: "0" });
      onSaved();
    } catch {
      window.alert(copy.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="bg-white">
          <HandCoins className="size-4" />
          {copy.addPayment}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.addPayment}</DialogTitle>
          <DialogDescription className="sr-only">{copy.dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label>{copy.batch}</Label>
          <Select value={form.batchId} onValueChange={(value) => setForm((current) => ({ ...current, batchId: value }))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={copy.batchPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {batchOptions.map((row) => (
                <SelectItem key={row.batchId ?? row.id} value={row.batchId as string}>
                  {[row.batchCode, row.supplierName, row.amountNet.toFixed(2)].filter(Boolean).join(" / ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>{copy.amountNet}</Label>
              <Input inputMode="decimal" value={form.amountNet} onChange={(event) => setForm((current) => ({ ...current, amountNet: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>IVA</Label>
              <Input inputMode="decimal" value={form.vatAmount} onChange={(event) => setForm((current) => ({ ...current, vatAmount: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{copy.date}</Label>
              <Input type="datetime-local" value={form.paidAt} onChange={(event) => setForm((current) => ({ ...current, paidAt: event.target.value }))} />
            </div>
          </div>
          <Label>{copy.note}</Label>
          <Textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSaving || !form.amountNet || !form.batchId} onClick={submit}>
            {isSaving ? copy.saving : copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return value ? value.slice(0, 10) : "--";
}
