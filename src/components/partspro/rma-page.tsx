"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageSearch,
  RotateCcw,
  Send,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { rmaRequests } from "@/lib/partspro-data";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { cn } from "@/lib/utils";
import {
  rmaReasonLabel,
  rmaResolutionLabel,
  rmaStatusLabel,
  tx,
  txFormat,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import { useT } from "./i18n-provider";
import { StoreHeader } from "./store-header";

const rmaReasons = [
  "Difetto display / touch",
  "Batteria non conforme",
  "Connettore danneggiato",
  "Prodotto errato",
  "Danno da trasporto",
];

type RmaFormState = {
  orderId: string;
  orderLineId: string;
  sku: string;
  quantity: string;
  reason: string;
  description: string;
};

type RmaResult = {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  status: string;
  reason: string;
  createdAt: string;
  resolution: string;
};

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string; request: RmaResult }
  | { status: "error"; message: string };

export function RmaPage({
  initialAccountAccess,
}: {
  initialAccountAccess?: StoreHeaderAccountAccess;
}) {
  const t = useT();
  const [form, setForm] = React.useState<RmaFormState>({
    orderId: "",
    orderLineId: "",
    sku: "",
    quantity: "1",
    reason: rmaReasons[0],
    description: "",
  });
  const [evidenceCount, setEvidenceCount] = React.useState(0);
  const [submitState, setSubmitState] = React.useState<SubmitState>({
    status: "idle",
    message: tx(
      t,
      "storefront.rma.submit.idle",
      "Compila i dati e invia la richiesta al flusso RMA."
    ),
  });
  const visibleRequests =
    submitState.status === "success"
      ? [submitState.request, ...rmaRequests]
      : rmaRequests;

  function updateField<Key extends keyof RmaFormState>(
    key: Key,
    value: RmaFormState[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    if (submitState.status === "error" || submitState.status === "success") {
      setSubmitState({
        status: "idle",
        message: tx(
          t,
          "storefront.rma.submit.changed",
          "Modifiche locali pronte. Invia di nuovo per creare una nuova RMA."
        ),
      });
    }
  }

  async function submitRma(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setSubmitState({
        status: "error",
        message: tx(
          t,
          "storefront.rma.submit.invalidQuantity",
          "Inserisci una quantità valida, almeno 1 pezzo."
        ),
      });
      return;
    }

    setSubmitState({
      status: "loading",
      message: tx(
        t,
        "storefront.rma.submit.loading",
        "Invio richiesta RMA in corso..."
      ),
    });

    try {
      const response = await fetch("/api/rma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: form.orderId,
          ...(form.orderLineId ? { orderLineId: form.orderLineId } : {}),
          sku: form.sku.trim().toUpperCase(),
          quantity,
          reason: form.reason,
          description: form.description.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: RmaResult;
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Richiesta RMA non accettata.");
      }

      if (!payload?.data?.id || !payload.data.status) {
        throw new Error("Risposta RMA incompleta. Controlla l'API /api/rma.");
      }

      setSubmitState({
        status: "success",
        message: txFormat(
          t,
          "storefront.rma.submit.success",
          "Richiesta {id} registrata correttamente.",
          { id: payload.data.id }
        ),
        request: payload.data,
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error
          ? error.message
          : tx(t, "storefront.rma.submit.error", "Errore durante l'invio RMA."),
      });
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader initialAccountAccess={initialAccountAccess} />
      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
            <Badge className="mb-3 border border-primary/20 bg-primary/8 text-primary">
              {tx(t, "storefront.rma.badge", "RMA tracciabile")}
            </Badge>
            <h1 className="text-3xl font-black tracking-normal md:text-4xl">
              {tx(
                t,
                "storefront.rma.title",
                "Apri una richiesta di reso o sostituzione"
              )}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {tx(
                t,
                "storefront.rma.description",
                "Collega la richiesta a un ordine, descrivi il difetto e prepara foto o video per velocizzare la verifica del laboratorio."
              )}
            </p>
          </div>

          <Card className="border-slate-200 bg-white">
            <form onSubmit={submitRma}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="size-5 text-primary" />
                  {tx(t, "storefront.rma.form.title", "Nuova richiesta RMA")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label={tx(t, "storefront.rma.form.order", "Ordine")} htmlFor="rma-order">
                  <Input
                    id="rma-order"
                    value={form.orderId}
                    onChange={(event) => updateField("orderId", event.target.value)}
                    required
                    maxLength={80}
                    placeholder={tx(
                      t,
                      "storefront.rma.form.orderPlaceholder",
                      "Numero ordine reale"
                    )}
                  />
                </Field>
                <Field
                  label={tx(t, "storefront.rma.form.orderLine", "Riga ordine")}
                  htmlFor="rma-order-line"
                >
                  <Input
                    id="rma-order-line"
                    value={form.orderLineId}
                    onChange={(event) => updateField("orderLineId", event.target.value)}
                    maxLength={80}
                    required
                    placeholder={tx(
                      t,
                      "storefront.rma.form.orderLinePlaceholder",
                      "ID riga ordine dallo storico ordini"
                    )}
                  />
                </Field>
                <Field label="SKU" htmlFor="rma-sku">
                  <Input
                    id="rma-sku"
                    value={form.sku}
                    onChange={(event) => updateField("sku", event.target.value)}
                    autoCapitalize="characters"
                    required
                    maxLength={64}
                  />
                </Field>
                <Field label={tx(t, "storefront.rma.form.reason", "Motivo RMA")} htmlFor="rma-reason">
                  <Select
                    value={form.reason}
                    onValueChange={(value) => updateField("reason", value)}
                  >
                    <SelectTrigger id="rma-reason" className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rmaReasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {rmaReasonLabel(t, reason)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={tx(t, "storefront.rma.form.quantity", "Quantità")} htmlFor="rma-quantity">
                  <Input
                    id="rma-quantity"
                    type="number"
                    value={form.quantity}
                    onChange={(event) => updateField("quantity", event.target.value)}
                    min={1}
                    max={999}
                    required
                  />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="rma-description">
                    {tx(t, "storefront.rma.form.description", "Descrizione problema")}
                  </Label>
                  <Textarea
                    id="rma-description"
                    className="min-h-28"
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value)}
                    minLength={10}
                    maxLength={1000}
                    required
                    placeholder={tx(
                      t,
                      "storefront.rma.form.descriptionPlaceholder",
                      "Indica test effettuati, sintomi, modello dispositivo e condizioni del ricambio..."
                    )}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label
                    htmlFor="rma-evidence"
                    className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-600 transition hover:border-primary/40 hover:bg-primary/8"
                  >
                    <Upload className="size-5 text-primary" />
                    {tx(t, "storefront.rma.form.evidence", "Carica foto o video del difetto")}
                    <span className="text-xs font-normal text-slate-500">
                      {tx(
                        t,
                        "storefront.rma.form.evidenceHint",
                        "JPG, PNG o MP4 fino a 20MB. I file restano come anteprima locale."
                      )}
                    </span>
                  </Label>
                  <input
                    id="rma-evidence"
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,video/mp4"
                    multiple
                    onChange={(event) => setEvidenceCount(event.target.files?.length ?? 0)}
                  />
                  <div className="text-xs font-semibold text-slate-500" aria-live="polite">
                    {evidenceCount > 0
                      ? txFormat(
                        t,
                        "storefront.rma.form.evidenceSelected",
                        "{count} file selezionati solo come anteprima locale.",
                        { count: evidenceCount }
                      )
                      : tx(
                        t,
                        "storefront.rma.form.evidenceEmpty",
                        "Nessun file selezionato. L'API riceve solo i dati RMA."
                      )}
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-11 sm:col-span-2"
                  disabled={submitState.status === "loading"}
                >
                  {submitState.status === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {submitState.status === "loading"
                    ? tx(t, "storefront.rma.submit.buttonLoading", "Invio RMA...")
                    : tx(t, "storefront.rma.submit.button", "Invia richiesta RMA")}
                </Button>
                <RmaSubmitStatus state={submitState} t={t} />
              </CardContent>
            </form>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>{tx(t, "storefront.rma.recent.title", "Richieste recenti")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleRequests.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  {tx(t, "storefront.rma.recent.empty", "Nessuna richiesta RMA registrata.")}
                </div>
              )}
              {visibleRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black">{request.id}</span>
                      <Badge className={cn("border", rmaBadgeClass(request.status))}>
                        {rmaStatusLabel(t, request.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-bold">{request.productName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {request.orderId} · {request.sku} · {request.createdAt}
                    </div>
                    <div className="mt-2 break-words text-sm text-slate-600">
                      {rmaReasonLabel(t, request.reason)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600 md:max-w-[220px]">
                    {rmaResolutionLabel(t, request.resolution)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="border-slate-200 bg-white lg:sticky lg:top-32">
            <CardHeader>
              <CardTitle>{tx(t, "storefront.rma.rules.title", "Regole RMA")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  icon: ClipboardCheck,
                  title: tx(t, "storefront.rma.rules.order.title", "Collega sempre l'ordine"),
                  body: tx(
                    t,
                    "storefront.rma.rules.order.body",
                    "Le richieste senza numero ordine non possono essere validate automaticamente."
                  ),
                },
                {
                  icon: Camera,
                  title: tx(t, "storefront.rma.rules.photo.title", "Foto prima del reso"),
                  body: tx(
                    t,
                    "storefront.rma.rules.photo.body",
                    "Carica immagini del difetto e del sigillo qualità prima della spedizione."
                  ),
                },
                {
                  icon: PackageSearch,
                  title: tx(t, "storefront.rma.rules.lab.title", "Verifica laboratorio"),
                  body: tx(
                    t,
                    "storefront.rma.rules.lab.body",
                    "Il team controlla il ricambio e aggiorna lo stato nella tua area account."
                  ),
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <item.icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-black">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-black">
                  <AlertTriangle className="size-4" />
                  {tx(t, "storefront.rma.rules.noteTitle", "Nota")}
                </div>
                <p className="mt-1 leading-6">
                  {tx(
                    t,
                    "storefront.rma.rules.noteBody",
                    "I danni da installazione o liquidi possono essere esclusi dalla sostituzione automatica."
                  )}
                </p>
              </div>
              <Button asChild variant="outline" className="w-full bg-white">
                <Link href="/account">
                  <CheckCircle2 className="size-4" />
                  {tx(t, "storefront.rma.backToAccount", "Torna all'account")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function RmaSubmitStatus({
  state,
  t,
}: {
  state: SubmitState;
  t: StorefrontTranslator;
}) {
  const toneClass =
    state.status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : state.status === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div
      className={`rounded-lg border p-4 text-sm sm:col-span-2 ${toneClass}`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {state.status === "loading" && <Loader2 className="mt-0.5 size-4 animate-spin" />}
        {state.status === "success" && <CheckCircle2 className="mt-0.5 size-4" />}
        {state.status === "error" && <AlertTriangle className="mt-0.5 size-4" />}
        <div className="min-w-0">
          <div className="font-black">{state.message}</div>
          {state.status === "success" && (
            <div className="mt-2 grid gap-2 rounded-lg border border-emerald-200 bg-white/70 p-3 text-xs font-semibold text-emerald-900 sm:grid-cols-2">
              <ResultInfo
                label={tx(t, "storefront.rma.result.number", "Numero RMA")}
                value={state.request.id}
                mono
              />
              <ResultInfo
                label={tx(t, "storefront.rma.result.status", "Stato")}
                value={rmaStatusLabel(t, state.request.status)}
              />
              <ResultInfo
                label={tx(t, "storefront.rma.result.order", "Ordine")}
                value={state.request.orderId}
                mono
              />
              <ResultInfo label="SKU" value={state.request.sku} mono />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultInfo({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase text-emerald-700">{label}</div>
      <div className={cn("mt-0.5 break-words font-black", mono && "font-mono")}>{value}</div>
    </div>
  );
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
