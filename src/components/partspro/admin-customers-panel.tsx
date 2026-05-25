"use client";

import * as React from "react";
import {
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
  companyProfiles,
  formatEuro,
  orderSummaries,
  products,
  rmaRequests,
  type CompanyProfile,
  type CompanyStatus,
  type OrderStatus,
  type OrderSummary,
  type PartProduct,
  type RmaStatus,
} from "@/lib/partspro-data";
import {
  calculateTierPrice,
  customerTiers,
  formatTierDiscount,
  getTierRule,
  type CustomerTier,
} from "@/lib/partspro-pricing";
import { cn } from "@/lib/utils";

type TierFilterValue = "all" | CustomerTier;
type StatusFilterValue = "all" | CompanyStatus;
type CustomerLifecycle = "onboarding" | "active" | "vip" | "at_risk";

type CustomerProfile = CompanyProfile & {
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
};

type CustomerOrder = OrderSummary & {
  channel: "Web" | "Admin" | "Account";
  margin: number;
  paymentTerms: string;
  topProduct: string;
  topSku: string;
};
type CustomerRma = (typeof rmaRequests)[number];

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
  Standard: "border-slate-200 bg-slate-50 text-slate-700",
  Pro: "border-cyan-200 bg-cyan-50 text-cyan-700",
  Partner: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const customerMeta: Record<
  string,
  Omit<CustomerProfile, keyof CompanyProfile>
> = {};

const supplementalCustomers: CustomerProfile[] = [];

const customers: CustomerProfile[] = [
  ...companyProfiles.map((profile) => ({
    ...profile,
    ...customerMeta[profile.id],
  })),
  ...supplementalCustomers,
];

const supplementalOrders: OrderSummary[] = [];

const customerOrders: CustomerOrder[] = [...orderSummaries, ...supplementalOrders].map(
  (order, index) => {
    const product = products[index % products.length] ?? products[0];

    return {
      ...order,
      channel: index % 3 === 0 ? "Web" : index % 3 === 1 ? "Admin" : "Account",
      margin: [18, 24, 14, 21, 17, 27, 12, 19][index] ?? 16,
      paymentTerms:
        order.status === "pending_payment" ? "Bonifico anticipato" : "30 gg fine mese",
      topProduct: product.name,
      topSku: product.sku,
    };
  }
);

const sampleProducts = products.slice(0, 3);

export function AdminCustomersPanel() {
  const [query, setQuery] = React.useState("");
  const [tierFilter, setTierFilter] = React.useState<TierFilterValue>("all");
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilterValue>("all");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState(
    customers[0]?.id ?? ""
  );
  const [tierByCustomer, setTierByCustomer] = React.useState<
    Record<string, CustomerTier>
  >(() =>
    customers.reduce<Record<string, CustomerTier>>((accumulator, customer) => {
      accumulator[customer.id] = customer.priceList;
      return accumulator;
    }, {})
  );

  const customersWithTier = React.useMemo(
    () =>
      customers.map((customer) => ({
        ...customer,
        priceList: tierByCustomer[customer.id] ?? customer.priceList,
      })),
    [tierByCustomer]
  );
  const filteredCustomers = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return customersWithTier.filter((customer) => {
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

      return matchesQuery && matchesTier && matchesStatus;
    });
  }, [customersWithTier, query, statusFilter, tierFilter]);

  const selectedCustomer =
    customersWithTier.find((customer) => customer.id === selectedCustomerId) ??
    customersWithTier[0];
  const selectedOrders = React.useMemo(
    () =>
      customerOrders
        .filter((order) => order.company === selectedCustomer?.name)
        .sort((a, b) => parseItalianDate(b.date) - parseItalianDate(a.date)),
    [selectedCustomer?.name]
  );
  const selectedOrderIds = React.useMemo(
    () => new Set(selectedOrders.map((order) => order.id)),
    [selectedOrders]
  );
  const selectedRmas = React.useMemo(
    () =>
      rmaRequests.filter((request) => selectedOrderIds.has(request.orderId)),
    [selectedOrderIds]
  );
  const stats = React.useMemo(() => {
    const receivables = customersWithTier.reduce(
      (total, customer) => total + customer.receivables,
      0
    );
    const overdue = customersWithTier.reduce(
      (total, customer) => total + customer.overdue,
      0
    );
    const averageDiscount =
      customersWithTier.reduce(
        (total, customer) => total + getTierRule(customer.priceList).discountRate * 100,
        0
      ) / customersWithTier.length;

    return {
      activeCustomers: customersWithTier.filter(
        (customer) => customer.status === "approved"
      ).length,
      averageDiscount,
      overdue,
      receivables,
    };
  }, [customersWithTier]);

  function clearFilters() {
    setQuery("");
    setTierFilter("all");
    setStatusFilter("all");
  }

  function updateSelectedTier(tier: CustomerTier) {
    if (!selectedCustomer) {
      return;
    }

    setTierByCustomer((current) => ({
      ...current,
      [selectedCustomer.id]: tier,
    }));
  }

  if (!selectedCustomer) {
    return (
      <section className="min-w-0 space-y-4 overflow-x-hidden text-slate-950">
        <Card className="border-slate-200 bg-white">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <div className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <Users className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">Nessun cliente disponibile</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Collega o crea clienti B2B in Supabase per popolare gestione clienti,
                listini, ordini e RMA.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const selectedTier = selectedCustomer.priceList;
  const selectedTierRule = getTierRule(selectedTier);
  const totalSpend = selectedOrders.reduce((total, order) => total + order.total, 0);
  const selectedLastOrder = selectedOrders[0];
  const availableCredit = Math.max(
    0,
    selectedCustomer.creditLimit - selectedCustomer.receivables
  );
  const creditUsage =
    selectedCustomer.creditLimit > 0
      ? Math.min(100, (selectedCustomer.receivables / selectedCustomer.creditLimit) * 100)
      : 0;
  const hasFilters =
    Boolean(query.trim()) || tierFilter !== "all" || statusFilter !== "all";

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
              Anagrafica B2B, listini, storico ordini e credito commerciale
            </CardDescription>
          </div>
          <div className="flex w-full min-w-0 flex-wrap gap-2 lg:w-auto lg:justify-end">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 bg-white pl-9"
                placeholder="Cerca cliente, P.IVA, città"
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
          </div>
        </CardHeader>
        <CardContent className="min-w-0 p-3 sm:p-6">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-700">
                  {filteredCustomers.length} clienti
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
                    const lastOrder = latestOrderFor(customer.name);
                    const isSelected = customer.id === selectedCustomer.id;

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
                              className={cn(
                                "border",
                                tierBadgeClass(customer.priceList)
                              )}
                            >
                              {customer.priceList}
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
                        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 md:hidden">
                          {customer.overdue > 0 && (
                            <span className="text-amber-700">
                              Scaduto {formatEuro(customer.overdue)}
                            </span>
                          )}
                          {customer.receivables > 0 && customer.overdue === 0 && (
                            <span>Aperto {formatEuro(customer.receivables)}</span>
                          )}
                          <span>
                            Ultimo {lastOrder ? `${lastOrder.date} · ${formatEuro(lastOrder.total)}` : "nessuno"}
                          </span>
                        </div>
                        <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                          <span className="min-w-0 break-words">
                            {lastOrder
                              ? `${lastOrder.id} · ${formatEuro(lastOrder.total)}`
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
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm font-medium text-slate-500">
                  Nessun cliente corrisponde ai filtri.
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-4">
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
                          {selectedTierRule.tagLabel} · coeff.{" "}
                          {tierMultiplier(selectedTier).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Select
                      value={selectedTier}
                      onValueChange={(value) =>
                        updateSelectedTier(value as CustomerTier)
                      }
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tiers.map((tier) => (
                          <SelectItem key={tier} value={tier}>
                            {tier} · {getTierRule(tier).tagLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="mt-4 grid gap-2 md:hidden">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                    <span className="font-bold text-slate-900">Referente</span>{" "}
                    {selectedCustomer.contactName} · {selectedCustomer.email}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                    <span className="font-bold text-slate-900">Owner</span>{" "}
                    {selectedCustomer.accountOwner} · ultimo contatto {selectedCustomer.lastContact}
                  </div>
                </div>

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
                        product={sampleProducts[0] ?? products[0]}
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
                      {sampleProducts.map((product) => (
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
                          {sampleProducts.map((product) => (
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
                              <TableCell>{formatTierDiscount(selectedTier)}</TableCell>
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
        {formatTierDiscount(tier)} · coeff. {tierMultiplier(tier).toFixed(2)}
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
          {formatTierDiscount(tier)} · coeff. {tierMultiplier(tier).toFixed(2)}
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
          orders.map((order) => (
            <OrderHistoryCard key={order.id} order={order} />
          ))
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
                        {order.date} · {order.channel} · {order.items} righe
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
            {order.date} · {order.channel} · {order.items} righe
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
          {rmas.length} RMA · {rmaRate.toFixed(1)}%
        </Badge>
      </div>
      <div className="mt-4 space-y-2 md:hidden">
        {rmas.length > 0 ? (
          rmas.map((request) => (
            <RmaHistoryCard key={request.id} request={request} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm font-medium text-slate-500">
            Nessuna pratica RMA collegata agli ordini cliente.
          </div>
        )}
      </div>
      <div className="mt-4 hidden space-y-3 md:block">
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
                <Badge
                  className={cn("shrink-0 border", rmaBadgeClass(request.status))}
                >
                  {rmaStatusLabel(request.status)}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600">
                <div className="flex min-w-0 items-center gap-2">
                  <PackageCheck className="size-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 break-words">
                    {request.orderId} · {request.sku} · {request.createdAt}
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

function RmaHistoryCard({ request }: { request: CustomerRma }) {
  return (
    <details className="group min-w-0 rounded-lg border border-slate-200 bg-slate-50">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="break-all font-mono text-xs font-bold text-slate-700">
            {request.id}
          </div>
          <div className="mt-1 break-words text-sm font-black leading-tight text-slate-900">
            {request.productName}
          </div>
        </div>
        <Badge className={cn("shrink-0 border", rmaBadgeClass(request.status))}>
          {rmaStatusLabel(request.status)}
        </Badge>
      </summary>
      <div className="grid gap-2 border-t border-slate-200 p-3 text-xs text-slate-600">
        <div className="flex min-w-0 items-center gap-2 rounded-md bg-white px-2 py-1.5">
          <PackageCheck className="size-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0 break-words">
            {request.orderId} · {request.sku} · {request.createdAt}
          </span>
        </div>
        <div className="break-words rounded-md bg-white px-2 py-1.5">
          {request.reason}
        </div>
        <div className="break-words rounded-md bg-white px-2 py-1.5 font-semibold">
          {request.resolution}
        </div>
      </div>
    </details>
  );
}

function latestOrderFor(company: string) {
  return customerOrders
    .filter((order) => order.company === company)
    .sort((a, b) => parseItalianDate(b.date) - parseItalianDate(a.date))[0];
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

function parseItalianDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);

  return new Date(year, month - 1, day).getTime();
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
