"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  orderStatusLabel,
  tx,
  txFormat,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import { cartItemsForApi, useCart } from "./cart-state";
import { useI18n, useT } from "./i18n-provider";

type MoneyDto = {
  amount: string;
  cents: number;
  currency: "EUR";
};

type OrderResult = {
  id: string;
  orderNo?: string;
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
  const t = useT();
  const router = useRouter();
  const cart = useCart({ preserveUnknown: true });
  const cartDisabledReason = getCartDisabledReason(
    t,
    cart.isHydrated,
    cart.items.length,
    cart.lines.length
  );
  const effectiveDisabled = disabled || Boolean(cartDisabledReason);
  const [state, setState] = React.useState<SubmitState>({
    status: "idle",
    message: "",
  });
  const currentMessage =
    state.status === "idle"
      ? idleMessage(t, runtimeMode, disabledReason ?? cartDisabledReason)
      : state.message;

  async function submitOrder() {
    if (effectiveDisabled) {
      setState({
        status: "error",
        message:
          disabledReason ??
          cartDisabledReason ??
          tx(t, "storefront.checkout.submit.defaultDisabled", "Checkout disabilitato in questo momento."),
      });
      return;
    }

    const form = document.getElementById(formId);

    if (!(form instanceof HTMLFormElement)) {
      setState({
        status: "error",
        message: tx(t, "storefront.checkout.submit.formMissing", "Modulo checkout non trovato. Ricarica la pagina e riprova."),
      });
      return;
    }

    if (!form.reportValidity()) {
      setState({
        status: "error",
        message: tx(t, "storefront.checkout.submit.invalidForm", "Completa i campi obbligatori e le conferme prima di inviare l'ordine."),
      });
      return;
    }

    const formData = new FormData(form);
    const selectedCompanyId = companyId?.trim();
    const paymentMethod = readPaymentMethod(formData);
    const deliveryMethod = readDeliveryMethod(formData);
    const purchaseOrderNumber = readOptionalText(formData, "purchaseOrderNumber");
    const deliveryAddress = readDeliveryAddress(formData);
    const companySnapshot = readCompanySnapshot(formData, deliveryAddress);
    const notes = buildOrderNotes(
      readOptionalText(formData, "notes"),
      deliveryMethod
    );
    const items = cartItemsForApi(cart.items);

    if (!selectedCompanyId) {
      setState({
        status: "error",
        message: tx(t, "storefront.checkout.submit.missingCustomer", "Profilo cliente non disponibile: collega o completa il cliente prima di confermare l'ordine."),
      });
      return;
    }

    setState({
      status: "loading",
      message: tx(t, "storefront.checkout.submit.sending", "Creazione ordine in corso..."),
    });

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
        throw new Error(payload?.error?.message ?? tx(t, "storefront.checkout.submit.orderRejected", "Ordine non accettato dal gestionale."));
      }

      if (!payload?.data?.id || !payload.data.totals?.total) {
        throw new Error(tx(t, "storefront.checkout.submit.orderIncomplete", "Risposta ordine incompleta. Controlla l'API /api/orders."));
      }

      cart.clearCart();
      router.refresh();
      const orderReference = payload.data.orderNo ?? payload.data.id;

      setState({
        status: "success",
        message: txFormat(t, "storefront.checkout.submit.orderAccepted", "Ordine {id} creato correttamente.", { id: orderReference }),
        order: payload.data,
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : tx(t, "storefront.checkout.submit.sendError", "Errore durante l'invio."),
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
        {buttonLabel(t, state.status, runtimeMode, effectiveDisabled, cart.isHydrated, cart.items.length)}
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
  const t = useT();
  const { locale } = useI18n();
  const totalQuantity = order.lines.reduce((total, line) => total + line.quantity, 0);
  const orderReference = order.orderNo ?? order.id;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-black">{message}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-emerald-800">
            <span className="font-mono">{orderReference}</span>
            <span>{orderStatusLabel(t, order.status)}</span>
            <span>
              {txFormat(t, "storefront.cart.itemCountMany", "{count} pezzi", {
                count: totalQuantity,
              })}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-white/70 p-3">
        <ResultLine
          label={tx(t, "storefront.common.subtotal", "Subtotale")}
          value={formatMoney(order.totals.subtotal, locale)}
        />
        <ResultLine
          label={tx(t, "storefront.common.shipping", "Spedizione")}
          value={
            order.totals.shipping.cents === 0
              ? tx(t, "storefront.common.free", "Gratis")
              : formatMoney(order.totals.shipping, locale)
          }
        />
        <ResultLine
          label={tx(t, "storefront.checkout.success.total", "Totale ordine")}
          value={formatMoney(order.totals.total, locale)}
          strong
        />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button asChild className="bg-emerald-700 hover:bg-emerald-700">
          <Link href="/account">{tx(t, "storefront.checkout.success.openOrders", "Vai agli ordini")}</Link>
        </Button>
        <Button asChild variant="outline" className="border-emerald-200 bg-white/70 text-emerald-800">
          <Link href="/catalogo">{tx(t, "storefront.common.continueShopping", "Continua acquisti")}</Link>
        </Button>
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

  if (value === "cash") {
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
  deliveryMethod: string | undefined
) {
  const details = [
    deliveryMethod ? `Consegna: ${deliveryMethod}` : undefined,
    customerNotes ? `Note: ${customerNotes}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return details.length > 0 ? details.join(" | ").slice(0, 500) : undefined;
}

function idleMessage(
  t: StorefrontTranslator,
  runtimeMode: CheckoutSubmitButtonProps["runtimeMode"],
  disabledReason?: string
) {
  if (runtimeMode === "ready") {
    return tx(t, "storefront.checkout.submit.idleReady", "Checkout pronto: conferma l'ordine tramite /api/orders.");
  }

  if (runtimeMode === "disabled") {
    return disabledReason ?? tx(t, "storefront.checkout.submit.idleDisabled", "Checkout disabilitato in questo momento.");
  }

  return tx(t, "storefront.checkout.submit.idleReadyFallback", "Checkout pronto: invia a /api/orders le righe salvate nel carrello.");
}

function buttonLabel(
  t: StorefrontTranslator,
  status: SubmitState["status"],
  runtimeMode: string,
  disabled: boolean,
  isCartHydrated: boolean,
  itemCount: number
) {
  if (status === "success") {
    return tx(t, "storefront.checkout.submit.button.success", "Ordine inviato");
  }

  if (status === "loading") {
    return tx(t, "storefront.checkout.submit.button.loading", "Invio ordine...");
  }

  if (disabled || runtimeMode === "disabled") {
    return tx(t, "storefront.checkout.submit.button.disabled", "Checkout disabilitato");
  }

  if (!isCartHydrated) {
    return tx(t, "storefront.checkout.submit.button.loadingCart", "Caricamento carrello");
  }

  if (itemCount === 0) {
    return tx(t, "storefront.checkout.submit.button.cartEmpty", "Carrello vuoto");
  }

  return tx(t, "storefront.checkout.submit.button.idle", "Conferma ordine");
}

function getCartDisabledReason(
  t: StorefrontTranslator,
  isHydrated: boolean,
  itemCount: number,
  lineCount: number
) {
  if (!isHydrated) {
    return tx(t, "storefront.checkout.submit.cartLoadingReason", "Caricamento carrello del tuo account...");
  }

  if (itemCount === 0) {
    return tx(t, "storefront.checkout.submit.cartEmptyReason", "Il carrello è vuoto: aggiungi almeno un prodotto prima di confermare l'ordine.");
  }

  if (lineCount !== itemCount) {
    return tx(t, "storefront.checkout.submit.unresolvedItemsReason", "Alcuni articoli del carrello non sono più disponibili: torna al carrello e rimuovili prima di confermare l'ordine.");
  }

  return undefined;
}

function formatMoney(value: MoneyDto, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
  }).format(Number(value.amount));
}
