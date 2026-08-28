"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  Package,
  RotateCcw,
  Send,
  Upload,
  X,
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
  type RmaOrderLineOption,
  type RmaOrderOption,
} from "@/lib/partspro-data";
import type { CustomerRmaDto } from "@/lib/partspro-rma-contract";
import {
  rmaReasonCodes,
  rmaResolutionCodes,
  type RmaReasonCode,
  type RmaResolutionCode,
} from "@/lib/partspro-rma-contract";
import {
  cancelRmaUploadCheckpoint,
  rmaMaxAttachments,
  rmaImageIdentity,
  selectRmaImageFiles,
  submitRmaWithAttachments,
  type RmaUploadClientError,
} from "@/lib/partspro-rma-upload-client.mjs";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { cn } from "@/lib/utils";
import {
  orderStatusLabel,
  rmaCustomerStageLabel,
  rmaReasonLabel,
  rmaResolutionLabel,
  tx,
  txFormat,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import { useT } from "./i18n-provider";
import { StoreHeader } from "./store-header";

type RmaResolutionChoice = Extract<RmaResolutionCode, "replacement" | "wallet_credit">;

const reasonTranslationKey: Record<RmaReasonCode, string> = {
  quality_defect: "qualityDefect",
  shipping_damage: "shippingDamage",
  not_as_described: "notAsDescribed",
  wrong_item: "wrongItem",
  missing_or_quantity_error: "missingOrQuantityError",
  withdrawal_no_longer_needed: "withdrawalNoLongerNeeded",
};

const reasonFallback: Record<RmaReasonCode, string> = {
  quality_defect: "Difetto di qualità o funzionamento",
  shipping_damage: "Danno da trasporto",
  not_as_described: "Non conforme alla descrizione",
  wrong_item: "Articolo errato",
  missing_or_quantity_error: "Articolo o quantità mancanti",
  withdrawal_no_longer_needed: "Non più necessario",
};

const resolutionTranslationKey: Record<RmaResolutionChoice, string> = {
  replacement: "replacement",
  wallet_credit: "walletCredit",
};

const resolutionFallback: Record<RmaResolutionChoice, string> = {
  replacement: "Sostituzione",
  wallet_credit: "Rimborso nel saldo PartsPro",
};

const rmaReasonOptions: ReadonlyArray<{
  fallback: string;
  key: string;
  value: RmaReasonCode;
}> = rmaReasonCodes.map((value) => ({
  value,
  key: `storefront.rma.reason.${reasonTranslationKey[value]}`,
  fallback: reasonFallback[value],
}));

const rmaResolutionOptions: ReadonlyArray<{
  fallback: string;
  key: string;
  value: RmaResolutionChoice;
}> = rmaResolutionCodes
  .filter((value): value is RmaResolutionChoice => value !== "refund")
  .map((value) => ({
    value,
    key: `storefront.rma.resolution.${resolutionTranslationKey[value]}`,
    fallback: resolutionFallback[value],
  }));

type RmaFormState = {
  note: string;
  orderId: string;
  orderLineId: string;
  quantity: string;
  reasonCode: RmaReasonCode;
  requestedResolution: RmaResolutionChoice;
};

type RmaIndexResponse = {
  data?: CustomerRmaDto[];
  error?: { message?: string };
  meta?: {
    orderOptions?: RmaOrderOption[];
    warnings?: string[];
  };
};

type RmaShippedResponse = {
  data?: CustomerRmaDto;
  error?: { message?: string };
};

type RmaSubmitState =
  | { message: string; status: "idle" }
  | { message: string; status: "loading" }
  | { message: string; request: CustomerRmaDto; status: "success" }
  | { message: string; status: "error" };

type ShippingDraft = {
  carrier: string;
  tracking: string;
};

type ShippingNotice = {
  message: string;
  tone: "error" | "success";
};

const EMPTY_SHIPPING_DRAFT: Readonly<ShippingDraft> = Object.freeze({
  carrier: "",
  tracking: "",
});

type LocalRmaImage = {
  file: File;
  id: string;
  previewUrl: string;
  status: "error" | "preparing" | "ready" | "retrying" | "uploading" | "verifying";
};

type RmaUploadCheckpoint = {
  draftId: string | null;
  inputFingerprint: string;
  payload: Record<string, unknown> | null;
  pendingCancellationIds: string[];
  verifiedAttachmentIds: Record<string, string>;
  phase: "active" | "abandoning";
  version: 1;
};

type RmaImageRejectReason =
  | "duplicate_image"
  | "heic_image_over_4mb"
  | "max_images"
  | "unsupported_image_type";

const initialForm: RmaFormState = {
  note: "",
  orderId: "",
  orderLineId: "",
  quantity: "1",
  reasonCode: "quality_defect",
  requestedResolution: "replacement",
};

export function RmaPage({
  initialAccountAccess,
  initialOrderId,
  initialOrderLineId,
  initialRequestId,
}: {
  initialAccountAccess?: StoreHeaderAccountAccess;
  initialOrderId?: string;
  initialOrderLineId?: string;
  initialRequestId?: string;
}) {
  const t = useT();
  const [form, setForm] = React.useState<RmaFormState>(initialForm);
  const [images, setImages] = React.useState<LocalRmaImage[]>([]);
  const [recentRequests, setRecentRequests] = React.useState<CustomerRmaDto[]>([]);
  const [orderOptions, setOrderOptions] = React.useState<RmaOrderOption[]>([]);
  const [dataLoading, setDataLoading] = React.useState(true);
  const [dataError, setDataError] = React.useState<string | null>(null);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [submitState, setSubmitState] = React.useState<RmaSubmitState>({
    status: "idle",
    message: tx(t, "storefront.rma.submit.idle", "Scegli ordine, motivo e foto prima di inviare."),
  });
  const [uploadProgress, setUploadProgress] = React.useState<string | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const draftIdempotencyKeyRef = React.useRef<string | null>(null);
  const submitIdempotencyKeyRef = React.useRef<string | null>(null);
  const imageIndexRef = React.useRef<number | null>(null);
  const imagesRef = React.useRef<LocalRmaImage[]>([]);
  const initialSelectionAppliedRef = React.useRef(false);
  const submittingRef = React.useRef(false);
  const uploadCheckpointRef = React.useRef<RmaUploadCheckpoint | null>(null);
  const [uploadCheckpoint, setUploadCheckpoint] = React.useState<RmaUploadCheckpoint | null>(null);
  const [isRestartingUpload, setIsRestartingUpload] = React.useState(false);
  const shippingPendingRef = React.useRef<Set<string>>(new Set());
  const [shippingBusy, setShippingBusy] = React.useState<Record<string, boolean>>({});
  const [shippingDrafts, setShippingDrafts] = React.useState<Record<string, ShippingDraft>>({});
  const [shippingNotices, setShippingNotices] = React.useState<Record<string, ShippingNotice>>({});

  React.useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  React.useEffect(() => {
    let active = true;

    async function loadRmaData() {
      setDataLoading(true);
      setDataError(null);

      try {
        const response = await fetch("/api/rma", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = (await response.json().catch(() => null)) as RmaIndexResponse | null;

        if (!response.ok) {
          throw new Error(readApiError(payload) ?? "I dati dei resi non sono disponibili in questo momento.");
        }

        if (!active) {
          return;
        }

        const requests = Array.isArray(payload?.data) ? payload.data : [];
        const orders = Array.isArray(payload?.meta?.orderOptions)
          ? payload.meta.orderOptions
          : [];
        setRecentRequests(requests);
        setOrderOptions(orders);
        setForm((current) => {
          if (uploadCheckpointRef.current) {
            return current;
          }
          return initialSelectionAppliedRef.current
            ? sanitizeFormSelection(current, orders)
            : applyInitialOrderSelection(current, orders, initialOrderId, initialOrderLineId);
        });
        initialSelectionAppliedRef.current = true;
      } catch (error) {
        if (active) {
          setDataError(error instanceof Error ? error.message : "I dati dei resi non sono disponibili in questo momento.");
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
  }, [initialOrderId, initialOrderLineId]);

  React.useEffect(() => {
    if (dataLoading || !initialRequestId) {
      return;
    }

    const element = document.getElementById(`rma-request-${initialRequestId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [dataLoading, initialRequestId, recentRequests.length]);

  React.useEffect(
    () => () => {
      for (const image of imagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
    },
    []
  );

  const selectedOrder = React.useMemo(
    () => orderOptions.find((order) => order.id === form.orderId) ?? null,
    [form.orderId, orderOptions]
  );
  const selectedLine = React.useMemo(
    () => selectedOrder?.lines.find((line) => line.id === form.orderLineId) ?? null,
    [form.orderLineId, selectedOrder]
  );
  const quantityOptions = React.useMemo(
    () => createQuantityOptions(selectedLine?.remainingQuantity ?? 0),
    [selectedLine]
  );
  const quantityIsValid = Boolean(selectedLine && quantityOptions.includes(form.quantity));
  const canSubmit = Boolean(selectedLine && quantityIsValid && images.length > 0);
  const isSubmitting = submitState.status === "loading";
  const hasFinalCheckpoint = Boolean(uploadCheckpoint?.payload);
  const isAbandoningCheckpoint = uploadCheckpoint?.phase === "abandoning";
  const controlsLocked = isSubmitting || uploadCheckpoint !== null || isRestartingUpload;

  function areRmaControlsLocked() {
    return controlsLocked || submittingRef.current || uploadCheckpointRef.current !== null;
  }

  function handleUploadCheckpoint(nextCheckpoint: RmaUploadCheckpoint | null) {
    uploadCheckpointRef.current = nextCheckpoint;
    setUploadCheckpoint(nextCheckpoint);
  }

  function resetSubmitForChange() {
    if (areRmaControlsLocked()) {
      return;
    }
    if (submitState.status === "error" || submitState.status === "success") {
      setSubmitState({
        status: "idle",
        message: tx(t, "storefront.rma.submit.changed", "修改已准备好，可以再次提交。"),
      });
    }
    draftIdempotencyKeyRef.current = null;
    submitIdempotencyKeyRef.current = null;
    setUploadProgress(null);
  }

  function updateForm<Key extends keyof RmaFormState>(key: Key, value: RmaFormState[Key]) {
    if (areRmaControlsLocked()) {
      return;
    }
    setForm((current) => ({ ...current, [key]: value }));
    resetSubmitForChange();
  }

  function updateOrder(orderId: string) {
    if (areRmaControlsLocked()) {
      return;
    }
    const order = orderOptions.find((item) => item.id === orderId);
    const firstLine = order?.lines.length === 1 ? order.lines[0] : null;
    setForm((current) => ({
      ...current,
      orderId,
      orderLineId: firstLine?.id ?? "",
      quantity: "1",
    }));
    resetSubmitForChange();
  }

  function updateOrderLine(orderLineId: string) {
    if (areRmaControlsLocked()) {
      return;
    }
    setForm((current) => ({ ...current, orderLineId, quantity: "1" }));
    resetSubmitForChange();
  }

  function clearOrder() {
    if (areRmaControlsLocked()) {
      return;
    }
    setForm((current) => ({ ...current, orderId: "", orderLineId: "", quantity: "1" }));
    resetSubmitForChange();
  }

  function addImageFiles(fileList: FileList | null) {
    if (!fileList || areRmaControlsLocked()) {
      return;
    }

    const incoming = Array.from(fileList);
    const result = selectRmaImageFiles(
      images.map((image) => image.file),
      incoming,
      rmaMaxAttachments
    );
    const currentIdentitySet = new Set(images.map((image) => rmaImageIdentity(image.file)));
    const accepted = result.accepted.filter(
      (file) => !currentIdentitySet.has(rmaImageIdentity(file))
    ) as File[];

    const nextImages = accepted.map((file) => ({
      file,
      id: createClientId("image"),
      previewUrl: URL.createObjectURL(file),
      status: "ready" as const,
    }));
    if (nextImages.length > 0) {
      setImages((current) => [...current, ...nextImages].slice(0, rmaMaxAttachments));
      resetSubmitForChange();
    }

    const rejectedReason = result.rejected[0]?.reason as RmaImageRejectReason | undefined;
    setImageError(rejectedReason ? imageRejectMessage(t, rejectedReason) : null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  }

  function removeImage(imageId: string) {
    const image = images.find((item) => item.id === imageId);
    if (!image || areRmaControlsLocked()) {
      return;
    }
    URL.revokeObjectURL(image.previewUrl);
    setImages((current) => current.filter((item) => item.id !== imageId));
    setImageError(null);
    resetSubmitForChange();
  }

  async function restartRmaUpload() {
    const checkpoint = uploadCheckpointRef.current;
    if (!checkpoint || isSubmitting || isRestartingUpload) {
      return;
    }

    setIsRestartingUpload(true);
    setSubmitState({
      status: "loading",
      message: tx(t, "storefront.rma.upload.restarting", "Pulizia dello stato di caricamento..."),
    });
    try {
      await cancelRmaUploadCheckpoint({
        checkpoint,
        onCheckpoint: handleUploadCheckpoint,
      });
      for (const image of imagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
      setImages([]);
      setImageError(null);
      setUploadProgress(null);
      draftIdempotencyKeyRef.current = null;
      submitIdempotencyKeyRef.current = null;
      setSubmitState({
        status: "idle",
        message: tx(t, "storefront.rma.submit.changed", "修改已准备好，可以再次提交。"),
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error
          ? error.message
          : tx(t, "storefront.rma.upload.restartError", "无法清理上传状态，请稍后重试。"),
      });
    } finally {
      setIsRestartingUpload(false);
    }
  }

  async function submitRma(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    if (!selectedLine) {
      setSubmitState({
        status: "error",
        message: tx(t, "storefront.rma.submit.selectOrderLine", "Scegli prima un ordine e un ricambio."),
      });
      return;
    }

    if (!quantityIsValid) {
      setSubmitState({
        status: "error",
        message: tx(t, "storefront.rma.submit.invalidQuantity", "Scegli una quantità disponibile."),
      });
      return;
    }

    if (images.length === 0) {
      setImageError(tx(t, "storefront.rma.image.required", "Aggiungi almeno una foto prima di inviare."));
      setSubmitState({
        status: "error",
        message: tx(t, "storefront.rma.submit.noImages", "Aggiungi almeno una foto prima di inviare."),
      });
      return;
    }

    submittingRef.current = true;
    const quantity = Number(form.quantity);
    const draftIdempotencyKey = draftIdempotencyKeyRef.current ?? createClientId("rma-draft");
    const submitIdempotencyKey = submitIdempotencyKeyRef.current ?? createClientId("rma-submit");
    draftIdempotencyKeyRef.current = draftIdempotencyKey;
    submitIdempotencyKeyRef.current = submitIdempotencyKey;
    imageIndexRef.current = null;
    setImageError(null);
    setSubmitState({
      status: "loading",
      message: tx(t, "storefront.rma.submit.preparing", "Preparazione della richiesta..."),
    });

    try {
      const result = await submitRmaWithAttachments({
        orderLineId: selectedLine.id,
        quantity,
        reasonCode: form.reasonCode,
        requestedResolution: form.requestedResolution,
        note: form.note,
        files: images.map((image) => image.file),
        idempotencyKey: submitIdempotencyKey,
        draftIdempotencyKey,
        checkpoint: uploadCheckpointRef.current,
        onCheckpoint: handleUploadCheckpoint,
        onProgress: ({ index, total, status }: {
          index: number;
          status: LocalRmaImage["status"];
          total: number;
        }) => {
          imageIndexRef.current = index;
          setImages((current) =>
            current.map((image, imageIndex) =>
              imageIndex === index ? { ...image, status } : image
            )
          );
          const progressKey = status === "preparing"
            ? "storefront.rma.image.preparing"
            : status === "uploading"
              ? "storefront.rma.image.uploading"
              : status === "verifying"
                ? "storefront.rma.image.verifying"
                : "storefront.rma.submit.retry";
          const fallback = status === "preparing"
            ? "Preparazione foto {current}/{total}..."
            : status === "uploading"
              ? "Caricamento foto {current}/{total}..."
              : status === "verifying"
                ? "Verifica foto {current}/{total}..."
                : "Riprovo il caricamento della foto...";
          const nextProgress = txFormat(t, progressKey, fallback, {
            current: index + 1,
            total,
          });
          setUploadProgress(nextProgress);
          setSubmitState({ status: "loading", message: nextProgress });
        },
      });
      const savedRequest = result.data as CustomerRmaDto;

      setRecentRequests((current) => dedupeCustomerRmaRequests([savedRequest, ...current]));
      setOrderOptions((current) => decrementLineRemaining(current, selectedLine.id, quantity));
      for (const image of images) {
        URL.revokeObjectURL(image.previewUrl);
      }
      setImages([]);
      setForm((current) => ({
        ...current,
        orderId: "",
        orderLineId: "",
        quantity: "1",
        note: "",
      }));
      draftIdempotencyKeyRef.current = null;
      submitIdempotencyKeyRef.current = null;
      setUploadProgress(null);
      setSubmitState({
        status: "success",
        message: txFormat(
          t,
          "storefront.rma.submit.success",
          "Richiesta {id} registrata correttamente.",
          { id: savedRequest.rmaNo ?? savedRequest.id }
        ),
        request: savedRequest,
      });
    } catch (error) {
      const activeImageIndex = imageIndexRef.current;
      const clientError = error as Partial<RmaUploadClientError>;
      const isImageError = clientError.code?.startsWith("IMAGE") || clientError.code === "UNSUPPORTED_IMAGE";
      if (activeImageIndex !== null && isImageError) {
        setImages((current) =>
          current.map((image, index) =>
            index === activeImageIndex ? { ...image, status: "error" } : image
          )
        );
      }
      const message = error instanceof Error
        ? error.message
        : tx(t, "storefront.rma.submit.error", "Errore durante l'invio della richiesta.");
      setImageError(
        isImageError
          ? message
          : null
      );
      setUploadProgress(null);
      setSubmitState({ status: "error", message });
    } finally {
      submittingRef.current = false;
    }
  }

  async function markRequestShipped(request: CustomerRmaDto) {
    if (!request.canMarkShipped || shippingPendingRef.current.has(request.id)) {
      return;
    }

    shippingPendingRef.current.add(request.id);
    setShippingBusy((current) => ({ ...current, [request.id]: true }));
    setShippingNotices((current) => {
      const next = { ...current };
      delete next[request.id];
      return next;
    });

    const draft = shippingDrafts[request.id];
    const shippingDetails = {
      ...(draft?.carrier.trim() ? { carrier: draft.carrier.trim() } : {}),
      ...(draft?.tracking.trim() ? { tracking: draft.tracking.trim() } : {}),
    };
    const body = Object.keys(shippingDetails).length > 0 ? JSON.stringify(shippingDetails) : "{}";

    try {
      const response = await fetch(`/api/rma/${encodeURIComponent(request.id)}/shipped`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body,
      });
      const payload = (await response.json().catch(() => null)) as RmaShippedResponse | null;
      const savedRequest = payload?.data;
      if (!response.ok || !savedRequest) {
        throw new Error(readApiError(payload) ?? tx(t, "storefront.rma.shipped.error", "Non è stato possibile registrare la spedizione. Riprova."));
      }

      setRecentRequests((current) =>
        current.map((item) => (item.id === savedRequest.id ? savedRequest : item))
      );
      setShippingNotices((current) => ({
        ...current,
        [request.id]: {
          message: tx(t, "storefront.rma.shipped.success", "Reso segnato come spedito."),
          tone: "success",
        },
      }));
    } catch (error) {
      setShippingNotices((current) => ({
        ...current,
        [request.id]: {
          message: error instanceof Error
            ? error.message
            : tx(t, "storefront.rma.shipped.error", "Non è stato possibile registrare la spedizione. Riprova."),
          tone: "error",
        },
      }));
    } finally {
      shippingPendingRef.current.delete(request.id);
      setShippingBusy((current) => ({ ...current, [request.id]: false }));
    }
  }

  function updateShippingDraft(requestId: string, key: keyof ShippingDraft, value: string) {
    setShippingDrafts((current) => ({
      ...current,
      [requestId]: {
        carrier: current[requestId]?.carrier ?? "",
        tracking: current[requestId]?.tracking ?? "",
        [key]: value,
      },
    }));
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader initialAccountAccess={initialAccountAccess} />
      <div className="mx-auto max-w-[1120px] space-y-4 px-3 pb-12 pt-20 sm:px-5 sm:pt-24">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:p-7">
          <Badge className="mb-3 border border-primary/20 bg-primary/8 text-primary">
            {tx(t, "storefront.rma.badge", "Assistenza tracciabile")}
          </Badge>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {tx(t, "storefront.rma.title", "Apri una richiesta di reso o sostituzione")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {tx(
              t,
              "storefront.rma.description",
              "Collega una riga ordine, scegli il motivo e conserva le foto del prodotto nel dossier della richiesta."
            )}
          </p>
        </section>

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
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="alert">
                  {dataError}
                </div>
              ) : null}

              <RmaStep
                number="1"
                title={tx(t, "storefront.rma.block.order.title", "Ordine e prodotto acquistato")}
                helper={tx(t, "storefront.rma.block.order.helper", "Partiamo da una riga ordine reale: niente numeri d'ordine o SKU da digitare.")}
              >
                {dataLoading ? (
                  <LoadingBox text={tx(t, "storefront.rma.order.loading", "Caricamento ordini...")} />
                ) : selectedOrder ? (
                  <div className="space-y-3">
                    <SelectedOrderSummary order={selectedOrder} t={t} onChange={clearOrder} disabled={controlsLocked} />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>{tx(t, "storefront.rma.order.chooseLine", "Scegli il ricambio")}</Label>
                        {selectedOrder.lines.length === 1 ? (
                          <span className="text-xs font-semibold text-slate-500">
                            {tx(t, "storefront.rma.order.singleLine", "Riga selezionata automaticamente")}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid gap-2">
                        {selectedOrder.lines.map((line) => (
                          <ProductOptionCard
                            key={line.id}
                            line={line}
                            selected={line.id === form.orderLineId}
                            t={t}
                            onSelect={() => updateOrderLine(line.id)}
                            disabled={controlsLocked}
                          />
                        ))}
                      </div>
                    </div>
                    {selectedLine ? (
                      <div className="grid gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                        <div>
                          <div className="text-sm font-black">{selectedLine.productName}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            {txFormat(t, "storefront.rma.order.lineAvailable", "Disponibili {count}", {
                              count: selectedLine.remainingQuantity,
                            })}
                          </div>
                        </div>
                        {selectedLine.remainingQuantity > 1 ? (
                          <Field
                            label={tx(t, "storefront.rma.form.quantity", "Quantità")}
                            htmlFor="rma-quantity"
                          >
                            <Select
                              value={form.quantity}
                              onValueChange={(value) => updateForm("quantity", value)}
                              disabled={controlsLocked}
                            >
                              <SelectTrigger id="rma-quantity" className="w-full bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {quantityOptions.map((quantity) => (
                                  <SelectItem key={quantity} value={quantity}>
                                    {quantity}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        ) : (
                          <div className="text-sm font-semibold text-slate-600">
                            {tx(t, "storefront.rma.form.quantity", "Quantità")}: 1
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : orderOptions.length === 0 ? (
                  <EmptyBox text={tx(t, "storefront.rma.order.none", "Nessun ordine spedito o consegnato con quantità disponibile.")} />
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {orderOptions.map((order) => (
                      <OrderOptionCard key={order.id} order={order} t={t} onSelect={() => updateOrder(order.id)} disabled={controlsLocked} />
                    ))}
                  </div>
                )}
              </RmaStep>

              <RmaStep
                number="2"
                title={tx(t, "storefront.rma.block.reason.title", "Motivo e soluzione desiderata")}
                helper={tx(t, "storefront.rma.block.reason.helper", "Per le richieste B2B è necessaria almeno una foto. La decisione finale resta al team PartsPro.")}
              >
                <Field label={tx(t, "storefront.rma.reason.label", "Motivo del reso")} htmlFor="rma-reason">
                  <div id="rma-reason" className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tx(t, "storefront.rma.reason.label", "Motivo del reso")}>
                    {rmaReasonOptions.map((reason) => (
                      <ChoiceButton
                        key={reason.value}
                        selected={form.reasonCode === reason.value}
                        value={reason.value}
                        disabled={controlsLocked}
                        onSelect={() => updateForm("reasonCode", reason.value)}
                      >
                        {tx(t, reason.key, reason.fallback)}
                      </ChoiceButton>
                    ))}
                  </div>
                </Field>

                <Field label={tx(t, "storefront.rma.resolution.label", "Come preferisci risolvere")} htmlFor="rma-resolution">
                  <div id="rma-resolution" className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tx(t, "storefront.rma.resolution.label", "Come preferisci risolvere")}>
                    {rmaResolutionOptions.map((resolution) => (
                      <ChoiceButton
                        key={resolution.value}
                        selected={form.requestedResolution === resolution.value}
                        value={resolution.value}
                        disabled={controlsLocked}
                        onSelect={() => updateForm("requestedResolution", resolution.value)}
                      >
                        {tx(t, resolution.key, resolution.fallback)}
                      </ChoiceButton>
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
                    {tx(t, "storefront.rma.resolution.walletHint", "Il rimborso viene accreditato nel saldo PartsPro dopo la verifica; non è un rimborso automatico sulla carta.")}
                  </p>
                </Field>

                <details
                  open={form.reasonCode === "withdrawal_no_longer_needed"}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    {tx(t, "storefront.rma.note.add", "Aggiungi una nota (opzionale)")}
                  </summary>
                  <div className="mt-3">
                    <Textarea
                      id="rma-note"
                      value={form.note}
                      onChange={(event) => updateForm("note", event.target.value)}
                      disabled={controlsLocked}
                      maxLength={2000}
                      placeholder={tx(t, "storefront.rma.note.placeholder", "Aggiungi una breve spiegazione...")}
                      aria-describedby="rma-note-hint"
                    />
                    {form.reasonCode === "withdrawal_no_longer_needed" ? (
                      <p id="rma-note-hint" className="text-xs text-slate-500">
                        {tx(t, "storefront.rma.note.withdrawalHint", "Puoi aggiungere una breve spiegazione, senza dati di pagamento.")}
                      </p>
                    ) : null}
                  </div>
                </details>
              </RmaStep>

              <RmaStep
                number="3"
                title={tx(t, "storefront.rma.block.images.title", "Foto per il dossier")}
                helper={tx(t, "storefront.rma.block.images.helper", "Aggiungi immagini nitide del prodotto, dell'imballo o dell'etichetta.")}
              >
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={controlsLocked || images.length >= rmaMaxAttachments}
                    onClick={() => {
                      if (!areRmaControlsLocked()) {
                        cameraInputRef.current?.click();
                      }
                    }}
                  >
                    <Camera className="size-4" />
                    {tx(t, "storefront.rma.image.camera", "Scatta foto")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={controlsLocked || images.length >= rmaMaxAttachments}
                    onClick={() => {
                      if (!areRmaControlsLocked()) {
                        galleryInputRef.current?.click();
                      }
                    }}
                  >
                    <Upload className="size-4" />
                    {tx(t, "storefront.rma.image.gallery", "Scegli dalla galleria")}
                  </Button>
                  <input
                    ref={cameraInputRef}
                    id="rma-camera"
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={controlsLocked}
                    onChange={(event) => addImageFiles(event.target.files)}
                  />
                  <input
                    ref={galleryInputRef}
                    id="rma-gallery"
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={controlsLocked}
                    onChange={(event) => addImageFiles(event.target.files)}
                  />
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  {tx(t, "storefront.rma.image.hint", "Massimo 6 foto, 4 MB ciascuna. Formati: JPG, PNG, WebP, HEIC o HEIF.")}
                </p>
                {imageError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="alert">
                    {imageError}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6" aria-live="polite">
                  {images.map((image) => (
                    <div key={image.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <Image
                        src={image.previewUrl}
                        alt={image.file.name}
                        width={180}
                        height={140}
                        unoptimized
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <div className="flex items-center justify-between gap-1 p-1.5 text-[11px] font-semibold text-slate-600">
                        <span className="max-w-[calc(100%-24px)] truncate">{image.file.name}</span>
                        <button
                          type="button"
                          className="grid size-6 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-950"
                          aria-label={txFormat(t, "storefront.rma.image.remove", "Rimuovi foto {name}", { name: image.file.name })}
                          disabled={controlsLocked}
                          onClick={() => removeImage(image.id)}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      {image.status !== "ready" ? (
                        <div className="absolute inset-x-1 bottom-9 rounded bg-slate-950/75 px-1 py-1 text-center text-[10px] font-semibold text-white">
                          {imageStatusLabel(t, image.status)}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="text-xs font-semibold text-slate-500" aria-live="polite">
                  {images.length > 0
                    ? txFormat(t, "storefront.rma.image.selected", "{count} foto pronte per il caricamento.", { count: images.length })
                    : tx(t, "storefront.rma.image.required", "Aggiungi almeno una foto per inviare la richiesta.")}
                </div>
                {uploadProgress ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary" aria-live="polite">
                    <Loader2 className="size-4 animate-spin" />
                    {uploadProgress}
                  </div>
                ) : null}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  {tx(t, "storefront.rma.rules.photo.body", "Le foto vengono conservate nel dossier della richiesta e verificate prima dell'invio.")}
                </div>
              </RmaStep>

              <Button
                type="submit"
                className="h-11 w-full"
                disabled={isSubmitting || isRestartingUpload || !canSubmit}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {isSubmitting
                  ? tx(t, "storefront.rma.submit.buttonLoading", "Invio assistenza...")
                  : isAbandoningCheckpoint
                    ? tx(t, "storefront.rma.upload.continueCleanup", "Continua pulizia")
                    : hasFinalCheckpoint
                      ? tx(t, "storefront.rma.upload.confirmSubmit", "Conferma invio")
                      : tx(t, "storefront.rma.submit.button", "Invia richiesta assistenza")}
              </Button>
              {uploadCheckpoint && !isSubmitting ? (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-amber-900">
                    {isAbandoningCheckpoint
                      ? tx(t, "storefront.rma.upload.cleanupHint", "La pulizia precedente deve terminare. Il vecchio invio non verrà ripetuto.")
                      : hasFinalCheckpoint
                        ? tx(t, "storefront.rma.upload.abandonHint", "La richiesta potrebbe essere già stata registrata: conferma l'invio per riprovare in sicurezza. Ricominciare abbandona il recupero e avvia la pulizia.")
                        : tx(t, "storefront.rma.upload.resumeHint", "Lo stato del caricamento è conservato. Ritenta l'invio oppure ricomincia per cancellare i dati temporanei.")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRestartingUpload}
                    onClick={() => void restartRmaUpload()}
                  >
                    {isRestartingUpload
                      ? tx(t, "storefront.rma.upload.restartingShort", "Pulizia...")
                      : isAbandoningCheckpoint
                        ? tx(t, "storefront.rma.upload.continueCleanup", "Continua pulizia")
                        : hasFinalCheckpoint
                          ? tx(t, "storefront.rma.upload.abandonRestart", "Abbandona recupero e ricomincia")
                          : tx(t, "storefront.rma.upload.restart", "Ricomincia upload")}
                  </Button>
                </div>
              ) : null}
              <RmaSubmitStatus state={submitState} t={t} />
            </CardContent>
          </form>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>{tx(t, "storefront.rma.recent.title", "Richieste recenti")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataLoading ? <LoadingBox text={tx(t, "storefront.rma.recent.loading", "Caricamento richieste...")} /> : null}
            {!dataLoading && recentRequests.length === 0 ? (
              <EmptyBox text={tx(t, "storefront.rma.recent.empty", "Nessuna richiesta assistenza registrata.")} />
            ) : null}
            {recentRequests.map((request) => (
              <RmaRequestCard
                key={request.id}
                request={request}
                highlighted={request.id === initialRequestId}
                onMarkShipped={() => void markRequestShipped(request)}
                onShippingDraftChange={(key, value) => updateShippingDraft(request.id, key, value)}
                shippingBusy={Boolean(shippingBusy[request.id])}
                shippingDraft={shippingDrafts[request.id] ?? EMPTY_SHIPPING_DRAFT}
                shippingNotice={shippingNotices[request.id]}
                t={t}
              />
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href="/account">
              <CheckCircle2 className="size-4" />
              {tx(t, "storefront.rma.backToAccount", "Torna all'account")}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
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
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby={`rma-step-${number}`}>
      <div className="flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">
          {number}
        </div>
        <div>
          <h2 id={`rma-step-${number}`} className="font-black">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">{helper}</p>
        </div>
      </div>
      <div className="space-y-3 pl-0 sm:pl-11">{children}</div>
    </section>
  );
}

function ChoiceButton({
  children,
  disabled,
  onSelect,
  selected,
  value,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
  selected: boolean;
  value: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      value={value}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/20"
          : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/5"
      )}
    >
      {children}
    </button>
  );
}

function SelectedOrderSummary({
  disabled,
  onChange,
  order,
  t,
}: {
  disabled?: boolean;
  onChange: () => void;
  order: RmaOrderOption;
  t: StorefrontTranslator;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Package className="size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="truncate text-sm font-black">{order.number}</div>
          <div className="mt-1 text-xs text-slate-600">
            {order.date} · {orderStatusLabel(t, order.status)} · {formatEuro(order.total)}
          </div>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onChange} disabled={disabled}>
        {tx(t, "storefront.rma.order.change", "Cambia ordine")}
      </Button>
    </div>
  );
}

function OrderOptionCard({
  disabled,
  onSelect,
  order,
  t,
}: {
  disabled?: boolean;
  onSelect: () => void;
  order: RmaOrderOption;
  t: StorefrontTranslator;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex min-h-20 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onSelect}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Package className="size-5 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-black">{order.number}</span>
          <span className="mt-1 block text-xs text-slate-500">
            {order.date} · {orderStatusLabel(t, order.status)} · {order.lines.length} {tx(t, "storefront.common.pieces", "pezzi")}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-sm font-black text-primary">{formatEuro(order.total)}</span>
    </button>
  );
}

function ProductOptionCard({
  disabled,
  line,
  onSelect,
  selected,
  t,
}: {
  disabled?: boolean;
  line: RmaOrderLineOption;
  onSelect: () => void;
  selected: boolean;
  t: StorefrontTranslator;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "flex min-h-20 items-center gap-3 rounded-lg border p-2.5 text-left transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-200 bg-white hover:border-primary/40"
      )}
      onClick={onSelect}
    >
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-slate-100">
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt={line.imageAlt ?? line.productName} width={56} height={56} unoptimized className="size-full object-contain" />
        ) : (
          <FileImage className="size-5 text-slate-400" />
        )}
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">{line.productName}</span>
        <span className="mt-1 block text-xs text-slate-500">
          {line.sku} · {txFormat(t, "storefront.rma.order.lineAvailable", "Disponibili {count}", { count: line.remainingQuantity })}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs font-semibold text-slate-600">
        {formatEuro(line.unitPrice)}
      </span>
    </button>
  );
}

function LoadingBox({ text }: { text: string }) {
  return (
    <div className="flex min-h-20 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500" aria-live="polite">
      <Loader2 className="size-4 animate-spin" />
      {text}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">{text}</div>;
}

function RmaSubmitStatus({
  state,
  t,
}: {
  state: RmaSubmitState;
  t: StorefrontTranslator;
}) {
  if (state.status === "idle") {
    return <div className="text-xs text-slate-500" aria-live="polite">{state.message}</div>;
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm font-semibold",
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : state.status === "error"
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-primary/20 bg-primary/5 text-primary"
      )}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {state.status === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : null}
        {state.status === "error" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : null}
        <div>
          <div>{state.message}</div>
          {state.status === "success" ? (
            <div className="mt-1 text-xs font-normal">
              {tx(t, "storefront.rma.submit.successNext", "Conserva questo numero: il team aggiornerà qui i prossimi passaggi.")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RmaRequestCard({
  highlighted,
  onMarkShipped,
  onShippingDraftChange,
  request,
  shippingBusy,
  shippingDraft,
  shippingNotice,
  t,
}: {
  highlighted: boolean;
  onMarkShipped: () => void;
  onShippingDraftChange: (key: keyof ShippingDraft, value: string) => void;
  request: CustomerRmaDto;
  shippingBusy: boolean;
  shippingDraft: ShippingDraft;
  shippingNotice?: ShippingNotice;
  t: StorefrontTranslator;
}) {
  return (
    <article
      id={`rma-request-${request.id}`}
      className={cn(
        "space-y-3 rounded-xl border bg-white p-4 transition",
        highlighted ? "border-primary ring-2 ring-primary/20" : "border-slate-200"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black">{request.rmaNo ?? request.id}</div>
          <div className="mt-1 text-xs text-slate-500">
            {request.productName} · {request.sku} · {formatQuantity(request.quantity, t)}
          </div>
        </div>
        <Badge variant="outline" className="border-primary/20 text-primary">
          {rmaCustomerStageLabel(t, request.customerStage)}
        </Badge>
      </div>
      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <div><span className="font-semibold">{tx(t, "storefront.rma.result.order", "Ordine")}: </span>{request.orderNumber ?? "—"}</div>
        <div><span className="font-semibold">{tx(t, "storefront.rma.reason.label", "Motivo")}: </span>{rmaReasonLabel(t, request.reasonCode)}</div>
        <div><span className="font-semibold">{tx(t, "storefront.rma.resolution.label", "Soluzione")}: </span>{rmaResolutionLabel(t, request.requestedResolution)}</div>
      </div>
      {request.customerVisibleNote ? <p className="text-sm leading-6 text-slate-600">{request.customerVisibleNote}</p> : null}
      {request.customerShippedAt ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm font-semibold text-primary">
          {txFormat(t, "storefront.rma.shipped.time", "Spedito il {date}", { date: formatCustomerDateTime(request.customerShippedAt) })}
          {request.carrier || request.tracking ? (
            <div className="mt-1 text-xs font-normal text-slate-600">
              {[request.carrier, request.tracking].filter(Boolean).join(" · ")}
            </div>
          ) : null}
        </div>
      ) : null}
      {request.canMarkShipped ? (
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              {tx(t, "storefront.rma.shipped.details", "Aggiungi dati di spedizione (opzionale)")}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-slate-600">
                <span>{tx(t, "storefront.rma.shipped.carrier", "Corriere (opzionale)")}</span>
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  value={shippingDraft.carrier}
                  onChange={(event) => onShippingDraftChange("carrier", event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">
                <span>{tx(t, "storefront.rma.shipped.tracking", "Tracking (opzionale)")}</span>
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  value={shippingDraft.tracking}
                  onChange={(event) => onShippingDraftChange("tracking", event.target.value)}
                />
              </label>
            </div>
          </details>
          <p className="text-xs text-slate-600">
            {tx(t, "storefront.rma.shipped.hint", "Corriere e tracking non sono necessari: puoi confermare con un tocco.")}
          </p>
          <Button type="button" className="w-full sm:w-auto" disabled={shippingBusy} aria-busy={shippingBusy} onClick={onMarkShipped}>
            {shippingBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {shippingBusy
              ? tx(t, "storefront.rma.shipped.loading", "Registrazione...")
              : tx(t, "storefront.rma.shipped.button", "Ho spedito il reso")}
          </Button>
          {shippingNotice ? (
            <div
              className={cn(
                "rounded-md border p-2 text-sm font-semibold",
                shippingNotice.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
              role={shippingNotice.tone === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {shippingNotice.message}
            </div>
          ) : null}
        </div>
      ) : null}
      {request.attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label={tx(t, "storefront.rma.image.title", "Foto della richiesta")}>
          {request.attachments.map((attachment) => (
            attachment.signedUrl ? (
              <a
                key={attachment.attachmentId}
                href={attachment.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
              >
                <FileImage className="size-3.5" />
                {attachment.name}
              </a>
            ) : (
              <span key={attachment.attachmentId} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500">
                <FileImage className="size-3.5" />
                {attachment.name}
              </span>
            )
          ))}
        </div>
      ) : null}
    </article>
  );
}

function formatQuantity(quantity: number, t: StorefrontTranslator) {
  return `${quantity} ${tx(t, "storefront.common.pieces", "pezzi")}`;
}

function formatCustomerDateTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

function imageRejectMessage(t: StorefrontTranslator, reason: RmaImageRejectReason) {
  switch (reason) {
    case "max_images":
      return tx(t, "storefront.rma.image.limit", "Puoi aggiungere al massimo 6 foto.");
    case "heic_image_over_4mb":
      return tx(t, "storefront.rma.image.tooLarge", "Questa foto supera il limite di 4 MB e non può essere compressa.");
    case "duplicate_image":
      return tx(t, "storefront.rma.image.duplicate", "Questa foto è già stata aggiunta.");
    default:
      return tx(t, "storefront.rma.image.invalid", "Questo file non è un'immagine supportata.");
  }
}

function imageStatusLabel(
  t: StorefrontTranslator,
  status: LocalRmaImage["status"]
) {
  switch (status) {
    case "preparing":
      return tx(t, "storefront.rma.image.preparingShort", "Preparazione...");
    case "uploading":
      return tx(t, "storefront.rma.image.uploadingShort", "Caricamento...");
    case "verifying":
      return tx(t, "storefront.rma.image.verifyingShort", "Verifica...");
    case "retrying":
      return tx(t, "storefront.rma.image.retryingShort", "Riprovo...");
    case "error":
      return tx(t, "storefront.rma.image.failedShort", "Non riuscita");
    default:
      return "";
  }
}

function createQuantityOptions(remainingQuantity: number) {
  if (!Number.isInteger(remainingQuantity) || remainingQuantity < 1) {
    return [];
  }
  return Array.from({ length: Math.min(remainingQuantity, 100) }, (_, index) => String(index + 1));
}

function createClientId(prefix: string) {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${randomUuid ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function readApiError(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error) || typeof payload.error.message !== "string") {
    return null;
  }
  return payload.error.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function applyInitialOrderSelection(
  current: RmaFormState,
  orders: RmaOrderOption[],
  initialOrderId?: string,
  initialOrderLineId?: string
) {
  const explicitOrder = orders.find(
    (order) => order.id === initialOrderId || order.number === initialOrderId
  );
  const orderFromLine = initialOrderLineId
    ? orders.find((order) => order.lines.some((line) => line.id === initialOrderLineId))
    : undefined;
  const order = explicitOrder ?? orderFromLine ?? (orders.length === 1 ? orders[0] : undefined);
  const line = order
    ? order.lines.find((item) => item.id === initialOrderLineId) ?? (order.lines.length === 1 ? order.lines[0] : undefined)
    : undefined;

  return {
    ...current,
    orderId: order?.id ?? "",
    orderLineId: line?.id ?? "",
    quantity: "1",
  };
}

function sanitizeFormSelection(current: RmaFormState, orders: RmaOrderOption[]) {
  const order = orders.find((item) => item.id === current.orderId);
  if (!order) {
    return { ...current, orderId: "", orderLineId: "", quantity: "1" };
  }

  const line = order.lines.find((item) => item.id === current.orderLineId) ?? (order.lines.length === 1 ? order.lines[0] : undefined);
  const options = createQuantityOptions(line?.remainingQuantity ?? 0);
  return {
    ...current,
    orderLineId: line?.id ?? "",
    quantity: options.includes(current.quantity) ? current.quantity : "1",
  };
}

function decrementLineRemaining(orders: RmaOrderOption[], lineId: string, quantity: number) {
  return orders
    .map((order) => ({
      ...order,
      lines: order.lines
        .map((line) =>
          line.id === lineId
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

function dedupeCustomerRmaRequests(requests: CustomerRmaDto[]) {
  const byId = new Map<string, CustomerRmaDto>();
  for (const request of requests) {
    if (!byId.has(request.id)) {
      byId.set(request.id, request);
    }
  }
  return [...byId.values()];
}
