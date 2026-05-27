"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-state";

type MoneyDto = {
  amount: string;
  cents: number;
  currency: "EUR";
};

type OrderResult = {
  id: string;
  status: string;
  totals: {
    subtotal: MoneyDto;
    shipping: MoneyDto;
    vat: MoneyDto;
    total: MoneyDto;
  };
  lines: Array<{
    sku: string;
    quantity: number;
    lineGross: MoneyDto;
  }>;
};

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string; order: OrderResult }
  | { status: "error"; message: string };

type CheckoutSubmitButtonProps = {
  formId: string;
  companyId?: string;
  disabled?: boolean;
  disabledReason?: string;
  runtimeMode?: "ready" | "disabled";
};

export function CheckoutSubmitButton({
  companyId,
  formId,
  disabled = false,
  disabledReason,
  runtimeMode = disabled ? "disabled" : "ready",
}: CheckoutSubmitButtonProps) {
  const cart = useCart();
  const cartDisabledReason = getCartDisabledReason(cart.isHydrated, cart.items.length);
  const effectiveDisabled = disabled || Boolean(cartDisabledReason);
  const [state, setState] = React.useState<SubmitState>({
    status: "idle",
    message: "",
  });
  const currentMessage =
    state.status === "idle"
      ? idleMessage(runtimeMode, disabledReason ?? cartDisabledReason)
      : state.message;

  async function submitOrder() {
    if (effectiveDisabled) {
      setState({
        status: "error",
        message:
          disabledReason ??
          cartDisabledReason ??
          "Checkout disabilitato in questo momento.",
      });
      return;
    }

    const form = document.getElementById(formId);

    if (!(form instanceof HTMLFormElement)) {
      setState({
        status: "error",
        message: "Modulo checkout non trovato. Ricarica la pagina e riprova.",
      });
      return;
    }

    if (!form.reportValidity()) {
      setState({
        status: "error",
        message: "Completa i campi obbligatori e le conferme prima di inviare l'ordine.",
      });
      return;
    }

    const formData = new FormData(form);
    const selectedCompanyId = companyId?.trim();
    const paymentMethod = readPaymentMethod(formData);
    const deliveryMethod = readDeliveryMethod(formData);
    const deliveryWindow = readOptionalText(formData, "deliveryWindow");
    const purchaseOrderNumber = readOptionalText(formData, "purchaseOrderNumber");
    const deliveryAddress = readDeliveryAddress(formData);
    const companySnapshot = readCompanySnapshot(formData, deliveryAddress);
    const notes = buildOrderNotes(
      readOptionalText(formData, "notes"),
      deliveryMethod,
      deliveryWindow
    );
    const items = cart.items;

    if (!selectedCompanyId) {
      setState({
        status: "error",
        message: "Profilo cliente non disponibile: collega o completa il cliente prima di confermare l'ordine.",
      });
      return;
    }

    setState({ status: "loading", message: "Creazione ordine in corso..." });

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(removeEmptyValues({
          companyId: selectedCompanyId,
          paymentMethod,
          purchaseOrderNumber,
          deliveryAddress,
          fiscal: {
            companySnapshot,
          },
          notes,
          items,
        })),
      });

      const payload = (await response.json().catch(() => null)) as {
        data?: OrderResult;
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Ordine non accettato dal gestionale.");
      }

      if (!payload?.data?.id || !payload.data.totals?.total) {
        throw new Error("Risposta ordine incompleta. Controlla l'API /api/orders.");
      }

      cart.clearCart();
      setState({
        status: "success",
        message: `Ordine ${payload.data.id} creato correttamente.`,
        order: payload.data,
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Errore durante l'invio.",
      });
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="h-11 w-full"
        onClick={submitOrder}
        disabled={effectiveDisabled || state.status === "loading" || state.status === "success"}
      >
        {state.status === "loading" && <Loader2 className="size-4 animate-spin" />}
        {state.status === "success" && <CheckCircle2 className="size-4" />}
        {state.status === "idle" && <Send className="size-4" />}
        {buttonLabel(state.status, runtimeMode, effectiveDisabled, cart.isHydrated, cart.items.length)}
      </Button>
      {state.status !== "success" && effectiveDisabled && (disabledReason || cartDisabledReason) && (
        <StatusMessage tone="warning" message={disabledReason ?? cartDisabledReason ?? ""} />
      )}
      {state.status === "error" && <StatusMessage tone="error" message={state.message} />}
      {state.status !== "error" && state.status !== "success" && !effectiveDisabled && (
        <StatusMessage tone="neutral" message={currentMessage} />
      )}
      {state.status === "success" && <OrderSuccess order={state.order} message={state.message} />}
    </div>
  );
}

function OrderSuccess({ order, message }: { order: OrderResult; message: string }) {
  const totalQuantity = order.lines.reduce((total, line) => total + line.quantity, 0);

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-black">{message}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-emerald-800">
            <span className="font-mono">{order.id}</span>
            <span>{statusLabel(order.status)}</span>
            <span>{totalQuantity} pezzi</span>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-white/70 p-3">
        <ResultLine label="Subtotale" value={formatMoney(order.totals.subtotal)} />
        <ResultLine
          label="Spedizione"
          value={order.totals.shipping.cents === 0 ? "Gratis" : formatMoney(order.totals.shipping)}
        />
        <ResultLine label="IVA" value={formatMoney(order.totals.vat)} />
        <ResultLine label="Totale ordine" value={formatMoney(order.totals.total)} strong />
      </div>
    </div>
  );
}

function StatusMessage({
  tone,
  message,
}: {
  tone: "neutral" | "warning" | "error";
  message: string;
}) {
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-white text-slate-500";

  return (
    <div className={`flex gap-2 rounded-lg border p-3 text-xs font-semibold leading-5 ${toneClass}`}>
      {tone !== "neutral" && <AlertCircle className="mt-0.5 size-4 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function ResultLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
      <span className={strong ? "font-black" : "text-emerald-800"}>{label}</span>
      <span className={strong ? "text-right text-base font-black" : "text-right font-bold"}>
        {value}
      </span>
    </div>
  );
}

function readPaymentMethod(formData: FormData) {
  const value = formData.get("paymentMethod");

  if (value === "card" || value === "agreed_terms") {
    return value;
  }

  return "bank_transfer";
}

function readDeliveryMethod(formData: FormData) {
  const value = formData.get("deliveryMethod");

  if (value === "insured_express") {
    return "Espresso assicurato";
  }

  if (value === "pickup_milano") {
    return "Ritiro sede Milano";
  }

  if (value === "express_24_48") {
    return "Corriere espresso 24/48h";
  }

  return undefined;
}

function readOptionalText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredText(formData: FormData, key: string) {
  return readOptionalText(formData, key) ?? "";
}

function readDeliveryAddress(formData: FormData) {
  return {
    street: readRequiredText(formData, "shippingStreet"),
    zip: readRequiredText(formData, "shippingZip"),
    city: readRequiredText(formData, "shippingCity"),
    province: readRequiredText(formData, "shippingProvince"),
    country: "IT",
  };
}

function readCompanySnapshot(
  formData: FormData,
  deliveryAddress: ReturnType<typeof readDeliveryAddress>
) {
  return {
    name: readRequiredText(formData, "companyName"),
    partitaIva: readRequiredText(formData, "partitaIva"),
    codiceFiscale: readRequiredText(formData, "codiceFiscale"),
    pec: readRequiredText(formData, "pec"),
    codiceDestinatario: readRequiredText(formData, "codiceDestinatario"),
    address: deliveryAddress,
  };
}

function removeEmptyValues<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}

function buildOrderNotes(
  customerNotes: string | undefined,
  deliveryMethod: string | undefined,
  deliveryWindow: string | undefined
) {
  const details = [
    deliveryMethod ? `Consegna: ${deliveryMethod}` : undefined,
    deliveryWindow ? `Fascia: ${deliveryWindow}` : undefined,
    customerNotes ? `Note: ${customerNotes}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return details.length > 0 ? details.join(" | ").slice(0, 500) : undefined;
}

function idleMessage(
  runtimeMode: CheckoutSubmitButtonProps["runtimeMode"],
  disabledReason?: string
) {
  if (runtimeMode === "ready") {
    return "Checkout pronto: conferma l'ordine tramite /api/orders.";
  }

  if (runtimeMode === "disabled") {
    return disabledReason ?? "Checkout disabilitato in questo momento.";
  }

  return "Checkout pronto: invia a /api/orders le righe salvate nel carrello.";
}

function buttonLabel(
  status: SubmitState["status"],
  runtimeMode: string,
  disabled: boolean,
  isCartHydrated: boolean,
  itemCount: number
) {
  if (status === "success") {
    return "Ordine inviato";
  }

  if (status === "loading") {
    return "Invio ordine...";
  }

  if (disabled || runtimeMode === "disabled") {
    return "Checkout disabilitato";
  }

  if (!isCartHydrated) {
    return "Caricamento carrello";
  }

  if (itemCount === 0) {
    return "Carrello vuoto";
  }

  return "Conferma ordine";
}

function getCartDisabledReason(isHydrated: boolean, itemCount: number) {
  if (!isHydrated) {
    return "Caricamento carrello salvato nel browser...";
  }

  if (itemCount === 0) {
    return "Il carrello è vuoto: aggiungi almeno un prodotto prima di confermare l'ordine.";
  }

  return undefined;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Bozza",
    pending_payment: "In attesa pagamento",
    paid: "Pagato",
    picking: "In preparazione",
    shipped: "Spedito",
    delivered: "Consegnato",
    cancelled: "Annullato",
  };

  return labels[status] ?? status;
}

function formatMoney(value: MoneyDto) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: value.currency,
  }).format(Number(value.amount));
}
