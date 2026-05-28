"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  FileText,
  Filter,
  Loader2,
  Package,
  RotateCcw,
  Truck,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  formatEuro,
  type CompanyProfile,
  type OrderSummary,
  type RmaRequest,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import type { AccountCustomerProfile } from "@/lib/partspro-repository";
import { useCart } from "./cart-state";
import { StoreHeader } from "./store-header";

type AccountPageProps = {
  company?: CompanyProfile | null;
  customerProfile?: AccountCustomerProfile | null;
  dataWarning?: string;
  forceSetup?: boolean;
  orderSummaries?: OrderSummary[];
  rmaRequests?: RmaRequest[];
  userEmail?: string;
};

type AccountOrderDetailLine = {
  id: string;
  lineTotal: number;
  name?: string;
  productName?: string;
  quantity: number;
  sku: string;
  unitPrice: number;
};

type AccountOrderDetailEvent = {
  action?: string;
  createdAt: string;
  eventType?: string;
  id: string;
  note?: string;
};

type AccountOrderDetail = {
  createdAt: string;
  id: string;
  items: number;
  lines?: AccountOrderDetailLine[];
  number: string;
  operationHistory?: AccountOrderDetailEvent[];
  paymentStatus: string;
  status: string;
  total: number;
  uiStatus?: string;
};

type AccountOrderDetailResponse = {
  data: AccountOrderDetail;
};

type AccountProfilePayload = {
  billingAddress: string;
  companyName: string;
  contactName: string;
  email: string;
  fiscalCode: string;
  pec: string;
  phone: string;
  sdi: string;
  shippingAddress: string;
  vatNumber: string;
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
  customerProfile = null,
  dataWarning,
  forceSetup = false,
  orderSummaries = [],
  rmaRequests = [],
  userEmail,
}: AccountPageProps) {
  const cart = useCart();
  const [activeFilter, setActiveFilter] = React.useState<OrderFilterId>("all");
  const [orderDetail, setOrderDetail] = React.useState<AccountOrderDetail | null>(null);
  const [orderDetailError, setOrderDetailError] = React.useState<string | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = React.useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = React.useState(false);
  const [savedProfile, setSavedProfile] = React.useState<AccountCustomerProfile | null>(null);
  const profile =
    savedProfile && (!customerProfile || savedProfile.id === customerProfile.id)
      ? savedProfile
      : customerProfile;
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(() =>
    Boolean(customerProfile && (forceSetup || !customerProfile.profileCompletedAt))
  );

  const selectedFilter =
    orderFilters.find((filter) => filter.id === activeFilter) ?? orderFilters[0];
  const filteredOrders = orderSummaries.filter(selectedFilter.predicate);
  const shouldShowProfileNotice = Boolean(profile && !profile.profileCompletedAt);
  const metrics = [
    [
      "Ordini aperti",
      String(orderSummaries.filter((order) => !["delivered", "cancelled"].includes(order.status)).length),
      Package,
    ],
    ["Spedizioni", String(orderSummaries.filter((order) => order.status === "shipped").length), Truck],
    ["RMA attivi", String(rmaRequests.length), RotateCcw],
  ] as const;

  async function openOrderDetail(order: OrderSummary) {
    setOrderDetailOpen(true);
    setOrderDetail(null);
    setOrderDetailError(null);
    setOrderDetailLoading(true);

    try {
      const payload = await fetchJson<AccountOrderDetailResponse>(
        `/api/account/orders/${encodeURIComponent(order.id)}`
      );

      setOrderDetail(payload.data);
    } catch (error) {
      setOrderDetailError(
        error instanceof Error ? error.message : "Dettaglio ordine non disponibile."
      );
    } finally {
      setOrderDetailLoading(false);
    }
  }

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
              {profile ? (
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white"
                  onClick={() => setProfileDialogOpen(true)}
                >
                  Dati centro personale
                </Button>
              ) : null}
              <form action={signOut} onSubmit={cart.clearCart}>
                <Button variant="outline" className="w-full bg-white" type="submit">
                  Esci
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          {shouldShowProfileNotice && profile ? (
            <AccountProfileNotice
              forceSetup={forceSetup}
              profile={profile}
              onOpen={() => setProfileDialogOpen(true)}
            />
          ) : null}

          {dataWarning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              {dataWarning}
            </div>
          ) : null}

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
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-0 bg-white sm:mt-2"
                      onClick={() => void openOrderDetail(order)}
                    >
                      Dettagli
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {orderDetail?.number ?? orderDetail?.id ?? "Dettaglio ordine"}
                </DialogTitle>
                <DialogDescription>
                  {orderDetail?.createdAt ?? "Riepilogo righe, stato e attivita ordine."}
                </DialogDescription>
              </DialogHeader>
              <AccountOrderDetailPanel
                detail={orderDetail}
                error={orderDetailError}
                loading={orderDetailLoading}
              />
            </DialogContent>
          </Dialog>

          {profile ? (
            <AccountProfileDialog
              open={profileDialogOpen}
              profile={profile}
              userEmail={userEmail}
              onOpenChange={setProfileDialogOpen}
              onSaved={setSavedProfile}
            />
          ) : null}

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

function AccountOrderDetailPanel({
  detail,
  error,
  loading,
}: {
  detail: AccountOrderDetail | null;
  error: string | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Caricamento dettaglio ordine...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
        Nessun dettaglio ordine disponibile.
      </div>
    );
  }

  const lines = detail.lines ?? [];
  const events = detail.operationHistory ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <DetailTile label="Stato" value={orderStatusLabel(detail.uiStatus ?? detail.status)} />
        <DetailTile label="Pagamento" value={paymentStatusLabel(detail.paymentStatus)} />
        <DetailTile label="Totale" value={formatEuro(detail.total)} />
      </div>

      <section className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-100 px-3 py-2 text-sm font-black">
          Righe ordine
        </div>
        {lines.length === 0 ? (
          <div className="p-3 text-sm font-semibold text-slate-500">
            Nessuna riga disponibile.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lines.map((line) => (
              <div key={line.id} className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="truncate font-black">{line.productName ?? line.name ?? line.sku}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{line.sku}</div>
                </div>
                <div className="text-right">
                  <div className="font-black">{formatEuro(line.lineTotal)}</div>
                  <div className="text-xs font-semibold text-slate-500">
                    {line.quantity} x {formatEuro(line.unitPrice)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-100 px-3 py-2 text-sm font-black">
          Attivita ordine
        </div>
        {events.length === 0 ? (
          <div className="p-3 text-sm font-semibold text-slate-500">
            Nessuna attivita registrata.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {events.map((event) => (
              <li key={event.id} className="px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black">{event.action ?? event.eventType ?? "Evento"}</span>
                  <span className="text-xs text-slate-500">{event.createdAt}</span>
                </div>
                {event.note ? (
                  <p className="mt-1 text-xs font-semibold text-slate-500">{event.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-800">{value}</div>
    </div>
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

function AccountProfileNotice({
  forceSetup,
  onOpen,
  profile,
}: {
  forceSetup: boolean;
  onOpen: () => void;
  profile: AccountCustomerProfile;
}) {
  const missingFields = [
    profile.companyName ? null : "azienda",
    profile.contactName ? null : "referente",
    profile.email ? null : "email",
    profile.phone ? null : "telefono",
    profile.billingAddress ? null : "fatturazione",
    profile.shippingAddress ? null : "spedizione",
    profile.vatNumber || profile.fiscalCode ? null : "P.IVA o codice fiscale",
  ].filter(Boolean);
  const isPending = profile.status === "pending";

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="flex flex-col gap-3 p-4 text-sm text-amber-950 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-black">
            {forceSetup ? "Completa i dati account" : "Profilo cliente in revisione"}
          </div>
          <p className="mt-1 leading-6">
            {isPending
              ? "Il tuo account e registrato. Completa i dati: lo staff potra chiudere la revisione senza bloccare la navigazione."
              : "Completa l'anagrafica cliente per sbloccare checkout, documenti e gestione ordini."}
          </p>
          {missingFields.length > 0 ? (
            <div className="mt-2 text-xs font-bold">
              Da completare: {missingFields.join(", ")}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-amber-300 bg-white"
          onClick={onOpen}
        >
          Rivedi dati
        </Button>
      </CardContent>
    </Card>
  );
}

function AccountProfileDialog({
  onOpenChange,
  onSaved,
  open,
  profile,
  userEmail,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: AccountCustomerProfile) => void;
  open: boolean;
  profile: AccountCustomerProfile;
  userEmail?: string;
}) {
  const [form, setForm] = React.useState<AccountProfilePayload>(() =>
    accountProfileToForm(profile, userEmail)
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const wasOpenRef = React.useRef(open);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm(accountProfileToForm(profile, userEmail));
      setError(null);
    }

    wasOpenRef.current = open;
  }, [open, profile, userEmail]);

  function updateField(field: keyof AccountProfilePayload, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload = await fetchJson<{ data: AccountCustomerProfile }>("/api/account/profile", {
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      onSaved(payload.data);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Non e stato possibile salvare il profilo."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/10 backdrop-blur-xs"
        onClick={() => onOpenChange(false)}
      />
      <div
        aria-labelledby="account-profile-title"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 grid max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl bg-white p-4 text-sm text-slate-950 shadow-2xl ring-1 ring-slate-200"
        role="dialog"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-2 top-2"
          aria-label="Chiudi"
          onClick={() => onOpenChange(false)}
        >
          x
        </Button>
        <div className="flex flex-col gap-2 pr-10">
          <h2 id="account-profile-title" className="text-base font-black">
            Completa il centro personale
          </h2>
          <p className="text-sm text-slate-500">
            Questi dati collegano account, ordini, fatturazione e spedizioni.
          </p>
        </div>
        <form className="space-y-4" onSubmit={submitProfile}>
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileInput
              field="companyName"
              label="Nome cliente"
              required
              value={form.companyName}
              onChange={updateField}
            />
            <ProfileInput
              field="contactName"
              label="Referente"
              required
              value={form.contactName}
              onChange={updateField}
            />
            <ProfileInput
              field="email"
              label="Email"
              disabled
              required
              type="email"
              value={form.email}
              onChange={updateField}
            />
            <ProfileInput
              field="phone"
              label="Telefono"
              required
              value={form.phone}
              onChange={updateField}
            />
            <ProfileInput
              field="vatNumber"
              label="Partita IVA"
              value={form.vatNumber}
              onChange={updateField}
            />
            <ProfileInput
              field="fiscalCode"
              label="Codice fiscale"
              value={form.fiscalCode}
              onChange={updateField}
            />
            <ProfileInput
              field="pec"
              label="PEC"
              type="email"
              value={form.pec}
              onChange={updateField}
            />
            <ProfileInput
              field="sdi"
              label="Codice SDI"
              value={form.sdi}
              onChange={updateField}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileTextarea
              field="billingAddress"
              label="Indirizzo fatturazione"
              required
              value={form.billingAddress}
              onChange={updateField}
            />
            <ProfileTextarea
              field="shippingAddress"
              label="Indirizzo spedizione"
              required
              value={form.shippingAddress}
              onChange={updateField}
            />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800">
            Serve almeno una Partita IVA o un codice fiscale. Dopo il salvataggio il
            profilo rimane in revisione finche un amministratore non assegna tipo e
            livello cliente.
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvataggio
                </>
              ) : (
                "Salva profilo"
              )}
            </Button>
          </DialogFooter>
        </form>
      </div>
    </div>
  );
}

function ProfileInput({
  field,
  disabled,
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  disabled?: boolean;
  field: keyof AccountProfilePayload;
  label: string;
  onChange: (field: keyof AccountProfilePayload, value: string) => void;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
  value: string;
}) {
  const id = `account-profile-${field}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-black text-slate-500">
        {label}
        {required ? " *" : null}
      </Label>
      <Input
        disabled={disabled}
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(field, event.currentTarget.value)}
      />
    </div>
  );
}

function ProfileTextarea({
  field,
  label,
  onChange,
  required,
  value,
}: {
  field: keyof AccountProfilePayload;
  label: string;
  onChange: (field: keyof AccountProfilePayload, value: string) => void;
  required?: boolean;
  value: string;
}) {
  const id = `account-profile-${field}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-black text-slate-500">
        {label}
        {required ? " *" : null}
      </Label>
      <Textarea
        id={id}
        className="min-h-24 resize-y"
        required={required}
        value={value}
        onChange={(event) => onChange(field, event.currentTarget.value)}
      />
    </div>
  );
}

function accountProfileToForm(
  profile: AccountCustomerProfile,
  userEmail?: string
): AccountProfilePayload {
  return {
    billingAddress: profile.billingAddress,
    companyName: profile.companyName,
    contactName: profile.contactName,
    email: userEmail || profile.email || "",
    fiscalCode: profile.fiscalCode,
    pec: profile.pec,
    phone: profile.phone,
    sdi: profile.sdi,
    shippingAddress: profile.shippingAddress,
    vatNumber: profile.vatNumber,
  };
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
  if (status === "shipped" || status === "delivered" || status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
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
    submitted: "Da pagare",
    accepted: "Accettato",
    picking: "In preparazione",
    packed: "Imballato",
    shipped: "Spedito",
    completed: "Consegnato",
    delivered: "Consegnato",
    cancelled: "Annullato",
  };

  return labels[status] ?? status;
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    bank_waiting: "Attesa banca",
    failed: "Fallito",
    paid: "Pagato",
    pending: "Da pagare",
    waiting_bank: "Attesa banca",
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload) ?? `${response.status}`);
  }

  return payload as T;
}

function readErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : null;
}
