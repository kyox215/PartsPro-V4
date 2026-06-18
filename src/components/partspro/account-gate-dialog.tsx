"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tx, txFormat } from "@/i18n/dictionaries/storefront";
import {
  getAccountGateCopy,
  type AccountGateCopy,
} from "@/lib/partspro-account-gate-copy";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import { cn } from "@/lib/utils";
import { useT } from "./i18n-provider";

type AccountGateDialogProps = {
  loginNextPath?: string;
  moq?: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  productName?: string;
  reason: PriceVisibilityReason;
};

export function AccountGateDialog({
  loginNextPath,
  moq,
  onOpenChange,
  open,
  productName,
  reason,
}: AccountGateDialogProps) {
  const t = useT();
  const copy = getAccountGateCopy(t, reason, { loginNextPath, moq });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg border",
                accountGateIconClassName(copy)
              )}
            >
              <AccountGateStatusIcon tone={copy.tone} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-black leading-5 text-slate-950">
                {copy.title}
              </DialogTitle>
              <DialogDescription className="mt-1 leading-5">
                {productName
                  ? txFormat(
                      t,
                      "storefront.accountGate.dialogProduct",
                      "Prodotto: {name}",
                      { name: productName }
                    )
                  : copy.cardTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-sm text-slate-700">
          <p className="leading-6">{copy.description}</p>
          {copy.steps.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-black uppercase text-slate-500">
                {tx(t, "storefront.accountGate.stepsTitle", "Cosa fare")}
              </div>
              <ul className="mt-2 space-y-2">
                {copy.steps.map((step) => (
                  <li key={step} className="flex items-start gap-2 text-xs font-semibold leading-5">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="bg-white">
              {tx(t, "storefront.accountGate.close", "Ho capito")}
            </Button>
          </DialogClose>
          {copy.actionHref && copy.actionLabel ? (
            <Button asChild>
              <Link href={copy.actionHref}>{copy.actionLabel}</Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function accountGateIconClassName(copy: AccountGateCopy) {
  if (copy.tone === "error") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (copy.tone === "info") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function AccountGateStatusIcon({ tone }: { tone: AccountGateCopy["tone"] }) {
  if (tone === "error") {
    return <AlertTriangle className="size-4" />;
  }

  if (tone === "info") {
    return <Info className="size-4" />;
  }

  return <Lock className="size-4" />;
}
