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
import { cn } from "@/lib/utils";
import { StoreHeader } from "./store-header";

const rmaReasons = [
  "Difetto display / touch",
  "Batteria non conforme",
  "Connettore danneggiato",
  "Prodotto errato",
  "Danno da trasporto",
];

const orderOptions = [
  {
    orderId: "ORD-2026-0566",
    orderLineId: "11111111-1111-4111-8111-111111111111",
    sku: "IP13P-OLED-A+",
  },
  {
    orderId: "ORD-2026-0567",
    orderLineId: "11111111-1111-4111-8111-111111111113",
    sku: "USB-C-DOCK",
  },
  {
    orderId: "ORD-2026-0567",
    orderLineId: "11111111-1111-4111-8111-111111111114",
    sku: "PXR-LCD",
  },
] as const;

const initialOrderOption = orderOptions[0];

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

export function RmaPage() {
  const [form, setForm] = React.useState<RmaFormState>({
    orderId: initialOrderOption.orderId,
    orderLineId: initialOrderOption.orderLineId,
    sku: initialOrderOption.sku,
    quantity: "1",
    reason: rmaReasons[0],
    description: "",
  });
  const [evidenceCount, setEvidenceCount] = React.useState(0);
  const [submitState, setSubmitState] = React.useState<SubmitState>({
    status: "idle",
    message: "Compila i dati e invia la richiesta al flusso RMA.",
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
        message: "Modifiche locali pronte. Invia di nuovo per creare una nuova RMA.",
      });
    }
  }

  function updateOrder(value: string) {
    const selected = orderOptions.find((option) => option.orderLineId === value);

    if (!selected) {
      return;
    }

    setForm((current) => ({
      ...current,
      orderId: selected.orderId,
      orderLineId: selected.orderLineId,
      sku: selected.sku,
    }));

    if (submitState.status === "error" || submitState.status === "success") {
      setSubmitState({
        status: "idle",
        message: "Modifiche locali pronte. Invia di nuovo per creare una nuova RMA.",
      });
    }
  }

  async function submitRma(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setSubmitState({
        status: "error",
        message: "Inserisci una quantità valida, almeno 1 pezzo.",
      });
      return;
    }

    setSubmitState({
      status: "loading",
      message: "Invio richiesta RMA in corso...",
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
        message: `Richiesta ${payload.data.id} registrata correttamente.`,
        request: payload.data,
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error ? error.message : "Errore durante l'invio RMA.",
      });
    }
  }

  return (
    <main className="min-h-screen text-slate-950">
      <StoreHeader />
      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
            <Badge className="mb-3 border border-primary/20 bg-primary/8 text-primary">
              RMA tracciabile
            </Badge>
            <h1 className="text-3xl font-black tracking-normal md:text-4xl">
              Apri una richiesta di reso o sostituzione
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Collega la richiesta a un ordine, descrivi il difetto e prepara foto
              o video per velocizzare la verifica del laboratorio.
            </p>
          </div>

          <Card className="border-slate-200 bg-white">
            <form onSubmit={submitRma}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="size-5 text-primary" />
                  Nuova richiesta RMA
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Ordine" htmlFor="rma-order">
                  <Select
                    value={form.orderLineId}
                    onValueChange={updateOrder}
                  >
                    <SelectTrigger id="rma-order" className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {orderOptions.map((option) => (
                        <SelectItem key={option.orderLineId} value={option.orderLineId}>
                          {option.orderId} · {option.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Field label="Motivo RMA" htmlFor="rma-reason">
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
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quantità" htmlFor="rma-quantity">
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
                  <Label htmlFor="rma-description">Descrizione problema</Label>
                  <Textarea
                    id="rma-description"
                    className="min-h-28"
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value)}
                    minLength={10}
                    maxLength={1000}
                    required
                    placeholder="Indica test effettuati, sintomi, modello dispositivo e condizioni del ricambio..."
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label
                    htmlFor="rma-evidence"
                    className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-600 transition hover:border-primary/40 hover:bg-primary/8"
                  >
                    <Upload className="size-5 text-primary" />
                    Carica foto o video del difetto
                    <span className="text-xs font-normal text-slate-500">
                      JPG, PNG o MP4 fino a 20MB. I file restano locali nella demo.
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
                      ? `${evidenceCount} file selezionati solo come anteprima locale.`
                      : "Nessun file selezionato. L'API riceve solo i dati RMA."}
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
                  {submitState.status === "loading" ? "Invio RMA..." : "Invia richiesta RMA"}
                </Button>
                <RmaSubmitStatus state={submitState} />
              </CardContent>
            </form>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Richieste recenti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black">{request.id}</span>
                      <Badge className={cn("border", rmaBadgeClass(request.status))}>
                        {rmaStatusLabel(request.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-bold">{request.productName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {request.orderId} · {request.sku} · {request.createdAt}
                    </div>
                    <div className="mt-2 break-words text-sm text-slate-600">
                      {request.reason}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600 md:max-w-[220px]">
                    {request.resolution}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="border-slate-200 bg-white lg:sticky lg:top-32">
            <CardHeader>
              <CardTitle>Regole RMA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  icon: ClipboardCheck,
                  title: "Collega sempre l'ordine",
                  body: "Le richieste senza numero ordine non possono essere validate automaticamente.",
                },
                {
                  icon: Camera,
                  title: "Foto prima del reso",
                  body: "Carica immagini del difetto e del sigillo qualità prima della spedizione.",
                },
                {
                  icon: PackageSearch,
                  title: "Verifica laboratorio",
                  body: "Il team controlla il ricambio e aggiorna lo stato nella tua area account.",
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
                  Nota
                </div>
                <p className="mt-1 leading-6">
                  I danni da installazione o liquidi possono essere esclusi dalla
                  sostituzione automatica.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full bg-white">
                <Link href="/account">
                  <CheckCircle2 className="size-4" />
                  Torna all&apos;account
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

function RmaSubmitStatus({ state }: { state: SubmitState }) {
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
              <ResultInfo label="Numero RMA" value={state.request.id} mono />
              <ResultInfo label="Stato" value={rmaStatusLabel(state.request.status)} />
              <ResultInfo label="Ordine" value={state.request.orderId} mono />
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
