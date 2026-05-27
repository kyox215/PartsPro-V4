"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  FileText,
  Filter,
  Package,
  RotateCcw,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  formatEuro,
  type CompanyProfile,
  type OrderSummary,
  type RmaRequest,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import { useCart } from "./cart-state";
import { StoreHeader } from "./store-header";

type AccountPageProps = {
  company?: CompanyProfile | null;
  orderSummaries?: OrderSummary[];
  rmaRequests?: RmaRequest[];
  userEmail?: string;
};

type OrderFilterId = "all" | "open" | "pending_payment" | "shipped" | "delivered";

const orderFilters: Array<{
  id: OrderFilterId;
  label: string;
  description: string;
  predicate: (order: OrderSummary) => boolean;
}> = [
  {
    id: "all",
    label: "Tutti",
    description: "Vista completa",
    predicate: () => true,
  },
  {
    id: "open",
    label: "Aperti",
    description: "Da evadere",
    predicate: (order) => !["delivered", "cancelled"].includes(order.status),
  },
  {
    id: "pending_payment",
    label: "Da pagare",
    description: "Pagamento",
    predicate: (order) => order.status === "pending_payment",
  },
  {
    id: "shipped",
    label: "Spediti",
    description: "Tracking",
    predicate: (order) => order.status === "shipped",
  },
  {
    id: "delivered",
    label: "Consegnati",
    description: "Storico",
    predicate: (order) => order.status === "delivered",
  },
];

export function AccountPage({
  company = null,
  orderSummaries = [],
  rmaRequests = [],
  userEmail,
}: AccountPageProps) {
  const cart = useCart();
  const [activeFilter, setActiveFilter] = React.useState<OrderFilterId>("all");
  const selectedFilter =
    orderFilters.find((filter) => filter.id === activeFilter) ?? orderFilters[0];
  const filteredOrders = orderSummaries.filter(selectedFilter.predicate);
  const metrics = [
    [
      "Ordini aperti",
      String(orderSummaries.filter((order) => !["delivered", "cancelled"].includes(order.status)).length),
      Package,
    ],
    ["Spedizioni", String(orderSummaries.filter((order) => order.status === "shipped").length), Truck],
    ["RMA attivi", String(rmaRequests.length), RotateCcw],
  ] as const;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader />
      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <AccountRuntimeCard userEmail={userEmail} />
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-5">
              {company ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                      <Building2 className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="truncate text-xl font-black">{company.name}</h1>
                      <div className="mt-1 text-sm text-slate-500">
                        {company.city} · {company.province}
                      </div>
                      <Badge className="mt-3 border border-emerald-200 bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="size-3" />
                        {companyStatusLabel(company.status)}
                      </Badge>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <Info label="Partita IVA" value={company.partitaIva} />
                  <Info label="Codice fiscale" value={company.codiceFiscale} />
                  <Info label="PEC" value={company.pec} />
                  <Info label="Codice destinatario" value={company.codiceDestinatario} />
                  <Info label="Listino" value={company.priceList} />
                  {userEmail && <Info label="Utente" value={userEmail} />}
                </>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="grid size-12 place-items-center rounded-full bg-amber-100 text-amber-700">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-black">Nessun profilo azienda</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Crea o collega un cliente in Supabase per mostrare dati account reali.
                    </p>
                    {userEmail && <Info label="Utente" value={userEmail} />}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Azioni rapide</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild>
                <Link href="/catalogo">Nuovo ordine</Link>
              </Button>
              <Button variant="outline" className="bg-white" asChild>
                <Link href="/rma">Apri richiesta RMA</Link>
              </Button>
              <form action={signOut} onSubmit={cart.clearCart}>
                <Button variant="outline" className="w-full bg-white" type="submit">
                  Esci
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {metrics.map(([label, value, Icon]) => (
              <Card key={label as string} className="border-slate-200 bg-white">
                <CardContent className="flex items-center gap-3 p-5">
                  <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-500">{label as string}</div>
                    <div className="text-3xl font-black">{value as string}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Filter className="size-5 text-primary" />
                  Ordini recenti
                </CardTitle>
                <div className="text-right text-xs font-semibold text-slate-500">
                  {filteredOrders.length} di {orderSummaries.length} ordini
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2" aria-label="Filtra ordini per stato">
                {orderFilters.map((filter) => {
                  const count = orderSummaries.filter(filter.predicate).length;
                  const isActive = filter.id === activeFilter;

                  return (
                    <Button
                      key={filter.id}
                      type="button"
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      className={cn(!isActive && "bg-white")}
                      aria-pressed={isActive}
                      title={filter.description}
                      onClick={() => setActiveFilter(filter.id)}
                    >
                      {filter.label}
                      <span className="font-mono text-xs">{count}</span>
                    </Button>
                  );
                })}
              </div>

              {filteredOrders.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Nessun ordine in questa vista. Cambia filtro per vedere gli
                  altri stati.
                </div>
              )}

              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black">{order.id}</span>
                      <Badge className={cn("border", orderBadgeClass(order.status))}>
                        {orderStatusLabel(order.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {order.date} · {order.items} articoli · {order.company}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                    <div className="text-lg font-black">{formatEuro(order.total)}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-0 bg-white sm:mt-2"
                      disabled
                      title="Dettaglio ordine non disponibile"
                    >
                      Dettagli
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="size-5 text-primary" />
                RMA e resi rapidi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rmaRequests.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Nessuna richiesta RMA collegata a questo account.
                </div>
              )}
              {rmaRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black">{request.id}</span>
                      <Badge className={cn("border", rmaBadgeClass(request.status))}>
                        {rmaStatusLabel(request.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 break-words text-sm font-bold">
                      {request.productName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {request.orderId} · {request.sku} · {request.createdAt}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="bg-white">
                    <Link href="/rma">Apri area RMA</Link>
                  </Button>
                </div>
              ))}
              <Button asChild className="w-full">
                <Link href="/rma">
                  <RotateCcw className="size-4" />
                  Nuova richiesta RMA
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                Documenti e fatture
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600 sm:col-span-2">
                Nessun documento disponibile.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function AccountRuntimeCard({
  userEmail,
}: {
  userEmail?: string;
}) {
  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardContent className="flex gap-3 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-black">Sessione Supabase attiva</div>
          <p className="mt-1 leading-6">
            Accesso verificato. I dati business vengono letti dal backend collegato.
          </p>
          {userEmail && <div className="mt-2 break-words text-xs font-bold">{userEmail}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function companyStatusLabel(status: CompanyProfile["status"]) {
  const labels: Record<CompanyProfile["status"], string> = {
    approved: "Cliente approvato",
    pending: "Profilo in revisione",
    rejected: "Profilo respinto",
    suspended: "Cliente sospeso",
  };

  return labels[status] ?? status;
}

function orderBadgeClass(status: string) {
  if (status === "shipped" || status === "delivered") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "pending_payment") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-primary/20 bg-primary/8 text-primary";
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Bozza",
    pending_payment: "Da pagare",
    paid: "Pagato",
    picking: "In preparazione",
    shipped: "Spedito",
    delivered: "Consegnato",
    cancelled: "Annullato",
  };

  return labels[status] ?? status;
}

function rmaBadgeClass(status: string) {
  if (status === "replaced" || status === "refunded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-primary/20 bg-primary/8 text-primary";
}

function rmaStatusLabel(status: string) {
  const labels: Record<string, string> = {
    requested: "Richiesta",
    approved: "Approvata",
    rejected: "Respinta",
    received: "Ricevuta",
    replaced: "Sostituita",
    refunded: "Rimborsata",
  };

  return labels[status] ?? status;
}
