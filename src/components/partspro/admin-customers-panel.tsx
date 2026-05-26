"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Filter,
  History,
  MapPin,
  PackageCheck,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
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
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatEuro,
  products,
  type CompanyStatus,
  type OrderStatus,
  type PartProduct,
  type RmaStatus,
} from "@/lib/partspro-data";
import {
  calculateTierPrice,
  customerTiers,
  formatTierDiscount,
  getTierRule,
  normalizeCustomerTier,
  type CustomerTier,
} from "@/lib/partspro-pricing";
import { cn } from "@/lib/utils";

type TierFilterValue = "all" | CustomerTier;
type StatusFilterValue = "all" | CompanyStatus;
type CustomerSegment = "needs_review" | "retail" | "wholesale" | "employee";
type CustomerLifecycle = "onboarding" | "active" | "vip" | "at_risk";
type ApiSource = "admin_api" | "supabase" | "empty";
type NoticeTone = "success" | "info" | "warning" | "error";

type CustomerOrder = {
  id: string;
  date: string;
  status: OrderStatus;
  company: string;
  total: number;
  items: number;
  channel: "Web" | "Admin" | "Account";
  margin: number;
  paymentTerms: string;
  topProduct: string;
  topSku: string;
};

type CustomerRma = {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  status: RmaStatus;
  reason: string;
  createdAt: string;
  resolution: string;
};

type CustomerProfile = {
  id: string;
  userId: string;
  accountType: "customer" | "employee";
  assignmentStatus: "needs_review" | "assigned" | "converted_to_employee" | "archived";
  customerType: "retail" | "wholesale";
  roleTemplate: string | null;
  name: string;
  partitaIva: string;
  codiceFiscale: string;
  pec: string;
  codiceDestinatario: string;
  status: CompanyStatus;
  priceList: CustomerTier;
  lifetimeSpendNet: number;
  city: string;
  province: string;
  accountOwner: string;
  contactName: string;
  email: string;
  phone: string;
  creditLimit: number;
  receivables: number;
  overdue: number;
  avgPaymentDays: number;
  lifecycle: CustomerLifecycle;
  lastContact: string;
  primarySku: string;
  notes: string;
  orders: CustomerOrder[];
  rmas: CustomerRma[];
};

type ApiCollectionResult<T> = {
  items: T[];
  source: ApiSource;
  total: number;
  returned: number;
};

type DataSourceState = {
  customersSource: ApiSource;
  applicationsSource: ApiSource;
  syncedAt: string | null;
  customersTotal: number;
  applicationsTotal: number;
  customerError?: string;
  applicationError?: string;
};

type PanelNotice = {
  tone: NoticeTone;
  message: string;
};

const tiers = customerTiers;
const statusFilters: CompanyStatus[] = [
  "approved",
  "pending",
  "suspended",
  "rejected",
];
const lifecycleLabels: Record<CustomerLifecycle, string> = {
  onboarding: "Onboarding",
  active: "Attivo",
  vip: "VIP",
  at_risk: "Da seguire",
};
const tierBadgeClasses: Record<CustomerTier, string> = {
  bronze: "border-slate-200 bg-slate-50 text-slate-700",
  silver: "border-zinc-200 bg-zinc-50 text-zinc-700",
  gold: "border-amber-200 bg-amber-50 text-amber-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  diamond: "border-cyan-200 bg-cyan-50 text-cyan-700",
  master: "border-violet-200 bg-violet-50 text-violet-700",
  king: "border-rose-200 bg-rose-50 text-rose-700",
};
const fallbackPricingProducts: PartProduct[] = [
  {
    sku: "PP-DEMO-SCREEN",
    slug: "pp-demo-screen",
    name: "Display OLED compatibile",
    category: "Screen",
    brand: "PartsPro",
    grade: "A",
    price: 89,
    retailPrice: 119,
    stock: 0,
    status: "In Stock",
    updatedAt: "Demo",
    visual: "screen",
    compatibleWith: ["iPhone"],
    warehouse: "Milano",
    moq: 1,
    vatRate: 22,
    rmaDays: 12,
    leadTime: "24/48h",
    tags: [],
  },
  {
    sku: "PP-DEMO-BATTERY",
    slug: "pp-demo-battery",
    name: "Batteria alta capacita",
    category: "Battery",
    brand: "PartsPro",
    grade: "A+",
    price: 34,
    retailPrice: 49,
    stock: 0,
    status: "In Stock",
    updatedAt: "Demo",
    visual: "battery",
    compatibleWith: ["Samsung"],
    warehouse: "Milano",
    moq: 1,
    vatRate: 22,
    rmaDays: 12,
    leadTime: "24/48h",
    tags: [],
  },
  {
    sku: "PP-DEMO-CAMERA",
    slug: "pp-demo-camera",
    name: "Modulo camera posteriore",
    category: "Camera",
    brand: "PartsPro",
    grade: "A",
    price: 57,
    retailPrice: 79,
    stock: 0,
    status: "In Stock",
    updatedAt: "Demo",
    visual: "camera",
    compatibleWith: ["Xiaomi"],
    warehouse: "Milano",
    moq: 1,
    vatRate: 22,
    rmaDays: 12,
    leadTime: "5/7 gg",
    tags: [],
  },
];
const pricingProducts = products.length > 0 ? products.slice(0, 3) : fallbackPricingProducts;
const customerSegments: Array<{ label: string; value: CustomerSegment }> = [
  { label: "Da assegnare", value: "needs_review" },
  { label: "Retail", value: "retail" },
  { label: "Wholesale", value: "wholesale" },
  { label: "Staff", value: "employee" },
];
const roleTemplateOptions = [
  "sales",
  "sales_support",
  "catalog_manager",
  "pricing_manager",
  "inventory_manager",
  "warehouse",
  "purchasing",
  "auditor",
  "admin",
] as const;

export function AdminCustomersPanel() {
  const [customers, setCustomers] = React.useState<CustomerProfile[]>([]);
  const [dataSource, setDataSource] = React.useState<DataSourceState>({
    customersSource: "empty",
    applicationsSource: "empty",
    syncedAt: null,
    customersTotal: 0,
    applicationsTotal: 0,
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingActionKey, setPendingActionKey] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<PanelNotice | null>(null);
  const [query, setQuery] = React.useState("");
  const [segment, setSegment] = React.useState<CustomerSegment>("needs_review");
  const [tierFilter, setTierFilter] = React.useState<TierFilterValue>("all");
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilterValue>("all");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");

  const refreshAdminData = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);

    try {
      const customersResult = await fetchCustomersFromApi(signal);

      if (signal?.aborted) {
        return;
      }

      const nextCustomers = customersResult.items;

      setCustomers(nextCustomers);
      setSelectedCustomerId((current) =>
        nextCustomers.some((customer) => customer.id === current)
          ? current
          : nextCustomers[0]?.id ?? ""
      );
      setDataSource({
        customersSource: customersResult.source,
        applicationsSource: "empty",
        syncedAt: formatSyncTime(),
        customersTotal: customersResult.total,
        applicationsTotal: 0,
      });
      setNotice({
        tone: "success",
        message: "Account, clienti e staff sincronizzati da /api/admin/accounts.",
      });
    } catch (error) {
      if (!signal?.aborted) {
        const customerError = readableError(error);
        setCustomers([]);
        setDataSource({
          customersSource: "empty",
          applicationsSource: "empty",
          syncedAt: formatSyncTime(),
          customersTotal: 0,
          applicationsTotal: 0,
          customerError,
        });
        setNotice({
          tone: "error",
          message: customerError,
        });
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void refreshAdminData(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refreshAdminData]);

  const filteredCustomers = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          customer.name,
          customer.partitaIva,
          customer.city,
          customer.province,
          customer.contactName,
          customer.email,
          customer.primarySku,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesTier =
        tierFilter === "all" || customer.priceList === tierFilter;
      const matchesStatus =
        statusFilter === "all" || customer.status === statusFilter;
      const matchesSegment = customerMatchesSegment(customer, segment);

      return matchesQuery && matchesTier && matchesStatus && matchesSegment;
    });
  }, [customers, query, segment, statusFilter, tierFilter]);

  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ??
    customers[0] ??
    null;
  const selectedOrders = React.useMemo(
    () =>
      [...(selectedCustomer?.orders ?? [])].sort(
        (a, b) => parseDateValue(b.date) - parseDateValue(a.date)
      ),
    [selectedCustomer?.orders]
  );
  const selectedRmas = selectedCustomer?.rmas ?? [];
  const selectedLastOrder = selectedOrders[0];
  const stats = React.useMemo(() => {
    const receivables = customers.reduce(
      (total, customer) => total + customer.receivables,
      0
    );
    const overdue = customers.reduce((total, customer) => total + customer.overdue, 0);
    const averageDiscount =
      customers.length > 0
        ? customers.reduce(
            (total, customer) =>
              total + getTierRule(customer.priceList).discountRate * 100,
            0
          ) / customers.length
        : 0;

    return {
      activeCustomers: customers.filter((customer) => customer.status === "approved")
        .length,
      averageDiscount,
      overdue,
      receivables,
    };
  }, [customers]);

  function clearFilters() {
    setQuery("");
    setTierFilter("all");
    setStatusFilter("all");
  }

  async function updateSelectedTier(tier: CustomerTier) {
    if (!selectedCustomer || selectedCustomer.priceList === tier) {
      return;
    }

    const actionKey = `customer:${selectedCustomer.id}:priceList`;
    setPendingActionKey(actionKey);

    try {
      const result = await patchCustomerInApi(selectedCustomer.id, { priceList: tier });
      const updatedCustomer =
        result.customer ??
        applyCustomerPatch(selectedCustomer, {
          priceList: tier,
          creditLimit: getTierRule(tier).creditLimit,
        });

      setCustomers((current) =>
        current.map((customer) =>
          customer.id === selectedCustomer.id ? updatedCustomer : customer
        )
      );
      setNotice({
        tone: "success",
        message: `Listino ${tier} salvato tramite /api/admin/customers/${selectedCustomer.id}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: readableError(error),
      });
    } finally {
      setPendingActionKey(null);
    }
  }

  async function updateSelectedAccount(
    patch: {
      accountType: "customer" | "employee";
      assignmentStatus?: "assigned" | "needs_review";
      customerType?: "retail" | "wholesale";
      roleTemplate?: (typeof roleTemplateOptions)[number];
    }
  ) {
    if (!selectedCustomer) {
      return;
    }

    const actionKey = `account:${selectedCustomer.userId}`;
    setPendingActionKey(actionKey);

    try {
      await patchAccountInApi({
        userId: selectedCustomer.userId,
        ...patch,
      });
      setNotice({
        tone: "success",
        message: "Account aggiornato tramite /api/admin/accounts.",
      });
      await refreshAdminData();
    } catch (error) {
      setNotice({
        tone: "error",
        message: readableError(error),
      });
    } finally {
      setPendingActionKey(null);
    }
  }

  const selectedTier = selectedCustomer?.priceList ?? "bronze";
  const selectedTierRule = getTierRule(selectedTier);
  const totalSpend = selectedOrders.reduce((total, order) => total + order.total, 0);
  const availableCredit = selectedCustomer
    ? Math.max(0, selectedCustomer.creditLimit - selectedCustomer.receivables)
    : 0;
  const creditUsage =
    selectedCustomer && selectedCustomer.creditLimit > 0
      ? Math.min(
          100,
          (selectedCustomer.receivables / selectedCustomer.creditLimit) * 100
        )
      : 0;
  const hasFilters =
    Boolean(query.trim()) || tierFilter !== "all" || statusFilter !== "all";
  const segmentCounts = React.useMemo(
    () =>
      customerSegments.reduce<Record<CustomerSegment, number>>(
        (counts, item) => ({
          ...counts,
          [item.value]: customers.filter((customer) =>
            customerMatchesSegment(customer, item.value)
          ).length,
        }),
        { employee: 0, needs_review: 0, retail: 0, wholesale: 0 }
      ),
    [customers]
  );

  return (
    <section className="min-w-0 space-y-4 overflow-x-hidden text-slate-950">
      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Clienti attivi"
          value={`${stats.activeCustomers}/${customers.length}`}
          helper="Profili approvati"
        />
        <MetricCard
          icon={WalletCards}
          label="Crediti aperti"
          value={formatEuro(stats.receivables)}
          helper="Esposizione totale"
        />
        <MetricCard
          icon={CreditCard}
          label="Scaduto"
          value={formatEuro(stats.overdue)}
          helper="Da sollecitare"
          warning={stats.overdue > 0}
        />
        <MetricCard
          icon={TrendingUp}
          label="Sconto medio"
          value={`${stats.averageDiscount.toFixed(1)}%`}
          helper="Da listini cliente"
        />
      </div>

      <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle>Gestione clienti</CardTitle>
            <CardDescription>
              Account, clienti retail/wholesale, staff e listini in un unico pannello
            </CardDescription>
          </div>
          <div className="flex w-full min-w-0 flex-wrap gap-2 lg:w-auto lg:justify-end">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 bg-white pl-9"
                placeholder="Cerca cliente, P.IVA, citta"
              />
            </div>
            <Select
              value={tierFilter}
              onValueChange={(value) => setTierFilter(value as TierFilterValue)}
            >
              <SelectTrigger size="sm" className="w-full bg-white sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti listini</SelectItem>
                {tiers.map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {tier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as StatusFilterValue)
              }
            >
              <SelectTrigger size="sm" className="w-full bg-white sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti stati</SelectItem>
                {statusFilters.map((status) => (
                  <SelectItem key={status} value={status}>
                    {companyStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="bg-white"
              disabled={!hasFilters}
              onClick={clearFilters}
            >
              <Filter className="size-4" />
              Reset
            </Button>
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => void refreshAdminData()}
              disabled={isLoading}
            >
              <RefreshCcw className={cn("size-4", isLoading && "animate-spin")} />
              Aggiorna
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 p-3 sm:p-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <Badge className={sourceBadgeClass(dataSource.customersSource)}>
              Account: {sourceLabel(dataSource.customersSource)}
            </Badge>
            <span className="min-w-0 break-words">
              {dataSource.syncedAt
                ? `${dataSource.customersTotal} account - ${dataSource.syncedAt}`
                : "In attesa di sincronizzazione"}
            </span>
          </div>

          {notice && (
            <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />
          )}

          {dataSource.customerError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-950">
              <div className="min-w-0 break-words">
                Account: {dataSource.customerError}
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-4">
            {customerSegments.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm font-black transition",
                  segment === item.value
                    ? "border-primary/30 bg-primary/8 text-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:border-primary/30"
                )}
                onClick={() => setSegment(item.value)}
              >
                <span className="block">{item.label}</span>
                <span className="mt-1 block text-xs text-slate-400">
                  {segmentCounts[item.value]} account
                </span>
              </button>
            ))}
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-700">
                  {isLoading && customers.length === 0
                    ? "Caricamento clienti"
                    : `${filteredCustomers.length} clienti`}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {statusFilter === "all"
                    ? "Tutti gli stati"
                    : companyStatusLabel(statusFilter)}
                </span>
              </div>

              {filteredCustomers.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  {filteredCustomers.map((customer) => {
                    const lastOrder = customer.orders[0];
                    const isSelected = customer.id === selectedCustomer?.id;

                    return (
                      <button
                        key={customer.id}
                        type="button"
                        className={cn(
                          "w-full min-w-0 rounded-lg border bg-white p-2.5 text-left transition hover:border-primary/40 hover:bg-primary/4 sm:p-3",
                          isSelected
                            ? "border-primary/30 bg-primary/6 shadow-[0_12px_30px_rgba(59,91,255,0.09)]"
                            : "border-slate-200"
                        )}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedCustomerId(customer.id)}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-900">
                              {customer.name}
                            </div>
                            <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-slate-500">
                              <MapPin className="size-3.5 shrink-0" />
                              <span className="truncate">
                                {customer.city} ({customer.province})
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge
                              className={cn(
                                "border",
                                companyStatusBadgeClass(customer.status)
                              )}
                            >
                              {companyStatusLabel(customer.status)}
                            </Badge>
                            <Badge
                              className={cn("border", tierBadgeClass(customer.priceList))}
                            >
                              {customer.priceList}
                            </Badge>
                            <Badge variant="outline" className="bg-white">
                              {customer.accountType === "employee"
                                ? customer.roleTemplate ?? "staff"
                                : customer.customerType}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-2 hidden grid-cols-3 gap-1.5 md:grid">
                          <CustomerListValue
                            label="Aperto"
                            value={formatEuro(customer.receivables)}
                          />
                          <CustomerListValue
                            label="Scaduto"
                            value={formatEuro(customer.overdue)}
                            warning={customer.overdue > 0}
                          />
                          <CustomerListValue
                            label="Ultimo"
                            value={lastOrder?.date ?? "Nessuno"}
                          />
                        </div>
                        <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                          <span className="min-w-0 break-words">
                            {lastOrder
                              ? `${lastOrder.id} - ${formatEuro(lastOrder.total)}`
                              : "Storico ordini vuoto"}
                          </span>
                          <span className="shrink-0 text-slate-400">
                            {lifecycleLabels[customer.lifecycle]}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel
                  icon={Users}
                  title={isLoading ? "Caricamento clienti" : "Nessun cliente"}
                  message={
                    isLoading
                      ? "Sincronizzazione da /api/admin/customers in corso."
                      : "Nessun cliente disponibile dai filtri o dall'endpoint admin."
                  }
                />
              )}
            </div>

            <div className="min-w-0 space-y-4">
              {selectedCustomer ? (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_410px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="min-w-0 break-words text-lg font-black leading-tight text-slate-950 sm:text-xl">
                            {selectedCustomer.name}
                          </h2>
                          <Badge
                            className={cn(
                              "border",
                              companyStatusBadgeClass(selectedCustomer.status)
                            )}
                          >
                            {companyStatusLabel(selectedCustomer.status)}
                          </Badge>
                          <Badge variant="outline" className="bg-white">
                            {lifecycleLabels[selectedCustomer.lifecycle]}
                          </Badge>
                          <Badge variant="outline" className="bg-white">
                            {selectedCustomer.accountType === "employee"
                              ? selectedCustomer.roleTemplate ?? "staff"
                              : selectedCustomer.customerType}
                          </Badge>
                        </div>
                        <div className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                          <span className="break-all">{selectedCustomer.partitaIva}</span>
                          <span className="break-all">{selectedCustomer.pec}</span>
                          <span className="break-all">
                            SDI {selectedCustomer.codiceDestinatario}
                          </span>
                        </div>
                        <div className="mt-3 hidden grid-cols-2 gap-2 md:grid lg:grid-cols-4">
                          <CompactValue
                            label="Aperto"
                            value={formatEuro(selectedCustomer.receivables)}
                          />
                          <CompactValue
                            label="Scaduto"
                            value={formatEuro(selectedCustomer.overdue)}
                            warning={selectedCustomer.overdue > 0}
                          />
                          <CompactValue
                            label="Ordini"
                            value={`${selectedOrders.length}`}
                          />
                          <CompactValue
                            label="Ultimo"
                            value={selectedLastOrder?.date ?? "Nessuno"}
                          />
                        </div>
                      </div>
                      <div className="grid min-w-0 gap-2 self-start sm:grid-cols-[minmax(0,1fr)_180px]">
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="text-xs font-bold uppercase text-slate-400">
                            Listino corrente
                          </div>
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                            <Badge className={cn("border", tierBadgeClass(selectedTier))}>
                              {selectedTier}
                            </Badge>
                            <span className="min-w-0 break-words text-xs font-semibold text-slate-500">
                              {selectedTierRule.tagLabel} - coeff.{" "}
                              {tierMultiplier(selectedTier).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <Select
                          value={selectedTier}
                          onValueChange={(value) =>
                            void updateSelectedTier(value as CustomerTier)
                          }
                          disabled={pendingActionKey?.startsWith(
                            `customer:${selectedCustomer.id}:`
                          )}
                        >
                          <SelectTrigger className="w-full bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {tiers.map((tier) => (
                              <SelectItem key={tier} value={tier}>
                                {tier} - {getTierRule(tier).tagLabel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={selectedCustomer.customerType === "retail" ? "default" : "outline"}
                        className={selectedCustomer.customerType === "retail" ? "" : "bg-white"}
                        disabled={pendingActionKey?.startsWith("account:")}
                        onClick={() =>
                          void updateSelectedAccount({
                            accountType: "customer",
                            assignmentStatus: "assigned",
                            customerType: "retail",
                          })
                        }
                      >
                        Retail
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedCustomer.customerType === "wholesale" ? "default" : "outline"}
                        className={selectedCustomer.customerType === "wholesale" ? "" : "bg-white"}
                        disabled={pendingActionKey?.startsWith("account:")}
                        onClick={() =>
                          void updateSelectedAccount({
                            accountType: "customer",
                            assignmentStatus: "assigned",
                            customerType: "wholesale",
                          })
                        }
                      >
                        Wholesale
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedCustomer.accountType === "employee" ? "default" : "outline"}
                        className={selectedCustomer.accountType === "employee" ? "" : "bg-white"}
                        disabled={pendingActionKey?.startsWith("account:")}
                        onClick={() =>
                          void updateSelectedAccount({
                            accountType: "employee",
                            roleTemplate: normalizeRoleTemplate(selectedCustomer.roleTemplate),
                          })
                        }
                      >
                        Staff
                      </Button>
                      {selectedCustomer.accountType === "employee" && (
                        <Select
                          value={selectedCustomer.roleTemplate ?? "sales_support"}
                          onValueChange={(value) =>
                            void updateSelectedAccount({
                              accountType: "employee",
                              roleTemplate: value as (typeof roleTemplateOptions)[number],
                            })
                          }
                          disabled={pendingActionKey?.startsWith("account:")}
                        >
                          <SelectTrigger size="sm" className="w-full bg-white sm:w-52">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleTemplateOptions.map((roleTemplate) => (
                              <SelectItem key={roleTemplate} value={roleTemplate}>
                                {roleTemplate}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <Separator className="my-4" />

                    <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
                      <InfoTile
                        icon={UserRound}
                        label="Referente"
                        value={selectedCustomer.contactName}
                        helper={selectedCustomer.email}
                      />
                      <InfoTile
                        icon={ShieldCheck}
                        label="Account owner"
                        value={selectedCustomer.accountOwner}
                        helper={selectedCustomer.lastContact}
                      />
                      <InfoTile
                        icon={ClipboardList}
                        label="Ordini storici"
                        value={`${selectedOrders.length}`}
                        helper={formatEuro(totalSpend)}
                      />
                      <InfoTile
                        icon={PackageCheck}
                        label="SKU ricorrente"
                        value={selectedCustomer.primarySku}
                        helper={selectedCustomer.phone}
                      />
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2">
                        <CircleDollarSign className="size-4 text-primary" />
                        <h3 className="font-black text-slate-900">Credito e incassi</h3>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <CompactValue
                          label="Fido"
                          value={formatEuro(selectedCustomer.creditLimit)}
                        />
                        <CompactValue
                          label="Disponibile"
                          value={formatEuro(availableCredit)}
                        />
                        <CompactValue
                          label="Aperto"
                          value={formatEuro(selectedCustomer.receivables)}
                        />
                        <CompactValue
                          label="Scaduto"
                          value={formatEuro(selectedCustomer.overdue)}
                          warning={selectedCustomer.overdue > 0}
                        />
                      </div>
                      <div className="mt-4">
                        <div className="mb-2 flex justify-between text-xs font-bold text-slate-500">
                          <span>Utilizzo fido</span>
                          <span>{creditUsage.toFixed(0)}%</span>
                        </div>
                        <Progress value={creditUsage} className="h-2" />
                      </div>
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                        <span className="font-semibold text-slate-800">
                          Pagamento medio {selectedCustomer.avgPaymentDays} giorni.
                        </span>{" "}
                        {selectedCustomer.notes}
                      </div>
                    </div>

                    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2">
                        <WalletCards className="size-4 text-primary" />
                        <h3 className="font-black text-slate-900">Prezzi per listino</h3>
                      </div>
                      <div className="mt-3 hidden gap-2 md:grid md:grid-cols-3">
                        {tiers.map((tier) => (
                          <TierPriceCard
                            key={tier}
                            active={tier === selectedTier}
                            product={pricingProducts[0]}
                            tier={tier}
                          />
                        ))}
                      </div>
                      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 md:hidden">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-bold text-slate-800 [&::-webkit-details-marker]:hidden">
                          <span>Esempi prezzo {selectedTier}</span>
                          <Badge className={cn("border", tierBadgeClass(selectedTier))}>
                            {formatTierDiscount(selectedTier)}
                          </Badge>
                        </summary>
                        <div className="space-y-2 border-t border-slate-200 p-2">
                          {pricingProducts.map((product) => (
                            <PriceExampleCard
                              key={product.sku}
                              product={product}
                              tier={selectedTier}
                            />
                          ))}
                        </div>
                      </details>
                      <div className="mt-4 hidden overflow-hidden rounded-lg border border-slate-200 md:block">
                        <div className="max-w-full overflow-x-auto">
                          <Table className="min-w-[560px]">
                            <TableHeader className="bg-slate-50">
                              <TableRow>
                                <TableHead>SKU esempio</TableHead>
                                <TableHead>Base</TableHead>
                                <TableHead>{selectedTier}</TableHead>
                                <TableHead>Sconto</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pricingProducts.map((product) => (
                                <TableRow key={product.sku}>
                                  <TableCell>
                                    <div className="font-mono text-xs font-bold text-slate-700">
                                      {product.sku}
                                    </div>
                                    <div className="mt-1 max-w-[230px] truncate text-xs text-slate-500">
                                      {product.name}
                                    </div>
                                  </TableCell>
                                  <TableCell>{formatEuro(product.price)}</TableCell>
                                  <TableCell className="font-black text-slate-900">
                                    {formatEuro(priceForTier(product, selectedTier))}
                                  </TableCell>
                                  <TableCell>
                                    {formatTierDiscount(selectedTier)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
                    <HistoryTable orders={selectedOrders} />
                    <RmaHistory orderCount={selectedOrders.length} rmas={selectedRmas} />
                  </div>
                </>
              ) : (
                <EmptyPanel
                  icon={Users}
                  title={isLoading ? "Caricamento dettaglio" : "Nessun dettaglio cliente"}
                  message={
                    isLoading
                      ? "Sincronizzazione da /api/admin/customers in corso."
                      : "Seleziona un cliente o collega l'endpoint admin customers."
                  }
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function MetricCard({
  helper,
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-500">{label}</p>
            <div
              className={cn(
                "mt-2 break-words text-xl font-black leading-tight sm:text-3xl",
                warning && "text-amber-600"
              )}
            >
              {value}
            </div>
            <p className="mt-2 truncate text-xs font-semibold text-slate-500">
              {helper}
            </p>
          </div>
          <div
            className={cn(
              "hidden size-11 shrink-0 place-items-center rounded-full sm:grid",
              warning ? "bg-amber-50 text-amber-600" : "bg-primary/10 text-primary"
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NoticeBanner({
  notice,
  onDismiss,
}: {
  notice: PanelNotice;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium",
        noticeToneClass(notice.tone)
      )}
    >
      {notice.tone === "success" ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : (
        <AlertTriangle className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 break-words">{notice.message}</span>
      <Button
        variant="ghost"
        size="xs"
        className="text-current hover:bg-white/60"
        onClick={onDismiss}
      >
        OK
      </Button>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  message,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  title: string;
}) {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div>
        <Icon className="mx-auto size-8 text-slate-400" />
        <h3 className="mt-3 text-sm font-black text-slate-900">{title}</h3>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{message}</p>
      </div>
    </div>
  );
}

function InfoTile({
  helper,
  icon: Icon,
  label,
  value,
}: {
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
          <div className="mt-1 truncate text-sm font-black text-slate-900">
            {value}
          </div>
          <div className="mt-1 truncate text-xs font-medium text-slate-500">
            {helper}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerListValue({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md bg-slate-50 px-2 py-1.5",
        warning && "bg-amber-50"
      )}
    >
      <div className="truncate text-[10px] font-bold uppercase leading-none text-slate-400">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 break-words text-[11px] font-black leading-tight text-slate-900",
          warning && "text-amber-700"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function CompactValue({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="truncate text-xs font-bold uppercase text-slate-400">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 break-words text-sm font-black leading-tight text-slate-900",
          warning && "text-amber-600"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TierPriceCard({
  active,
  product,
  tier,
}: {
  active: boolean;
  product: PartProduct;
  tier: CustomerTier;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border p-3",
        active ? "border-primary/30 bg-primary/6" : "border-slate-200 bg-slate-50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge className={cn("border", tierBadgeClass(tier))}>{tier}</Badge>
        {active && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
      </div>
      <div className="mt-3 truncate font-mono text-xs font-bold text-slate-500">
        {product.sku}
      </div>
      <div className="mt-1 text-lg font-black text-slate-950">
        {formatEuro(priceForTier(product, tier))}
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-500">
        {formatTierDiscount(tier)} - coeff. {tierMultiplier(tier).toFixed(2)}
      </div>
    </div>
  );
}

function PriceExampleCard({
  product,
  tier,
}: {
  product: PartProduct;
  tier: CustomerTier;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0">
        <div className="break-all font-mono text-xs font-bold text-slate-700">
          {product.sku}
        </div>
        <div className="mt-1 break-words text-xs font-medium leading-5 text-slate-500">
          {product.name}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <CompactValue label="Base" value={formatEuro(product.price)} />
        <CompactValue
          label={tier}
          value={formatEuro(priceForTier(product, tier))}
        />
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
          {formatTierDiscount(tier)} - coeff. {tierMultiplier(tier).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function HistoryTable({ orders }: { orders: CustomerOrder[] }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <History className="size-4 text-primary" />
        <h3 className="font-black text-slate-900">Storico ordini</h3>
      </div>
      <div className="mt-4 space-y-2 md:hidden">
        {orders.length > 0 ? (
          orders.map((order) => <OrderHistoryCard key={order.id} order={order} />)
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm font-medium text-slate-500">
            Nessun ordine registrato.
          </div>
        )}
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-slate-200 md:block">
        <div className="max-w-full overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Ordine</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>SKU principale</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Totale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length > 0 ? (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-mono text-xs font-bold text-slate-700">
                        {order.id}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {order.date} - {order.channel} - {order.items} righe
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border", orderBadgeClass(order.status))}>
                        {orderStatusLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs font-bold text-slate-700">
                        {order.topSku}
                      </div>
                      <div className="mt-1 max-w-[220px] truncate text-xs text-slate-500">
                        {order.topProduct}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-semibold text-slate-700">
                        {order.paymentTerms}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Margine {order.margin}%
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black">
                      {formatEuro(order.total)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-slate-500">
                    Nessun ordine registrato.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function OrderHistoryCard({ order }: { order: CustomerOrder }) {
  return (
    <details className="group min-w-0 rounded-lg border border-slate-200 bg-slate-50">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="break-all font-mono text-xs font-bold text-slate-700">
            {order.id}
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            {order.date} - {order.channel} - {order.items} righe
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge className={cn("border", orderBadgeClass(order.status))}>
            {orderStatusLabel(order.status)}
          </Badge>
          <div className="whitespace-nowrap text-sm font-black text-slate-950">
            {formatEuro(order.total)}
          </div>
        </div>
      </summary>
      <div className="grid gap-2 border-t border-slate-200 p-3 text-xs text-slate-600">
        <div className="rounded-md bg-white px-2 py-1.5">
          <span className="font-bold text-slate-800">SKU</span>{" "}
          <span className="break-all font-mono font-bold">{order.topSku}</span>
        </div>
        <div className="break-words rounded-md bg-white px-2 py-1.5">
          {order.topProduct}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-white px-2 py-1.5 font-semibold">
            {order.paymentTerms}
          </div>
          <div className="rounded-md bg-white px-2 py-1.5 font-semibold">
            Margine {order.margin}%
          </div>
        </div>
      </div>
    </details>
  );
}

function RmaHistory({
  orderCount,
  rmas,
}: {
  orderCount: number;
  rmas: CustomerRma[];
}) {
  const rmaRate = orderCount > 0 ? (rmas.length / orderCount) * 100 : 0;

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <RefreshCcw className="size-4 shrink-0 text-primary" />
          <h3 className="font-black text-slate-900">RMA cliente</h3>
        </div>
        <Badge variant="outline" className="shrink-0 bg-white">
          {rmas.length} RMA - {rmaRate.toFixed(1)}%
        </Badge>
      </div>
      <div className="mt-4 space-y-2">
        {rmas.length > 0 ? (
          rmas.map((request) => (
            <div
              key={request.id}
              className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-slate-700">
                    {request.id}
                  </div>
                  <div className="mt-1 break-words text-sm font-black leading-tight text-slate-900">
                    {request.productName}
                  </div>
                </div>
                <Badge className={cn("shrink-0 border", rmaBadgeClass(request.status))}>
                  {rmaStatusLabel(request.status)}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600">
                <div className="flex min-w-0 items-center gap-2">
                  <PackageCheck className="size-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 break-words">
                    {request.orderId} - {request.sku} - {request.createdAt}
                  </span>
                </div>
                <div className="rounded-md bg-white px-2 py-1.5">
                  {request.reason}
                </div>
                <div className="rounded-md bg-white px-2 py-1.5 font-semibold">
                  {request.resolution}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm font-medium text-slate-500">
            Nessuna pratica RMA collegata agli ordini cliente.
          </div>
        )}
      </div>
    </div>
  );
}

async function fetchCustomersFromApi(
  signal?: AbortSignal
): Promise<ApiCollectionResult<CustomerProfile>> {
  const response = await fetch("/api/admin/accounts?limit=100", {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/accounts ha risposto ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return parseCustomersPayload(payload);
}

async function patchCustomerInApi(
  customerId: string,
  patch: Partial<Pick<CustomerProfile, "priceList" | "status" | "creditLimit">>
) {
  const response = await fetch(
    `/api/admin/customers/${encodeURIComponent(customerId)}`,
    {
      body: JSON.stringify(serializePatch(patch)),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "PATCH",
    }
  );

  if (!response.ok) {
    throw new Error(
      `PATCH /api/admin/customers/${customerId} ha risposto ${response.status}. Modifica non applicata localmente.`
    );
  }

  const payload = await readJsonSafely(response);
  const row = extractObjectPayload(payload, ["data", "customer"]);

  return {
    customer: row ? normalizeCustomer(row) : null,
  };
}

async function patchAccountInApi(patch: {
  accountType: "customer" | "employee";
  assignmentStatus?: "assigned" | "needs_review";
  customerType?: "retail" | "wholesale";
  roleTemplate?: (typeof roleTemplateOptions)[number];
  userId: string;
}) {
  const response = await fetch("/api/admin/accounts", {
    body: JSON.stringify(patch),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(
      `PATCH /api/admin/accounts ha risposto ${response.status}. Classificazione non applicata localmente.`
    );
  }

  return readJsonSafely(response);
}

function parseCustomersPayload(
  payload: unknown
): ApiCollectionResult<CustomerProfile> {
  if (!isRecord(payload)) {
    throw new Error("Risposta /api/admin/accounts incompleta");
  }

  const meta = isRecord(payload.meta) ? payload.meta : {};
  const rows = readArrayPayload(payload, ["data", "customers"]);

  if (!rows) {
    throw new Error("Risposta /api/admin/accounts incompleta");
  }

  const items = rows
    .map((row) => normalizeCustomer(row))
    .filter((customer): customer is CustomerProfile => customer !== null);

  return {
    items,
    source: readSource(meta.source ?? payload.source),
    total: readNumber(meta.total) ?? items.length,
    returned: readNumber(meta.returned) ?? items.length,
  };
}

function normalizeCustomer(row: unknown): CustomerProfile | null {
  if (!isRecord(row)) {
    return null;
  }

  const nestedCustomer = isRecord(row.customer) ? row.customer : null;
  const source = nestedCustomer ?? row;
  const address = isRecord(source.address) ? source.address : null;
  const accountType =
    readString(readRecordValue(row, ["accountType", "account_type"])) === "employee"
      ? "employee"
      : "customer";
  const id =
    readString(readRecordValue(source, ["id", "customerId", "companyId"])) ??
    readString(readRecordValue(row, ["userId", "user_id", "id"]));
  const name =
    readString(readRecordValue(source, ["name", "companyName", "company_name"])) ??
    readString(readRecordValue(row, ["displayName", "display_name", "email"])) ??
    "Account PartsPro";

  if (!id || !name) {
    return null;
  }

  const priceList = normalizeCustomerTier(
    readString(readRecordValue(source, ["level", "priceList", "price_list", "tier"]))
  );
  const orders = (readArrayPayload(row, ["orders", "orderSummaries"]) ?? [])
    .map((order) => normalizeCustomerOrder(order, name))
    .filter((order): order is CustomerOrder => order !== null);
  const rmas = (readArrayPayload(row, ["rmas", "rmaRequests"]) ?? [])
    .map(normalizeCustomerRma)
    .filter((rma): rma is CustomerRma => rma !== null);
  const receivables = readMoney(
    readRecordValue(source, ["receivables", "openBalance", "open_balance"])
  );
  const overdue = readMoney(readRecordValue(source, ["overdue", "overdueBalance"]));
  const status =
    accountType === "employee"
      ? "approved"
      : normalizeCompanyStatus(readRecordValue(source, ["status"]));
  const customerType =
    readString(readRecordValue(source, ["customerType", "customer_type"])) === "wholesale"
      ? "wholesale"
      : "retail";
  const assignmentStatus = normalizeAssignmentStatus(
    readString(readRecordValue(source, ["assignmentStatus", "assignment_status"]))
  );

  return {
    id,
    userId: readString(readRecordValue(row, ["userId", "user_id", "id"])) ?? id,
    accountType,
    assignmentStatus,
    customerType,
    roleTemplate: readString(readRecordValue(row, ["roleTemplate", "role_template"])),
    name,
    partitaIva:
      readString(readRecordValue(source, ["partitaIva", "vatNumber", "vat_number"])) ??
      "Non disponibile",
    codiceFiscale:
      readString(readRecordValue(source, ["codiceFiscale", "taxCode", "tax_code"])) ??
      "Non disponibile",
    pec: readString(source.pec) ?? readString(row.email) ?? "Non disponibile",
    codiceDestinatario:
      readString(
        readRecordValue(source, ["codiceDestinatario", "sdi", "recipientCode"])
      ) ?? "0000000",
    status,
    priceList,
    lifetimeSpendNet:
      readNumber(readRecordValue(source, ["lifetimeSpendNet", "lifetime_spend_net"])) ?? 0,
    city:
      readString(readRecordValue(source, ["city"])) ??
      readString(readRecordValue(address, ["city"])) ??
      "Non disponibile",
    province:
      readString(readRecordValue(source, ["province"])) ??
      readString(readRecordValue(address, ["province"])) ??
      "--",
    accountOwner:
      readString(readRecordValue(row, ["accountOwner", "owner"])) ?? "Sales",
    contactName:
      readString(readRecordValue(source, ["contactName", "contact_name"])) ??
      "Referente non disponibile",
    email: readString(source.email) ?? readString(row.email) ?? "Non disponibile",
    phone: readString(source.phone) ?? "Non disponibile",
    creditLimit:
      readMoney(readRecordValue(source, ["creditLimit", "credit_limit"])) ||
      getTierRule(priceList).creditLimit,
    receivables,
    overdue,
    avgPaymentDays:
      readNumber(readRecordValue(row, ["avgPaymentDays", "averagePaymentDays"])) ?? 0,
    lifecycle: normalizeLifecycle(row.lifecycle, status, priceList, overdue),
    lastContact:
      readString(readRecordValue(row, ["lastContact", "last_contact"])) ??
      "Non disponibile",
    primarySku:
      readString(readRecordValue(row, ["primarySku", "primary_sku"])) ??
      orders[0]?.topSku ??
      "Nessuno",
    notes:
      readString(row.notes) ??
      "Profilo sincronizzato da /api/admin/accounts.",
    orders,
    rmas,
  };
}

function normalizeCustomerOrder(row: unknown, fallbackCompany: string): CustomerOrder | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = readString(readRecordValue(row, ["id", "orderId", "order_id"]));

  if (!id) {
    return null;
  }

  const product = isRecord(row.product) ? row.product : null;
  const status = normalizeOrderStatus(readRecordValue(row, ["status"]));

  return {
    id,
    date:
      readString(readRecordValue(row, ["date", "createdAt", "created_at"])) ??
      "Data non disponibile",
    status,
    company: readString(row.company) ?? fallbackCompany,
    total: readMoney(readRecordValue(row, ["total", "totalAmount", "total_amount"])),
    items: readNumber(readRecordValue(row, ["items", "itemCount"])) ?? 0,
    channel: normalizeOrderChannel(row.channel),
    margin: readNumber(row.margin) ?? 0,
    paymentTerms:
      readString(readRecordValue(row, ["paymentTerms", "payment_terms"])) ??
      (status === "pending_payment" ? "Bonifico anticipato" : "Da verificare"),
    topProduct:
      readString(readRecordValue(row, ["topProduct", "productName"])) ??
      readString(readRecordValue(product, ["name"])) ??
      "Prodotto non disponibile",
    topSku:
      readString(readRecordValue(row, ["topSku", "sku"])) ??
      readString(readRecordValue(product, ["sku"])) ??
      "SKU",
  };
}

function normalizeCustomerRma(row: unknown): CustomerRma | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = readString(row.id);

  if (!id) {
    return null;
  }

  return {
    id,
    orderId: readString(readRecordValue(row, ["orderId", "order_id"])) ?? "N/D",
    sku: readString(row.sku) ?? "SKU",
    productName:
      readString(readRecordValue(row, ["productName", "product_name"])) ??
      "Prodotto RMA",
    status: normalizeRmaStatus(row.status),
    reason: readString(row.reason) ?? "Motivo non disponibile",
    createdAt:
      readString(readRecordValue(row, ["createdAt", "created_at", "date"])) ??
      "Data non disponibile",
    resolution: readString(row.resolution) ?? "Da definire",
  };
}

function applyCustomerPatch(
  customer: CustomerProfile,
  patch: Partial<Pick<CustomerProfile, "priceList" | "status" | "creditLimit">>
) {
  return {
    ...customer,
    ...patch,
  };
}

function priceForTier(product: PartProduct, tier: CustomerTier) {
  return calculateTierPrice(product.price, tier);
}

function tierBadgeClass(tier: CustomerTier) {
  return tierBadgeClasses[tier];
}

function tierMultiplier(tier: CustomerTier) {
  return 1 - getTierRule(tier).discountRate;
}

function parseDateValue(value: string) {
  const italianDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (italianDate) {
    const [, day, month, year] = italianDate;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function companyStatusLabel(status: CompanyStatus) {
  const labels: Record<CompanyStatus, string> = {
    approved: "Approvato",
    pending: "In verifica",
    rejected: "Respinto",
    suspended: "Sospeso",
  };

  return labels[status];
}

function companyStatusBadgeClass(status: CompanyStatus) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "suspended") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function orderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    cancelled: "Annullato",
    delivered: "Consegnato",
    draft: "Bozza",
    paid: "Pagato",
    pending_payment: "Da pagare",
    picking: "Picking",
    shipped: "Spedito",
  };

  return labels[status];
}

function orderBadgeClass(status: OrderStatus) {
  if (status === "delivered" || status === "shipped" || status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "pending_payment" || status === "picking") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-primary/20 bg-primary/8 text-primary";
}

function rmaStatusLabel(status: RmaStatus) {
  const labels: Record<RmaStatus, string> = {
    approved: "Approvata",
    received: "Ricevuta",
    refunded: "Rimborsata",
    rejected: "Respinta",
    replaced: "Sostituita",
    requested: "Richiesta",
  };

  return labels[status];
}

function rmaBadgeClass(status: RmaStatus) {
  if (status === "replaced" || status === "refunded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "received" || status === "approved") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  return "border-primary/20 bg-primary/8 text-primary";
}

function noticeToneClass(tone: NoticeTone) {
  if (tone === "error") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (tone === "info") {
    return "border-cyan-200 bg-cyan-50 text-cyan-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function sourceLabel(source: ApiSource) {
  if (source === "admin_api") {
    return "Admin API";
  }

  if (source === "supabase") {
    return "Supabase";
  }

  return "Vuoto";
}

function sourceBadgeClass(source: ApiSource) {
  if (source === "admin_api" || source === "supabase") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function normalizeCompanyStatus(value: unknown): CompanyStatus {
  if (value === "active") {
    return "approved";
  }

  return ["approved", "pending", "suspended", "rejected"].includes(
    value as CompanyStatus
  )
    ? (value as CompanyStatus)
    : "pending";
}

function normalizeAssignmentStatus(value: string | null): CustomerProfile["assignmentStatus"] {
  if (
    value === "assigned" ||
    value === "converted_to_employee" ||
    value === "archived" ||
    value === "needs_review"
  ) {
    return value;
  }

  return "needs_review";
}

function normalizeRoleTemplate(value: string | null): (typeof roleTemplateOptions)[number] {
  return roleTemplateOptions.includes(value as (typeof roleTemplateOptions)[number])
    ? (value as (typeof roleTemplateOptions)[number])
    : "sales_support";
}

function customerMatchesSegment(customer: CustomerProfile, value: CustomerSegment) {
  if (value === "employee") {
    return customer.accountType === "employee";
  }

  if (customer.accountType === "employee") {
    return false;
  }

  if (value === "needs_review") {
    return customer.assignmentStatus === "needs_review";
  }

  return (
    customer.assignmentStatus !== "converted_to_employee" &&
    customer.assignmentStatus !== "archived" &&
    customer.customerType === value
  );
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  return [
    "draft",
    "pending_payment",
    "paid",
    "picking",
    "shipped",
    "delivered",
    "cancelled",
  ].includes(value as OrderStatus)
    ? (value as OrderStatus)
    : "pending_payment";
}

function normalizeRmaStatus(value: unknown): RmaStatus {
  return [
    "requested",
    "approved",
    "rejected",
    "received",
    "replaced",
    "refunded",
  ].includes(value as RmaStatus)
    ? (value as RmaStatus)
    : "requested";
}

function normalizeLifecycle(
  value: unknown,
  status: CompanyStatus,
  tier: CustomerTier,
  overdue: number
): CustomerLifecycle {
  if (["onboarding", "active", "vip", "at_risk"].includes(value as CustomerLifecycle)) {
    return value as CustomerLifecycle;
  }

  if (status === "pending") {
    return "onboarding";
  }

  if (overdue > 0 || status === "suspended") {
    return "at_risk";
  }

  return ["gold", "emerald", "diamond", "master", "king"].includes(tier)
    ? "vip"
    : "active";
}

function normalizeOrderChannel(value: unknown): CustomerOrder["channel"] {
  return ["Web", "Admin", "Account"].includes(value as CustomerOrder["channel"])
    ? (value as CustomerOrder["channel"])
    : "Web";
}

function readSource(value: unknown): ApiSource {
  if (value === "supabase" || value === "admin_api") {
    return value;
  }

  return "empty";
}

function readArrayPayload(
  record: Record<string, unknown>,
  keys: string[]
): unknown[] | null {
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

  return null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readMoney(value: unknown) {
  const direct = readNumber(value);

  if (direct !== null) {
    return direct;
  }

  if (!isRecord(value)) {
    return 0;
  }

  const amount = readNumber(value.amount);

  if (amount !== null) {
    return amount;
  }

  const cents = readNumber(value.cents);

  return cents === null ? 0 : Math.round((cents / 100 + Number.EPSILON) * 100) / 100;
}

async function readJsonSafely(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function extractObjectPayload(payload: unknown, keys: string[]) {
  if (!isRecord(payload)) {
    return null;
  }

  for (const key of keys) {
    if (isRecord(payload[key])) {
      return payload[key] as Record<string, unknown>;
    }
  }

  return readString(payload.id) ? payload : null;
}

function serializePatch(patch: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Errore sconosciuto";
}

function formatSyncTime() {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
