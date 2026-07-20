"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RemaxImportPreview } from "@/lib/partspro-remax-import";
import type {
  AdminRemaxBatch,
  AdminRemaxDashboard,
  RemaxArrivalPreview,
} from "@/lib/partspro-remax-repository";
import { cn } from "@/lib/utils";

type RequestState = {
  message: string;
  status: "idle" | "loading" | "success" | "error";
};

type ImportSettingsForm = {
  batchCode: string;
  closeAt: string;
  etaEnd: string;
  etaStart: string;
  location: string;
  orderNo: string;
  supplierName: string;
  terms: string;
};

const initialSettings: ImportSettingsForm = {
  batchCode: "",
  closeAt: "",
  etaEnd: "",
  etaStart: "",
  location: "Milano",
  orderNo: "",
  supplierName: "REMAX",
  terms: "Preordine soggetto a conferma di arrivo. La data prevista è indicativa e può cambiare; la spedizione avverrà dopo l'arrivo e l'assegnazione della quantità.",
};

export function AdminRemaxCenter({
  initialDashboard,
  initialError,
}: {
  initialDashboard: AdminRemaxDashboard | null;
  initialError: string | null;
}) {
  const [dashboard, setDashboard] = React.useState<AdminRemaxDashboard | null>(initialDashboard);
  const [dashboardState, setDashboardState] = React.useState<RequestState>(() =>
    initialError
      ? { status: "error", message: initialError }
      : { status: "success", message: "Dati REMAX caricati." }
  );
  const [settings, setSettings] = React.useState(initialSettings);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<RemaxImportPreview | null>(null);
  const [previewState, setPreviewState] = React.useState<RequestState>({ status: "idle", message: "" });
  const [applyConfirmed, setApplyConfirmed] = React.useState(false);
  const [selectedBatchCode, setSelectedBatchCode] = React.useState("");
  const [receiptQuantities, setReceiptQuantities] = React.useState<Record<string, number>>({});
  const [arrivalPreview, setArrivalPreview] = React.useState<RemaxArrivalPreview | null>(null);
  const [arrivalIdempotencyKey, setArrivalIdempotencyKey] = React.useState("");
  const [arrivalConfirmed, setArrivalConfirmed] = React.useState(false);
  const [arrivalState, setArrivalState] = React.useState<RequestState>({ status: "idle", message: "" });

  const refreshDashboard = React.useCallback(async () => {
    setDashboardState({ status: "loading", message: "Aggiornamento dati REMAX..." });
    try {
      const response = await fetch("/api/admin/remax/summary", { cache: "no-store" });
      const payload = await readApiPayload<{ data?: AdminRemaxDashboard }>(response);
      if (!response.ok || !payload.data) throw new Error(apiMessage(payload));
      setDashboard(payload.data);
      setDashboardState({ status: "success", message: "Dati aggiornati." });
    } catch (error) {
      setDashboardState({ status: "error", message: errorMessage(error) });
    }
  }, []);

  const openBatches = React.useMemo(
    () => dashboard?.batches.filter((batch) => batch.remainingQty > 0 && ["open", "partially_received"].includes(batch.status)) ?? [],
    [dashboard]
  );
  const selectedBatch = openBatches.find((batch) => batch.batchCode === selectedBatchCode) ?? null;

  function updateSettings<Key extends keyof ImportSettingsForm>(key: Key, value: ImportSettingsForm[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setApplyConfirmed(false);
    setPreviewState({ status: "idle", message: "Dati modificati: esegui di nuovo il controllo." });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFile(event.currentTarget.files?.[0] ?? null);
    setPreview(null);
    setApplyConfirmed(false);
    setPreviewState({ status: "idle", message: "" });
  }

  async function previewImport() {
    if (!file) {
      setPreviewState({ status: "error", message: "Seleziona prima il file REMAX." });
      return;
    }

    setPreviewState({ status: "loading", message: "Controllo righe, prezzi e pubblicazione..." });
    try {
      const response = await fetch("/api/admin/remax/import/preview", {
        method: "POST",
        body: importFormData(file, settings),
      });
      const payload = await readApiPayload<{ data?: RemaxImportPreview }>(response);
      if (!response.ok || !payload.data) throw new Error(apiMessage(payload));
      setPreview(payload.data);
      setApplyConfirmed(false);
      setPreviewState({
        status: payload.data.counts.blocked > 0 ? "error" : "success",
        message: payload.data.counts.blocked > 0
          ? `Ci sono ${payload.data.counts.blocked} righe da correggere.`
          : "Controllo completato. Ora puoi confermare l'importazione.",
      });
    } catch (error) {
      setPreview(null);
      setPreviewState({ status: "error", message: errorMessage(error) });
    }
  }

  async function applyImport() {
    if (!file || !preview || !applyConfirmed || preview.counts.blocked > 0) return;
    setPreviewState({ status: "loading", message: "Creazione lotto e prodotti in corso..." });

    try {
      const body = importFormData(file, settings);
      body.set("previewHash", preview.previewHash);
      const response = await fetch("/api/admin/remax/import/apply", { method: "POST", body });
      const payload = await readApiPayload<{ data?: Record<string, unknown> }>(response);
      if (!response.ok || !payload.data) throw new Error(apiMessage(payload));
      setPreviewState({
        status: "success",
        message: `Lotto ${String(payload.data.batchCode ?? settings.batchCode)} importato. Le quantità sono ancora “in arrivo”, non stock fisico.`,
      });
      setPreview(null);
      setApplyConfirmed(false);
      await refreshDashboard();
    } catch (error) {
      setPreviewState({ status: "error", message: errorMessage(error) });
    }
  }

  function selectBatch(batchCode: string) {
    setSelectedBatchCode(batchCode);
    setArrivalPreview(null);
    setArrivalIdempotencyKey("");
    setArrivalConfirmed(false);
    setArrivalState({ status: "idle", message: "" });
    const batch = openBatches.find((item) => item.batchCode === batchCode);
    setReceiptQuantities(
      Object.fromEntries((batch?.lines ?? []).map((line) => [line.id, 0]))
    );
  }

  const receipts = React.useMemo(
    () => Object.entries(receiptQuantities)
      .filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0)
      .map(([lineId, quantity]) => ({ lineId, quantity })),
    [receiptQuantities]
  );

  async function previewArrival() {
    if (!selectedBatch || receipts.length === 0) {
      setArrivalState({ status: "error", message: "Inserisci almeno una quantità ricevuta." });
      return;
    }
    setArrivalState({ status: "loading", message: "Calcolo assegnazioni ai preordini..." });
    try {
      const response = await fetch("/api/admin/remax/arrivals/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchCode: selectedBatch.batchCode, receipts }),
      });
      const payload = await readApiPayload<{ data?: RemaxArrivalPreview }>(response);
      if (!response.ok || !payload.data) throw new Error(apiMessage(payload));
      setArrivalPreview(payload.data);
      setArrivalIdempotencyKey(`arrival:${selectedBatch.batchCode}:${crypto.randomUUID()}`);
      setArrivalConfirmed(false);
      setArrivalState({ status: "success", message: "Anteprima pronta. Controlla e conferma una sola volta." });
    } catch (error) {
      setArrivalPreview(null);
      setArrivalIdempotencyKey("");
      setArrivalState({ status: "error", message: errorMessage(error) });
    }
  }

  async function applyArrival() {
    if (!selectedBatch || !arrivalPreview || !arrivalConfirmed || !arrivalIdempotencyKey) return;
    setArrivalState({ status: "loading", message: "Registrazione arrivo e assegnazione FIFO..." });
    try {
      const response = await fetch("/api/admin/remax/arrivals/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchCode: selectedBatch.batchCode,
          idempotencyKey: arrivalIdempotencyKey,
          receipts,
          revision: arrivalPreview.revision,
        }),
      });
      const payload = await readApiPayload<{ data?: Record<string, unknown> }>(response);
      if (!response.ok || !payload.data) throw new Error(apiMessage(payload));
      setArrivalState({
        status: "success",
        message: `Arrivo registrato: ${String(payload.data.receivedQty ?? 0)} pezzi, ${String(payload.data.allocatedQty ?? 0)} assegnati ai preordini.`,
      });
      setArrivalPreview(null);
      setArrivalIdempotencyKey("");
      setArrivalConfirmed(false);
      setSelectedBatchCode("");
      setReceiptQuantities({});
      await refreshDashboard();
    } catch (error) {
      setArrivalState({ status: "error", message: errorMessage(error) });
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-3 py-4 text-slate-950 sm:px-5 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-3">
        <header className="rounded-xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-950 via-purple-900 to-indigo-900 p-4 text-white shadow-lg sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-white hover:bg-white/10 hover:text-white">
                <Link href="/admin"><ArrowLeft className="size-4" /> Torna al pannello</Link>
              </Button>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-fuchsia-200">
                <Sparkles className="size-4" /> REMAX esclusiva
              </div>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">Centro preordini REMAX</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-purple-100">
                Quattro passaggi guidati. L&apos;importazione apre le prenotazioni ma non aumenta lo stock; solo “Registra arrivo” trasforma la merce in giacenza reale.
              </p>
            </div>
            <Button asChild className="bg-white text-purple-950 hover:bg-purple-50">
              <a href="/api/admin/remax/template"><Download className="size-4" /> 1. Scarica modello</a>
            </Button>
          </div>
        </header>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <section className="space-y-3">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg"><FileSpreadsheet className="size-5 text-purple-700" /> 2. Compila lotto e carica file</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Codice lotto *"><Input value={settings.batchCode} placeholder="REMAX-2026-07-A" onChange={(event) => updateSettings("batchCode", event.currentTarget.value)} /></Field>
                  <Field label="ETA inizio *"><Input type="date" value={settings.etaStart} onChange={(event) => updateSettings("etaStart", event.currentTarget.value)} /></Field>
                  <Field label="ETA fine *"><Input type="date" value={settings.etaEnd} onChange={(event) => updateSettings("etaEnd", event.currentTarget.value)} /></Field>
                  <Field label="Chiusura prenotazioni"><Input type="datetime-local" value={settings.closeAt} onChange={(event) => updateSettings("closeAt", event.currentTarget.value)} /></Field>
                  <Field label="Numero ordine fornitore"><Input value={settings.orderNo} onChange={(event) => updateSettings("orderNo", event.currentTarget.value)} /></Field>
                  <Field label="Deposito"><Input value={settings.location} onChange={(event) => updateSettings("location", event.currentTarget.value)} /></Field>
                </div>
                <Field label="Condizioni mostrate al cliente *">
                  <Textarea className="min-h-24" value={settings.terms} onChange={(event) => updateSettings("terms", event.currentTarget.value)} />
                </Field>
                <div className="rounded-lg border border-dashed border-purple-300 bg-purple-50 p-4">
                  <Label htmlFor="remaxFile" className="font-black">File REMAX (.xlsx o .csv, massimo 5 MB / 500 righe)</Label>
                  <Input id="remaxFile" className="mt-2 bg-white" type="file" accept=".xlsx,.csv" onChange={handleFileChange} />
                  {file ? <p className="mt-2 text-xs font-bold text-purple-800">Selezionato: {file.name}</p> : null}
                </div>
                <Button type="button" variant="outline" disabled={previewState.status === "loading"} onClick={previewImport}>
                  {previewState.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} 3. Controlla prima di importare
                </Button>
                <InlineState state={previewState} />
              </CardContent>
            </Card>

            {preview ? (
              <Card className="border-purple-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
                    <span>3. Anteprima file</span>
                    <span className="flex gap-1.5 text-xs">
                      <Badge className="bg-emerald-600">Pronte {preview.counts.ready}</Badge>
                      <Badge variant="secondary">Bozze {preview.counts.draft}</Badge>
                      <Badge variant="destructive">Bloccate {preview.counts.blocked}</Badge>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-slate-600">
                        <tr><th className="p-2">Riga</th><th className="p-2">Stato</th><th className="p-2">SKU / prodotto</th><th className="p-2">Q.tà</th><th className="p-2">Prezzi C / B2B / retail</th><th className="p-2">Controllo</th></tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row) => (
                          <tr key={`${row.rowNumber}-${row.sku}`} className="border-t border-slate-100 align-top">
                            <td className="p-2 font-mono">{row.rowNumber}</td>
                            <td className="p-2"><RowStatus status={row.status} /></td>
                            <td className="p-2"><div className="font-mono font-bold">{row.sku}</div><div className="mt-1 max-w-sm font-semibold">{row.name}</div></td>
                            <td className="p-2 font-mono">{row.qtyOrdered} - buffer {row.bufferQty}</td>
                            <td className="p-2 font-mono">€{row.costPrice.toFixed(2)} / €{row.b2bPrice.toFixed(2)} / €{row.retailPrice.toFixed(2)}</td>
                            <td className={cn("p-2 font-semibold", row.issues.length ? "text-red-700" : "text-emerald-700")}>{row.issues.join(" · ") || "OK"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                    <Checkbox checked={applyConfirmed} onCheckedChange={(value) => setApplyConfirmed(value === true)} />
                    <span>Ho controllato quantità, costi, prezzi, immagini, ETA e righe da pubblicare. Confermo la creazione del lotto.</span>
                  </label>
                  <Button type="button" disabled={!applyConfirmed || preview.counts.blocked > 0 || previewState.status === "loading" || !dashboard?.permissions.canImport} onClick={applyImport}>
                    {previewState.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Conferma e apri preordini
                  </Button>
                  {!dashboard?.permissions.canImport ? <p className="text-xs font-bold text-amber-700">Il tuo ruolo non possiede tutti i permessi richiesti per creare, prezzare e pubblicare.</p> : null}
                </CardContent>
              </Card>
            ) : null}
          </section>

          <aside className="space-y-3">
            <SummaryCard dashboard={dashboard} state={dashboardState} onRefresh={refreshDashboard} />
            <ArrivalCard
              arrivalConfirmed={arrivalConfirmed}
              arrivalPreview={arrivalPreview}
              arrivalState={arrivalState}
              batches={openBatches}
              canReceive={Boolean(dashboard?.permissions.canReceive)}
              onApply={applyArrival}
              onConfirm={setArrivalConfirmed}
              onPreview={previewArrival}
              onQuantityChange={(lineId, quantity) => {
                setReceiptQuantities((current) => ({ ...current, [lineId]: quantity }));
                setArrivalPreview(null);
                setArrivalIdempotencyKey("");
                setArrivalConfirmed(false);
              }}
              onSelectBatch={selectBatch}
              quantities={receiptQuantities}
              selectedBatch={selectedBatch}
              selectedBatchCode={selectedBatchCode}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ dashboard, onRefresh, state }: { dashboard: AdminRemaxDashboard | null; onRefresh: () => void; state: RequestState }) {
  const pending = dashboard?.orders.reduce((sum, order) => sum + Math.max(order.quantity - order.readyQuantity, 0), 0) ?? 0;
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3"><CardTitle className="flex items-center justify-between text-lg"><span>Situazione REMAX</span><Button size="icon-sm" variant="outline" onClick={onRefresh} disabled={state.status === "loading"}><RefreshCw className={cn("size-4", state.status === "loading" && "animate-spin")} /></Button></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Prodotti" value={dashboard?.products.length ?? 0} />
          <Metric label="Lotti aperti" value={dashboard?.batches.filter((batch) => batch.remainingQty > 0).length ?? 0} />
          <Metric label="Pezzi in attesa" value={pending} />
        </div>
        <InlineState state={state} />
        {dashboard?.orders.length ? (
          <div className="space-y-1.5">
            <div className="text-xs font-black uppercase text-slate-500">Preordini clienti</div>
            {dashboard.orders.slice(0, 8).map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 p-2 text-xs">
                <div className="min-w-0"><div className="truncate font-bold">{order.orderNo} · {order.customerName}</div><div className="text-slate-500">{order.status} / {order.paymentStatus}</div></div>
                <div className="shrink-0 font-mono font-black">{order.readyQuantity}/{order.quantity}</div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ArrivalCard(props: {
  arrivalConfirmed: boolean;
  arrivalPreview: RemaxArrivalPreview | null;
  arrivalState: RequestState;
  batches: AdminRemaxBatch[];
  canReceive: boolean;
  onApply: () => void;
  onConfirm: (value: boolean) => void;
  onPreview: () => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onSelectBatch: (batchCode: string) => void;
  quantities: Record<string, number>;
  selectedBatch: AdminRemaxBatch | null;
  selectedBatchCode: string;
}) {
  return (
    <Card className="border-emerald-200">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><PackageCheck className="size-5 text-emerald-700" /> 4. Registra arrivo</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-semibold leading-5 text-slate-600">Usa questa sezione solo quando hai contato fisicamente la merce. Il sistema assegna prima i preordini più vecchi (FIFO).</p>
        <Field label="Lotto arrivato">
          <select className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={props.selectedBatchCode} onChange={(event) => props.onSelectBatch(event.currentTarget.value)}>
            <option value="">Seleziona lotto</option>
            {props.batches.map((batch) => <option key={batch.id} value={batch.batchCode}>{batch.batchCode} · residuo {batch.remainingQty}</option>)}
          </select>
        </Field>
        {props.selectedBatch ? (
          <div className="max-h-72 space-y-2 overflow-auto">
            {props.selectedBatch.lines.filter((line) => line.remainingQty > 0).map((line) => (
              <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_90px] items-center gap-2 rounded-lg border border-slate-200 p-2">
                <div className="min-w-0 text-xs"><div className="truncate font-mono font-bold">{line.sku}</div><div className="truncate font-semibold">{line.name}</div><div className="text-slate-500">Residuo {line.remainingQty} · clienti in attesa {line.waitingQty}</div></div>
                <Input type="number" min={0} max={line.remainingQty} value={props.quantities[line.id] ?? 0} onChange={(event) => props.onQuantityChange(line.id, Math.max(0, Math.min(line.remainingQty, Number(event.currentTarget.value) || 0)))} />
              </div>
            ))}
          </div>
        ) : null}
        <Button type="button" variant="outline" disabled={!props.selectedBatch || props.arrivalState.status === "loading"} onClick={props.onPreview}><ShieldCheck className="size-4" /> Anteprima arrivo</Button>
        {props.arrivalPreview ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
            <div className="font-black">Totale ricevuto: {props.arrivalPreview.totalReceiveQty}</div>
            <div className="mt-2 space-y-1">{props.arrivalPreview.lines.map((line) => <div key={line.lineId}>{line.sku}: {line.receiveQty} ricevuti · {line.willAllocateQty} ai preordini · {line.willRemainAvailableQty} liberi</div>)}</div>
          </div>
        ) : null}
        {props.arrivalPreview ? (
          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-950"><Checkbox checked={props.arrivalConfirmed} onCheckedChange={(value) => props.onConfirm(value === true)} /><span>Ho contato la merce fisica e confermo queste quantità. Questa operazione aumenta lo stock reale.</span></label>
        ) : null}
        <Button type="button" className="bg-emerald-700 hover:bg-emerald-800" disabled={!props.arrivalPreview || !props.arrivalConfirmed || !props.canReceive || props.arrivalState.status === "loading"} onClick={props.onApply}>{props.arrivalState.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Registra arrivo reale</Button>
        {!props.canReceive ? <p className="text-xs font-bold text-amber-700">Il tuo ruolo non può modificare lo stock.</p> : null}
        <InlineState state={props.arrivalState} />
      </CardContent>
    </Card>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center"><div className="text-xl font-black">{value}</div><div className="text-[10px] font-bold uppercase text-slate-500">{label}</div></div>;
}

function RowStatus({ status }: { status: "ready" | "draft" | "blocked" }) {
  if (status === "ready") return <Badge className="bg-emerald-600">Pronta</Badge>;
  if (status === "draft") return <Badge variant="secondary">Bozza</Badge>;
  return <Badge variant="destructive">Bloccata</Badge>;
}

function InlineState({ state }: { state: RequestState }) {
  if (!state.message || state.status === "idle") return null;
  return <div className={cn("rounded-lg border p-2.5 text-xs font-semibold", state.status === "error" ? "border-red-200 bg-red-50 text-red-700" : state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-800")}>{state.status === "loading" ? <Loader2 className="mr-2 inline size-3.5 animate-spin" /> : null}{state.message}</div>;
}

function importFormData(file: File, settings: ImportSettingsForm) {
  const body = new FormData();
  body.set("file", file);
  body.set("settings", JSON.stringify({
    batchCode: settings.batchCode,
    closeAt: settings.closeAt ? new Date(settings.closeAt).toISOString() : null,
    currency: "EUR",
    etaEnd: settings.etaEnd,
    etaStart: settings.etaStart,
    location: settings.location,
    orderNo: settings.orderNo || null,
    supplierName: settings.supplierName,
    terms: settings.terms,
    vatMode: "IVA esclusa",
  }));
  return body;
}

async function readApiPayload<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T & { error?: { details?: unknown; message?: string } };
}

function apiMessage(payload: { error?: { details?: unknown; message?: string } }) {
  const base = payload.error?.message ?? "Operazione non riuscita.";
  const details = payload.error?.details;
  if (details && typeof details === "object" && "issues" in details && Array.isArray(details.issues)) {
    return `${base} ${details.issues.map((issue) => typeof issue === "object" && issue && "message" in issue ? String(issue.message) : String(issue)).join(" ")}`;
  }
  return base;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}
