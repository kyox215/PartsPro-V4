"use client";

import * as React from "react";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tx, txFormat } from "@/i18n/dictionaries/storefront";
import type { PartProduct } from "@/lib/partspro-data";
import { toPublicSku } from "@/lib/partspro-sku";
import { cn } from "@/lib/utils";
import { useT } from "./i18n-provider";
import {
  saveRestockRequest,
  useRestockRequests,
} from "./restock-request-state";

type ProductRestockReminderButtonProps = {
  className?: string;
  density?: "card" | "detail";
  isAuthenticated: boolean;
  product: PartProduct;
};

type SubmitState = "idle" | "loading" | "error";

export function ProductRestockReminderButton({
  className,
  density = "card",
  isAuthenticated,
  product,
}: ProductRestockReminderButtonProps) {
  const t = useT();
  const sku = toPublicSku(product.sku);
  const restockState = useRestockRequests(isAuthenticated);
  const [submitState, setSubmitState] = React.useState<SubmitState>("idle");
  const saved = isAuthenticated && restockState.skus.has(sku);
  const isLoading = submitState === "loading";
  const disabled = !isAuthenticated || saved || isLoading;
  const title = !isAuthenticated
    ? tx(t, "storefront.product.restock.loginRequired", "Accedi per salvare l'avviso di riassortimento")
    : saved
      ? tx(t, "storefront.product.restock.saved", "Avviso salvato")
      : txFormat(
          t,
          "storefront.product.restock.aria",
          "Avvisami quando {name} torna disponibile",
          { name: product.name }
        );

  async function handleClick() {
    if (disabled) {
      return;
    }

    setSubmitState("loading");

    try {
      await saveRestockRequest(sku);
      setSubmitState("idle");
    } catch {
      setSubmitState("error");
    }
  }

  const label = saved
    ? tx(t, "storefront.product.restock.saved", "Avviso salvato")
    : submitState === "error"
      ? tx(t, "storefront.product.restock.retry", "Riprova")
      : tx(
          t,
          "storefront.product.restock.request",
          "Avvisami al riassortimento"
        );

  return (
    <Button
      type="button"
      size={density === "detail" ? "lg" : "sm"}
      variant="outline"
      className={cn(
        "min-w-0 bg-white text-amber-700 hover:bg-amber-50 hover:text-amber-800",
        density === "detail"
          ? "h-10 flex-1 border-amber-200"
          : "size-8 shrink-0 border-amber-200 px-0 sm:size-auto sm:min-w-[96px] sm:px-2",
        saved && "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700",
        submitState === "error" && "border-red-200 bg-red-50 text-red-700",
        !isAuthenticated && "text-slate-500 hover:bg-white hover:text-slate-500",
        className
      )}
      disabled={disabled}
      onClick={handleClick}
      aria-label={title}
      title={title}
    >
      {isLoading ? (
        <Loader2 className="size-3.5 animate-spin sm:size-4" />
      ) : saved ? (
        <CheckCircle2 className="size-3.5 sm:size-4" />
      ) : (
        <Bell className="size-3.5 sm:size-4" />
      )}
      <span
        className={cn(
          "min-w-0 truncate",
          density === "card" && "sr-only sm:not-sr-only"
        )}
        aria-live="polite"
      >
        {label}
      </span>
    </Button>
  );
}
