"use client";

import * as React from "react";
import Image from "next/image";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  formatEuro,
  type RmaAttachment,
  type RmaOrderOption,
  type RmaOrderLineOption,
  type RmaRequest,
} from "@/lib/partspro-data";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { cn } from "@/lib/utils";
import {
  orderStatusLabel,
  rmaReasonLabel,
  rmaResolutionLabel,
  rmaStatusLabel,
  tx,
  txFormat,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import { useT } from "./i18n-provider";
import { StoreHeader } from "./store-header";

const problemCategories = [
  {
    value: "Difetto display / touch",
    label: "Display / touch",
    helper: "Schermo, touch, righe, luminosita o flat.",
    symptoms: [
      { value: "no_display", label: "Schermo nero / non si accende" },
      { value: "touch_dead", label: "Touch non risponde" },
      { value: "lines", label: "Righe, macchie o pixel" },
      { value: "brightness", label: "Luminosita o colore anomalo" },
      { value: "other", label: "Altro difetto display" },
    ],
  },
  {
    value: "Batteria non conforme",
    label: "Batteria",
    helper: "Autonomia, carica, gonfiore o percentuale instabile.",
    symptoms: [
      { value: "not_charging", label: "Non carica" },
      { value: "low_capacity", label: "Capacita bassa" },
      { value: "shutdown", label: "Si spegne da solo" },
      { value: "swollen", label: "Batteria gonfia" },
      { value: "other", label: "Altro difetto batteria" },
    ],
  },
  {
    value: "Connettore danneggiato",
    label: "Connettore / flat",
    helper: "Porta carica, flat, speaker, camera o sensori.",
    symptoms: [
      { value: "no_charge", label: "Non rileva la carica" },
      { value: "no_data", label: "Non trasferisce dati" },
      { value: "loose", label: "Connettore lento" },
      { value: "flat_issue", label: "Flat o contatto difettoso" },
      { value: "other", label: "Altro difetto connettore" },
    ],
  },
  {
    value: "Prodotto errato",
    label: "Articolo errato",
    helper: "Prodotto diverso, modello non corretto o pezzo mancante.",
    symptoms: [
      { value: "wrong_model", label: "Modello diverso" },
      { value: "wrong_color", label: "Colore o versione diversa" },
      { value: "missing_part", label: "Pezzo o accessorio mancante" },
      { value: "other", label: "Altro errore articolo" },
    ],
  },
  {
    value: "Danno da trasporto",
    label: "Trasporto",
    helper: "Pacco o ricambio arrivato con danni visibili.",
    symptoms: [
      { value: "broken_package", label: "Pacco danneggiato" },
      { value: "broken_glass", label: "Vetro o frame rotto" },
      { value: "bent_part", label: "Ricambio piegato" },
      { value: "other", label: "Altro danno trasporto" },
    ],
  },
  {
    value: "Capacità sotto soglia test",
    label: "Test non superato",
    helper: "Controllo qualita, tester o prova banco non conforme.",
    symptoms: [
      { value: "bench_fail", label: "Test banco fallito" },
      { value: "capacity_fail", label: "Valore sotto soglia" },
      { value: "intermittent", label: "Difetto intermittente" },
      { value: "other", label: "Altro test fallito" },
    ],
  },
  {
    value: "Touch non risponde dopo installazione",
    label: "Dopo installazione",
    helper: "Il problema e apparso dopo montaggio o prova su dispositivo.",
    symptoms: [
      { value: "after_install_touch", label: "Touch non risponde" },
      { value: "after_install_display", label: "Display non visibile" },
      { value: "after_install_sensor", label: "Sensore o funzione assente" },
      { value: "other", label: "Altro dopo installazione" },
    ],
  },
  {
    value: "Altro problema",
    label: "Altro",
    helper: "Usa questa opzione solo se il difetto non rientra sopra.",
    symptoms: [
      { value: "other", label: "Descrivo nelle note" },
    ],
    requiresNote: true,
  },
] as const;

const rmaResolutions = [
  { value: "replacement", label: "Sostituzione" },
  { value: "refund", label: "Rimborso" },
  { value: "credit_note", label: "Nota credito" },
] as const;

const rmaOrderFilters = [
  { value: "all", label: "Tutti" },
  { value: "shipped", label: "Spediti" },
  { value: "completed", label: "Consegnati" },
] as const;

const deviceContextOptions = [
  { value: "same_device", label: "Stesso modello del cliente" },
  { value: "bench_test", label: "Solo prova banco" },
  { value: "different_device", label: "Provato su altro dispositivo" },
  { value: "not_listed", label: "Modello non in lista" },
] as const;

const testedBeforeInstallOptions = [
  { value: "yes", label: "Si, testato" },
  { value: "no", label: "No, non testato" },
  { value: "not_possible", label: "Non era possibile" },
] as const;

const installationOptions = [
  { value: "not_installed", label: "Non montato" },
  { value: "installed", label: "Gia montato" },
  { value: "removed", label: "Montato e poi smontato" },
] as const;

const damageOptions = [
  { value: "none", label: "Nessun danno visibile" },
  { value: "package", label: "Imballo danneggiato" },
  { value: "connector", label: "Connettore segnato" },
  { value: "liquid", label: "Tracce di liquido" },
  { value: "other", label: "Altro segno" },
] as const;

const evidenceChecklistOptions = [
  { value: "defect_photo", label: "Foto difetto" },
  { value: "front_back", label: "Fronte e retro" },
  { value: "package", label: "Pacco / etichetta" },
  { value: "test_video", label: "Video test" },
] as const;

type RmaOrderFilter = (typeof rmaOrderFilters)[number]["value"];
type DeviceContextChoice = (typeof deviceContextOptions)[number]["value"];
type TestedBeforeInstallChoice = (typeof testedBeforeInstallOptions)[number]["value"];
type InstallationChoice = (typeof installationOptions)[number]["value"];
type DamageChoice = (typeof damageOptions)[number]["value"];
type EvidenceChecklistChoice = (typeof evidenceChecklistOptions)[number]["value"];

type RmaFormState = {
  orderId: string;
  orderLineId: string;
  quantity: string;
  reason: string;
  symptom: string;
  deviceContext: DeviceContextChoice;
  description: string;
  requestedResolution: (typeof rmaResolutions)[number]["value"];
  testedBeforeInstall: TestedBeforeInstallChoice;
  installed: InstallationChoice;
  damageCondition: DamageChoice;
};

type RmaIndexResponse = {
  data?: RmaRequest[];
  meta?: {
    orderOptions?: RmaOrderOption[];
    warnings?: string[];
  };
};

type RmaSubmitResponse = {
  data?: RmaRequest;
  error?: { message?: string };
};

type RmaEvidenceUploadResponse = {
  data?: RmaAttachment;
  error?: { message?: string };
};

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string; request: RmaRequest }
  | { status: "error"; message: string };

export function RmaPage({
  initialAccountAccess,
  initialOrderId,
}: {
  initialAccountAccess?: StoreHeaderAccountAccess;
  initialOrderId?: string;
}) {
  const t = useT();
  const [form, setForm] = React.useState<RmaFormState>({
    orderId: "",
    orderLineId: "",
    quantity: "1",
    reason: problemCategories[0].value,
    symptom: problemCategories[0].symptoms[0].value,
    deviceContext: "same_device",
    description: "",
    requestedResolution: "replacement",
    testedBeforeInstall: "yes",
    installed: "not_installed",
    damageCondition: "none",
  });
  const [evidenceFiles, setEvidenceFiles] = React.useState<File[]>([]);
  const [evidenceChecklist, setEvidenceChecklist] = React.useState<EvidenceChecklistChoice[]>([]);
  const [orderFilter, setOrderFilter] = React.useState<RmaOrderFilter>("all");
  const [recentRequests, setRecentRequests] = React.useState<RmaRequest[]>([]);
  const [orderOptions, setOrderOptions] = React.useState<RmaOrderOption[]>([]);
  const [dataLoading, setDataLoading] = React.useState(true);
  const [dataError, setDataError] = React.useState<string | null>(null);
  const [submitState, setSubmitState] = React.useState<SubmitState>({
    status: "idle",
    message: tx(
      t,
      "storefront.rma.submit.idle",
      "Seleziona ordine, ricambio e motivo prima di inviare la richiesta assistenza."
    ),
  });
  const initialSelectionAppliedRef = React.useRef(false);
  const evidenceInputRef = React.useRef<HTMLInputElement>(null);
  const evidenceCount = evidenceFiles.length;

  React.useEffect(() => {
    let active = true;

    async function loadRmaData() {
      setDataLoading(true);
      setDataError(null);

      try {
        const response = await fetch("/api/rma", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as RmaIndexResponse | null;

        if (!response.ok) {
          throw new Error(readPayloadError(payload) ?? "I dati assistenza sono temporaneamente non disponibili.");
        }

        if (!active) {
          return;
        }

        const nextRequests = Array.isArray(payload?.data) ? payload.data : [];
        const nextOrderOptions = Array.isArray(payload?.meta?.orderOptions)
          ? payload.meta.orderOptions
          : [];

        setRecentRequests(nextRequests);
        setOrderOptions(nextOrderOptions);
        setForm((current) =>
          initialSelectionAppliedRef.current
            ? sanitizeFormSelection(current, nextOrderOptions)
            : applyInitialOrderSelection(current, nextOrderOptions, initialOrderId)
        );
        initialSelectionAppliedRef.current = true;
      } catch (error) {
        if (active) {
          setDataError(error instanceof Error ? error.message : "I dati assistenza sono temporaneamente non disponibili.");
        }
      } finally {
        if (active) {
          setDataLoading(false);
        }
      }
    }

    void loadRmaData();

    return () => {
      active = false;
    };
  }, [initialOrderId]);

  const selectedOrder = React.useMemo(
    () => orderOptions.find((order) => order.id === form.orderId) ?? null,
    [form.orderId, orderOptions]
  );
  const selectedLine = React.useMemo(
    () => selectedOrder?.lines.find((line) => line.id === form.orderLineId) ?? null,
    [form.orderLineId, selectedOrder]
  );
  const filteredOrderOptions = React.useMemo(
    () => orderOptions.filter((order) => matchesOrderFilter(order, orderFilter)),
    [orderFilter, orderOptions]
  );
  const selectedProblemCategory = React.useMemo(
    () => findProblemCategory(form.reason),
    [form.reason]
  );
  const selectedSymptom = React.useMemo(
    () => selectedProblemCategory.symptoms.find((item) => item.value === form.symptom) ?? selectedProblemCategory.symptoms[0],
    [form.symptom, selectedProblemCategory]
  );
  const quantityOptions = React.useMemo(
    () => createQuantityOptions(selectedLine?.remainingQuantity ?? 0),
    [selectedLine]
  );
  const requiresAdditionalDescription =
    Boolean("requiresNote" in selectedProblemCategory && selectedProblemCategory.requiresNote) ||
    selectedSymptom.value === "other" ||
    form.deviceContext === "not_listed" ||
    form.damageCondition === "other";
  const canSubmit = Boolean(
    selectedOrder &&
      selectedLine &&
      quantityOptions.includes(form.quantity) &&
      (!requiresAdditionalDescription || form.description.trim().length >= 8)
  );

  function resetSubmitState() {
    if (submitState.status === "error" || submitState.status === "success") {
      setSubmitState({
        status: "idle",
        message: tx(
          t,
          "storefront.rma.submit.changed",
          "Modifiche locali pronte. Invia di nuovo per creare una nuova richiesta assistenza."
        ),
      });
    }
  }

  function updateField<Key extends keyof RmaFormState>(
    key: Key,
    value: RmaFormState[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    resetSubmitState();
  }

  function updateReason(reason: string) {
    const category = findProblemCategory(reason);

    setForm((current) => ({
      ...current,
      reason: category.value,
      symptom: category.symptoms[0].value,
    }));
    resetSubmitState();
  }

  function updateOrder(orderId: string) {
    const order = orderOptions.find((item) => item.id === orderId) ?? null;
    const firstLine = order?.lines.length === 1 ? order.lines[0] : null;

    setForm((current) => ({
      ...current,
      orderId,
      orderLineId: firstLine?.id ?? "",
      quantity: "1",
    }));
    resetSubmitState();
  }

  function updateOrderLine(orderLineId: string) {
    setForm((current) => ({
      ...current,
      orderLineId,
      quantity: "1",
    }));
    resetSubmitState();
  }

  function toggleEvidenceChecklist(value: EvidenceChecklistChoice) {
    setEvidenceChecklist((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
    resetSubmitState();
  }

  function updateEvidenceFiles(files: FileList | null) {
    setEvidenceFiles(files ? Array.from(files).slice(0, 8) : []);
    resetSubmitState();
  }

  async function submitRma(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOrder || !selectedLine) {
      setSubmitState({
        status: "error",
        message: tx(
          t,
          "storefront.rma.submit.selectOrderLine",
          "Seleziona prima un ordine e un ricambio acquistato."
        ),
      });
      return;
    }

    const quantity = Number(form.quantity);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > selectedLine.remainingQuantity) {
      setSubmitState({
        status: "error",
        message: tx(
          t,
          "storefront.rma.submit.invalidQuantity",
          "Seleziona una quantità valida tra quelle disponibili."
        ),
      });
      return;
    }

    const description = buildRmaDescription({
      evidenceChecklist,
      evidenceCount,
      form,
      order: selectedOrder,
      selectedSymptom,
      t,
      line: selectedLine,
    });

    try {
      setSubmitState({
        status: "loading",
        message: evidenceFiles.length > 0
          ? tx(t, "storefront.rma.submit.uploadingEvidence", "Caricamento prove in corso...")
          : tx(
            t,
            "storefront.rma.submit.loading",
            "Invio richiesta assistenza in corso..."
          ),
      });
      const attachments = await uploadRmaEvidenceFiles(evidenceFiles);

      setSubmitState({
        status: "loading",
        message: tx(
          t,
          "storefront.rma.submit.loading",
          "Invio richiesta assistenza in corso..."
        ),
      });

      const response = await fetch("/api/rma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderLineId: selectedLine.id,
          quantity,
          reason: form.reason,
          description,
          requestedResolution: form.requestedResolution,
          testedBeforeInstall: form.testedBeforeInstall === "yes",
          installed: form.installed === "installed" || form.installed === "removed",
          hasPhysicalDamage: form.damageCondition !== "none",
          attachments,
        }),
      });
      const payload = (await response.json().catch(() => null)) as RmaSubmitResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Richiesta assistenza non accettata.");
      }

      if (!payload?.data?.id || !payload.data.status) {
        throw new Error("Risposta richiesta assistenza incompleta. Controlla l'API /api/rma.");
      }

      const savedRequest = payload.data;

      setRecentRequests((current) => dedupeRmaRequests([savedRequest, ...current]));
      setOrderOptions((current) => decrementLineRemaining(current, selectedLine.id, quantity));
      setForm((current) => ({
        ...current,
        orderLineId: "",
        quantity: "1",
        symptom: findProblemCategory(current.reason).symptoms[0].value,
        description: "",
      }));
      setEvidenceFiles([]);
      if (evidenceInputRef.current) {
        evidenceInputRef.current.value = "";
      }
      setEvidenceChecklist([]);
      setSubmitState({
        status: "success",
        message: txFormat(
          t,
          "storefront.rma.submit.success",
          "Richiesta {id} registrata correttamente.",
          { id: savedRequest.id }
        ),
        request: savedRequest,
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error
          ? error.message
          : tx(t, "storefront.rma.submit.error", "Errore durante l'invio della richiesta assistenza."),
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
              {tx(t, "storefront.rma.badge", "Assistenza tracciabile")}
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
                "Collega la richiesta a un ordine, scegli il ricambio acquistato e prepara foto o video per velocizzare la verifica del laboratorio."
              )}
            </p>
          </div>

          <Card className="border-slate-200 bg-white">
            <form onSubmit={submitRma}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="size-5 text-primary" />
                  {tx(t, "storefront.rma.form.title", "Nuova richiesta assistenza")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    {dataError}
                  </div>
                ) : null}

                <RmaStep
                  number="1"
                  title={tx(t, "storefront.rma.flow.order.title", "Scegli l'ordine")}
                  helper={tx(t, "storefront.rma.flow.order.helper", "Mostriamo solo ordini spediti o consegnati con quantita ancora richiedibile.")}
                >
                  {dataLoading ? (
                    <div className="flex min-h-24 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                      <Loader2 className="size-4 animate-spin" />
                      {tx(t, "storefront.rma.form.loadingOrders", "Caricamento ordini...")}
                    </div>
                  ) : selectedOrder ? (
                    <SelectedOrderSummary
                      order={selectedOrder}
                      t={t}
                      onChange={() => updateOrder("")}
                    />
                  ) : orderOptions.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                      {tx(
                        t,
                        "storefront.rma.form.noEligibleOrders",
                        "Nessun ordine spedito con quantità disponibile per assistenza."
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ChoiceGroup
                        compact
                        label={tx(t, "storefront.rma.flow.order.filter", "Filtra ordini")}
                        options={rmaOrderFilters}
                        value={orderFilter}
                        onChange={setOrderFilter}
                      />
                      <div className="grid gap-2 md:grid-cols-2">
                        {filteredOrderOptions.map((order) => (
                          <OrderOptionCard
                            key={order.id}
                            order={order}
                            t={t}
                            onSelect={() => updateOrder(order.id)}
                          />
                        ))}
                      </div>
                      {filteredOrderOptions.length === 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                          {tx(t, "storefront.rma.flow.order.filterEmpty", "Nessun ordine in questo filtro.")}
                        </div>
                      ) : null}
                    </div>
                  )}
                </RmaStep>

                {selectedOrder ? (
                  <RmaStep
                    number="2"
                    title={tx(t, "storefront.rma.flow.product.title", "Scegli il ricambio")}
                    helper={tx(t, "storefront.rma.flow.product.helper", "Ogni prodotto mostra la quantita acquistata, gia richiesta e ancora disponibile.")}
                  >
                    <div className="grid gap-2">
                      {selectedOrder.lines.map((line) => (
                        <ProductOptionCard
                          key={line.id}
                          line={line}
                          selected={line.id === form.orderLineId}
                          t={t}
                          onSelect={() => updateOrderLine(line.id)}
                        />
                      ))}
                    </div>
                    {selectedLine ? (
                      <div className="mt-3 grid gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
                        <SelectedLineSummary line={selectedLine} t={t} />
                        <QuantityPicker
                          options={quantityOptions}
                          value={form.quantity}
                          onChange={(value) => updateField("quantity", value)}
                        />
                      </div>
                    ) : null}
                  </RmaStep>
                ) : null}

                {selectedLine ? (
                  <>
                    <RmaStep
                      number="3"
                      title={tx(t, "storefront.rma.flow.problem.title", "Scegli il problema")}
                      helper={tx(t, "storefront.rma.flow.problem.helper", "Prima scegli la categoria, poi il sintomo piu vicino.")}
                    >
                      <ChoiceGroup
                        label={tx(t, "storefront.rma.form.reason", "Motivo assistenza")}
                        options={problemCategories}
                        value={form.reason}
                        onChange={updateReason}
                      />
                      <ChoiceGroup
                        label={tx(t, "storefront.rma.flow.problem.symptom", "Sintomo")}
                        options={selectedProblemCategory.symptoms}
                        value={form.symptom}
                        onChange={(value) => updateField("symptom", value)}
                      />
                      <ChoiceGroup
                        compact
                        label={tx(t, "storefront.rma.flow.problem.device", "Contesto dispositivo")}
                        options={deviceContextOptions}
                        value={form.deviceContext}
                        onChange={(value) => updateField("deviceContext", value)}
                      />
                    </RmaStep>

                    <RmaStep
                      number="4"
                      title={tx(t, "storefront.rma.flow.checks.title", "Conferma test e condizioni")}
                      helper={tx(t, "storefront.rma.flow.checks.helper", "Queste scelte aiutano il laboratorio a decidere se sostituire, rimborsare o controllare prima.")}
                    >
                      <ChoiceGroup
                        compact
                        label={tx(t, "storefront.rma.form.testedBeforeInstall", "Testato prima del montaggio")}
                        options={testedBeforeInstallOptions}
                        value={form.testedBeforeInstall}
                        onChange={(value) => updateField("testedBeforeInstall", value)}
                      />
                      <ChoiceGroup
                        compact
                        label={tx(t, "storefront.rma.form.installed", "Gia montato sul dispositivo")}
                        options={installationOptions}
                        value={form.installed}
                        onChange={(value) => updateField("installed", value)}
                      />
                      <ChoiceGroup
                        compact
                        label={tx(t, "storefront.rma.form.physicalDamage", "Segni fisici o liquidi")}
                        options={damageOptions}
                        value={form.damageCondition}
                        onChange={(value) => updateField("damageCondition", value)}
                      />
                      <Field
                        label={tx(t, "storefront.rma.form.resolution", "Soluzione richiesta")}
                        htmlFor="rma-resolution"
                      >
                        <Select
                          value={form.requestedResolution}
                          onValueChange={(value) =>
                            updateField(
                              "requestedResolution",
                              value as RmaFormState["requestedResolution"]
                            )
                          }
                        >
                          <SelectTrigger id="rma-resolution" className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {rmaResolutions.map((resolution) => (
                              <SelectItem key={resolution.value} value={resolution.value}>
                                {resolution.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </RmaStep>

                    <RmaStep
                      number="5"
                      title={tx(t, "storefront.rma.flow.evidence.title", "Prepara prove e invia")}
                      helper={tx(t, "storefront.rma.flow.evidence.helper", "Seleziona cosa hai pronto. Il testo libero serve solo per casi non coperti dalle opzioni.")}
                    >
                      <ChoiceGroup
                        compact
                        label={tx(t, "storefront.rma.flow.evidence.checklist", "Prove disponibili")}
                        multipleValue={evidenceChecklist}
                        options={evidenceChecklistOptions}
                        onToggle={toggleEvidenceChecklist}
                      />
                      <div className="space-y-2">
                        <Label
                          htmlFor="rma-evidence"
                          className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-600 transition hover:border-primary/40 hover:bg-primary/8"
                        >
                          <Upload className="size-5 text-primary" />
                          {tx(t, "storefront.rma.form.evidence", "Carica foto o video del difetto")}
                          <span className="text-xs font-normal text-slate-500">
                            {tx(
                              t,
                              "storefront.rma.form.evidenceHint",
                              "JPG, PNG, WebP, HEIC, MP4 o MOV fino a 20MB per file."
                            )}
                          </span>
                        </Label>
                        <input
                          id="rma-evidence"
                          ref={evidenceInputRef}
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime"
                          multiple
                          onChange={(event) => updateEvidenceFiles(event.target.files)}
                        />
                        <div className="text-xs font-semibold text-slate-500" aria-live="polite">
                          {evidenceCount > 0
                            ? txFormat(
                              t,
                              "storefront.rma.form.evidenceSelected",
                              "{count} file pronti per il caricamento.",
                              { count: evidenceCount }
                            )
                            : tx(
                              t,
                              "storefront.rma.form.evidenceEmpty",
                              "Nessun file selezionato. Puoi inviare solo i dati della richiesta assistenza."
                            )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rma-description">
                          {requiresAdditionalDescription
                            ? tx(t, "storefront.rma.form.descriptionRequired", "Nota richiesta")
                            : tx(t, "storefront.rma.form.description", "Nota opzionale")}
                        </Label>
                        <Textarea
                          id="rma-description"
                          className="min-h-24"
                          value={form.description}
                          onChange={(event) => updateField("description", event.target.value)}
                          maxLength={1000}
                          placeholder={tx(
                            t,
                            "storefront.rma.form.descriptionPlaceholder",
                            "Aggiungi solo dettagli non presenti nelle opzioni sopra..."
                          )}
                        />
                        {requiresAdditionalDescription && form.description.trim().length < 8 ? (
                          <div className="text-xs font-semibold text-amber-700">
                            {tx(t, "storefront.rma.form.descriptionRequiredHint", "Scrivi almeno 8 caratteri per completare questa scelta.")}
                          </div>
                        ) : null}
                      </div>
                      <RmaSubmitPreview
                        evidenceChecklist={evidenceChecklist}
                        evidenceCount={evidenceCount}
                        form={form}
                        line={selectedLine}
                        order={selectedOrder!}
                        selectedSymptom={selectedSymptom}
                        t={t}
                      />
                    </RmaStep>
                  </>
                ) : null}

                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={submitState.status === "loading" || !canSubmit}
                >
                  {submitState.status === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {submitState.status === "loading"
                    ? tx(t, "storefront.rma.submit.buttonLoading", "Invio assistenza...")
                    : tx(t, "storefront.rma.submit.button", "Invia richiesta assistenza")}
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
              {dataLoading ? (
                <div className="flex min-h-24 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  {tx(t, "storefront.rma.recent.loading", "Caricamento richieste...")}
                </div>
              ) : null}
              {!dataLoading && recentRequests.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  {tx(t, "storefront.rma.recent.empty", "Nessuna richiesta assistenza registrata.")}
                </div>
              ) : null}
              {recentRequests.map((request) => (
                <RmaRequestCard key={request.id} request={request} t={t} />
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="border-slate-200 bg-white lg:sticky lg:top-32">
            <CardHeader>
              <CardTitle>{tx(t, "storefront.rma.rules.title", "Regole assistenza")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  icon: ClipboardCheck,
                  title: tx(t, "storefront.rma.rules.order.title", "Collega sempre l'ordine"),
                  body: tx(
                    t,
                    "storefront.rma.rules.order.body",
                    "Le richieste vengono accettate solo da righe ordine gia presenti nel tuo account."
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

function RmaStep({
  children,
  helper,
  number,
  title,
}: {
  children: React.ReactNode;
  helper: string;
  number: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-3 flex gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-white">
          {number}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">{helper}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ChoiceGroup<Value extends string>({
  compact = false,
  label,
  multipleValue,
  onChange,
  onToggle,
  options,
  value,
}: {
  compact?: boolean;
  label: string;
  multipleValue?: Value[];
  onChange?: (value: Value) => void;
  onToggle?: (value: Value) => void;
  options: readonly { value: Value; label: string; helper?: string }[];
  value?: Value;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-black uppercase tracking-normal text-slate-500">
        {label}
      </div>
      <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-2")}>
        {options.map((option) => {
          const active = multipleValue
            ? multipleValue.includes(option.value)
            : option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              className={cn(
                "min-h-11 rounded-lg border bg-white p-2 text-left text-sm font-bold leading-5 transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "border-primary bg-primary/8 text-primary shadow-sm"
                  : "border-slate-200 text-slate-700 hover:border-primary/30 hover:bg-white"
              )}
              onClick={() => {
                if (multipleValue && onToggle) {
                  onToggle(option.value);
                  return;
                }

                onChange?.(option.value);
              }}
            >
              <span className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                    active ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"
                  )}
                >
                  {active ? <CheckCircle2 className="size-3" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block break-words">{option.label}</span>
                  {option.helper ? (
                    <span className="mt-1 block text-xs font-semibold leading-4 text-slate-500">
                      {option.helper}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectedOrderSummary({
  onChange,
  order,
  t,
}: {
  onChange: () => void;
  order: RmaOrderOption;
  t: StorefrontTranslator;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-black">{order.number}</span>
          <Badge className="border border-primary/20 bg-white text-primary">
            {orderStatusLabel(t, order.status)}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
          <span>{order.date}</span>
          <span>
            {txFormat(
              t,
              "storefront.rma.flow.order.items",
              "{count} prodotti disponibili",
              { count: order.items }
            )}
          </span>
          <span>{formatEuro(order.total)}</span>
        </div>
      </div>
      <Button type="button" variant="outline" className="bg-white" onClick={onChange}>
        {tx(t, "storefront.rma.flow.order.change", "Cambia ordine")}
      </Button>
    </div>
  );
}

function OrderOptionCard({
  onSelect,
  order,
  t,
}: {
  onSelect: () => void;
  order: RmaOrderOption;
  t: StorefrontTranslator;
}) {
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-black">{order.number}</span>
        <Badge className="border border-slate-200 bg-slate-50 text-[11px] text-slate-700">
          {orderStatusLabel(t, order.status)}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600">
        <SummaryPill label={tx(t, "storefront.rma.flow.order.date", "Data")} value={order.date} />
        <SummaryPill label={tx(t, "storefront.rma.flow.order.products", "Prodotti")} value={String(order.items)} />
        <SummaryPill label={tx(t, "storefront.rma.flow.order.total", "Totale")} value={formatEuro(order.total)} />
      </div>
    </button>
  );
}

function ProductOptionCard({
  line,
  onSelect,
  selected,
  t,
}: {
  line: RmaOrderLineOption;
  onSelect: () => void;
  selected: boolean;
  t: StorefrontTranslator;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-lg border bg-white p-3 text-left transition sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-slate-200 hover:border-primary/30"
      )}
      onClick={onSelect}
    >
      <RmaLineImage line={line} />
      <div className="min-w-0">
        <div className="line-clamp-2 break-words text-sm font-black leading-5">
          {line.productName}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
          <span className="font-mono">{line.sku}</span>
          <span>
            {txFormat(t, "storefront.rma.form.linePurchased", "acquistati {count}", {
              count: line.orderedQuantity,
            })}
          </span>
          <span>
            {txFormat(t, "storefront.rma.form.lineAlreadyRequested", "gia in assistenza {count}", {
              count: line.alreadyRequestedQuantity,
            })}
          </span>
        </div>
      </div>
      <div className="col-start-2 grid gap-1 sm:col-start-auto sm:justify-items-end">
        <div className="rounded-md bg-slate-50 px-2 py-1 text-xs font-black text-slate-700">
          {txFormat(t, "storefront.rma.form.lineRemaining", "Disponibili {count}", {
            count: line.remainingQuantity,
          })}
        </div>
        {selected ? (
          <div className="flex items-center gap-1 text-xs font-black text-primary">
            <CheckCircle2 className="size-3.5" />
            {tx(t, "storefront.rma.flow.product.selected", "Selezionato")}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function RmaLineImage({ line }: { line: RmaOrderLineOption }) {
  const [failed, setFailed] = React.useState(false);
  const imageAlt = line.imageAlt || line.productName || line.sku;
  const imageUrl = line.imageUrl && !failed ? line.imageUrl : "";

  return (
    <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white sm:size-[72px]">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          sizes="72px"
          quality={55}
          className="object-contain p-1.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <PackageSearch className="size-5 text-slate-300" />
      )}
    </div>
  );
}

function SelectedLineSummary({
  line,
  t,
}: {
  line: RmaOrderLineOption;
  t: StorefrontTranslator;
}) {
  return (
    <div className="min-w-0">
      <div className="line-clamp-2 break-words text-sm font-black">
        {line.productName}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold text-slate-600">
        <span className="font-mono">{line.sku}</span>
        <span>
          {txFormat(
            t,
            "storefront.rma.form.lineRemaining",
            "Disponibili {count}",
            { count: line.remainingQuantity }
          )}
        </span>
        <span>{formatEuro(line.lineTotal)}</span>
      </div>
    </div>
  );
}

function QuantityPicker({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  if (options.length <= 8) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-black uppercase tracking-normal text-slate-500">Quantita</div>
        <div className="grid grid-cols-4 gap-1.5">
          {options.map((quantity) => (
            <button
              key={quantity}
              type="button"
              aria-pressed={quantity === value}
              className={cn(
                "h-10 rounded-md border text-sm font-black transition",
                quantity === value
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-primary/30"
              )}
              onClick={() => onChange(quantity)}
            >
              {quantity}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Field label="Quantita" htmlFor="rma-quantity">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="rma-quantity" className="bg-white">
          <SelectValue placeholder="1" />
        </SelectTrigger>
        <SelectContent>
          {options.map((quantity) => (
            <SelectItem key={quantity} value={quantity}>
              {quantity}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function RmaSubmitPreview({
  evidenceChecklist,
  evidenceCount,
  form,
  line,
  order,
  selectedSymptom,
  t,
}: {
  evidenceChecklist: EvidenceChecklistChoice[];
  evidenceCount: number;
  form: RmaFormState;
  line: RmaOrderLineOption;
  order: RmaOrderOption;
  selectedSymptom: { value: string; label: string };
  t: StorefrontTranslator;
}) {
  const evidenceText = formatEvidenceSummary(evidenceChecklist, evidenceCount);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-black">
        <ClipboardCheck className="size-4 text-primary" />
        {tx(t, "storefront.rma.flow.preview.title", "Riepilogo prima dell'invio")}
      </div>
      <div className="grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2">
        <PreviewItem label={tx(t, "storefront.rma.result.order", "Ordine")} value={order.number} mono />
        <PreviewItem label="SKU" value={line.sku} mono />
        <PreviewItem label={tx(t, "storefront.rma.form.quantity", "Quantità")} value={form.quantity} />
        <PreviewItem label={tx(t, "storefront.rma.form.reason", "Motivo assistenza")} value={rmaReasonLabel(t, form.reason)} />
        <PreviewItem label={tx(t, "storefront.rma.flow.problem.symptom", "Sintomo")} value={selectedSymptom.label} />
        <PreviewItem
          label={tx(t, "storefront.rma.form.resolution", "Soluzione richiesta")}
          value={findOptionLabel(rmaResolutions, form.requestedResolution)}
        />
        <PreviewItem
          label={tx(t, "storefront.rma.form.testedBeforeInstall", "Testato prima del montaggio")}
          value={findOptionLabel(testedBeforeInstallOptions, form.testedBeforeInstall)}
        />
        <PreviewItem
          label={tx(t, "storefront.rma.form.physicalDamage", "Segni fisici o liquidi")}
          value={findOptionLabel(damageOptions, form.damageCondition)}
        />
        <PreviewItem label={tx(t, "storefront.rma.flow.evidence.checklist", "Prove disponibili")} value={evidenceText} />
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1">
      <div className="truncate text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="truncate font-black text-slate-800">{value}</div>
    </div>
  );
}

function PreviewItem({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className={cn("mt-0.5 break-words font-black text-slate-800", mono && "font-mono")}>
        {value}
      </div>
    </div>
  );
}

function RmaRequestCard({
  request,
  t,
}: {
  request: RmaRequest;
  t: StorefrontTranslator;
}) {
  const visibleNotes = [
    request.customerVisibleNote,
    request.labResult,
    request.resolutionNote,
  ].filter((value): value is string => Boolean(value?.trim()));
  const attachments = request.attachments ?? [];
  const events = request.events ?? [];

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
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
        {visibleNotes.length > 0 ? (
          <div className="mt-3 space-y-2">
            {visibleNotes.map((note) => (
              <div
                key={note}
                className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900"
              >
                {note}
              </div>
            ))}
          </div>
        ) : null}
        {request.refundAmount && request.refundAmount > 0 ? (
          <div className="mt-2 text-sm font-black text-emerald-700">
            Rimborso: {formatEuro(request.refundAmount)}
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment) =>
              attachment.signedUrl ? (
                <a
                  key={attachment.path}
                  href={attachment.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-700 hover:border-primary/30 hover:text-primary"
                >
                  {attachment.name}
                </a>
              ) : (
                <span
                  key={attachment.path}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-700"
                >
                  {attachment.name}
                </span>
              )
            )}
          </div>
        ) : null}
        {events.length > 0 ? (
          <div className="mt-3 space-y-1 border-l border-slate-200 pl-3 text-xs text-slate-500">
            {events.slice(0, 4).map((event) => (
              <div key={event.id}>
                <span className="font-black text-slate-700">{event.createdAt}</span>
                {event.toStatus ? ` · ${rmaStatusLabel(t, event.toStatus)}` : null}
                {event.note ? ` · ${event.note}` : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600 md:max-w-[220px]">
        {rmaResolutionLabel(t, request.resolution)}
      </div>
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
                label={tx(t, "storefront.rma.result.number", "Numero richiesta assistenza")}
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

function buildRmaDescription({
  evidenceChecklist,
  evidenceCount,
  form,
  line,
  order,
  selectedSymptom,
  t,
}: {
  evidenceChecklist: EvidenceChecklistChoice[];
  evidenceCount: number;
  form: RmaFormState;
  line: RmaOrderLineOption;
  order: RmaOrderOption;
  selectedSymptom: { value: string; label: string };
  t: StorefrontTranslator;
}) {
  const rows = [
    `Ordine selezionato: ${order.number}`,
    `Prodotto selezionato: ${line.productName}`,
    `SKU: ${line.sku}`,
    `Quantita richiesta: ${form.quantity}`,
    `Motivo: ${rmaReasonLabel(t, form.reason)}`,
    `Sintomo: ${selectedSymptom.label}`,
    `Contesto dispositivo: ${findOptionLabel(deviceContextOptions, form.deviceContext)}`,
    `Test prima del montaggio: ${findOptionLabel(testedBeforeInstallOptions, form.testedBeforeInstall)}`,
    `Installazione: ${findOptionLabel(installationOptions, form.installed)}`,
    `Segni fisici/liquidi: ${findOptionLabel(damageOptions, form.damageCondition)}`,
    `Soluzione richiesta: ${findOptionLabel(rmaResolutions, form.requestedResolution)}`,
    `Prove preparate: ${formatEvidenceSummary(evidenceChecklist, evidenceCount)}`,
  ];
  const customerNote = form.description.trim();

  if (customerNote) {
    rows.push(`Nota cliente: ${customerNote}`);
  }

  return rows.join("\n").slice(0, 1000);
}

async function uploadRmaEvidenceFiles(files: File[]) {
  const attachments: RmaAttachment[] = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/rma/evidence", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as RmaEvidenceUploadResponse | null;

    if (!response.ok || !payload?.data?.path || !payload.data.name) {
      throw new Error(payload?.error?.message ?? "Caricamento prove non riuscito.");
    }

    attachments.push(payload.data);
  }

  return attachments;
}

function applyInitialOrderSelection(
  form: RmaFormState,
  orderOptions: RmaOrderOption[],
  initialOrderId: string | undefined
): RmaFormState {
  const selectedOrder =
    findOrderOption(orderOptions, initialOrderId) ??
    (orderOptions.length === 1 ? orderOptions[0] : null);
  const selectedLine = selectedOrder?.lines.length === 1 ? selectedOrder.lines[0] : null;

  if (!selectedOrder) {
    return sanitizeFormSelection(form, orderOptions);
  }

  return {
    ...form,
    orderId: selectedOrder.id,
    orderLineId: selectedLine?.id ?? "",
    quantity: "1",
  };
}

function sanitizeFormSelection(
  form: RmaFormState,
  orderOptions: RmaOrderOption[]
): RmaFormState {
  const selectedOrder = orderOptions.find((order) => order.id === form.orderId) ?? null;

  if (!selectedOrder) {
    return { ...form, orderId: "", orderLineId: "", quantity: "1" };
  }

  const selectedLine = selectedOrder.lines.find((line) => line.id === form.orderLineId) ?? null;

  if (!selectedLine) {
    return { ...form, orderLineId: "", quantity: "1" };
  }

  return {
    ...form,
    quantity: createQuantityOptions(selectedLine.remainingQuantity).includes(form.quantity)
      ? form.quantity
      : "1",
  };
}

function findOrderOption(orderOptions: RmaOrderOption[], value: string | undefined) {
  if (!value) {
    return null;
  }

  return orderOptions.find((order) => order.id === value || order.number === value) ?? null;
}

function findProblemCategory(value: string) {
  return problemCategories.find((category) => category.value === value) ?? problemCategories[0];
}

function findOptionLabel<Option extends { value: string; label: string }>(
  options: readonly Option[],
  value: string
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatEvidenceSummary(
  evidenceChecklist: EvidenceChecklistChoice[],
  evidenceCount: number
) {
  const selectedLabels = evidenceChecklist.map((value) =>
    findOptionLabel(evidenceChecklistOptions, value)
  );
  const labelsText = selectedLabels.length > 0 ? selectedLabels.join(", ") : "Nessuna prova selezionata";

  return evidenceCount > 0 ? `${labelsText}; file da caricare ${evidenceCount}` : labelsText;
}

function matchesOrderFilter(order: RmaOrderOption, filter: RmaOrderFilter) {
  if (filter === "shipped") {
    return order.status === "shipped";
  }

  if (filter === "completed") {
    return order.status === "completed" || order.status === "delivered";
  }

  return true;
}

function createQuantityOptions(maxQuantity: number) {
  const safeMax = Math.max(0, Math.min(Math.floor(maxQuantity), 200));

  return Array.from({ length: safeMax }, (_, index) => String(index + 1));
}

function decrementLineRemaining(
  orderOptions: RmaOrderOption[],
  orderLineId: string,
  quantity: number
) {
  return orderOptions
    .map((order) => ({
      ...order,
      lines: order.lines
        .map((line) =>
          line.id === orderLineId
            ? {
                ...line,
                alreadyRequestedQuantity: line.alreadyRequestedQuantity + quantity,
                remainingQuantity: Math.max(0, line.remainingQuantity - quantity),
              }
            : line
        )
        .filter((line) => line.remainingQuantity > 0),
    }))
    .filter((order) => order.lines.length > 0);
}

function dedupeRmaRequests(requests: RmaRequest[]) {
  const byId = new Map<string, RmaRequest>();

  for (const request of requests) {
    byId.set(request.id, request);
  }

  return [...byId.values()];
}

function readPayloadError(payload: RmaIndexResponse | null) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : null;
}

function rmaBadgeClass(status: string) {
  if (status === "replacement_sent" || status === "replaced" || status === "refunded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "under_review" || status === "received" || status === "approved") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "closed") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  return "border-primary/20 bg-primary/8 text-primary";
}
