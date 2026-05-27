"use client";

import Link from "next/link";
import {
  CreditCard,
  FileText,
  Package,
  User,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/i18n/format";
import { translateText } from "@/i18n/dictionaries/auto-translate";
import { tx } from "@/i18n/dictionaries/storefront";
import { PartVisual } from "./part-visual";
import { useCart } from "./cart-state";
import { useI18n, useT } from "./i18n-provider";

export function HomeRightRail() {
  const t = useT();
  const { locale } = useI18n();
  const cart = useCart();
  const totals = cart.totals;
  const visibleLines = totals.lines.slice(0, 3);
  const lineLabel =
    totals.lines.length === 1
      ? tx(t, "storefront.home.rightRail.cart.oneLine", "1 riga")
      : tx(t, "storefront.home.rightRail.cart.manyLines", `${totals.lines.length} righe`).replace(
          "{count}",
          String(totals.lines.length)
        );

  return (
    <aside className="hidden space-y-4 xl:block">
      <section id="cart" className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-black">
            {tx(t, "storefront.home.rightRail.cart.title", "Anteprima carrello")}
          </h2>
          <Badge className="bg-primary/10 text-primary">{lineLabel}</Badge>
        </div>
        {visibleLines.length > 0 ? (
          <div className="space-y-3">
            {visibleLines.map((line) => {
              const productName = translateText(line.product.name, locale);

              return (
                <div key={line.sku} className="flex gap-3">
                  <PartVisual variant={line.product.visual} className="size-12 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold">{productName}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{line.sku}</div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-emerald-600">
                        {tx(t, "storefront.home.rightRail.cart.quantity", "{count} pz").replace(
                          "{count}",
                          String(line.quantity)
                        )}
                      </span>
                      <span className="font-bold text-primary">
                        {formatMoney(line.lineTotal, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-semibold leading-5 text-slate-500">
            {tx(
              t,
              "storefront.home.rightRail.cart.empty",
              "Aggiungi un prodotto per preparare checkout e ordine."
            )}
          </div>
        )}
        <Separator className="my-4" />
        <div className="mb-4 flex items-center justify-between text-sm font-bold">
          <span>{tx(t, "storefront.home.rightRail.cart.subtotal", "Subtotale")}</span>
          <span>{formatMoney(totals.subtotal, locale)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" asChild>
            <Link href="/carrello">{tx(t, "nav.cart", "Carrello")}</Link>
          </Button>
          {totals.lines.length === 0 ? (
            <Button disabled>{tx(t, "storefront.common.checkout", "Checkout")}</Button>
          ) : (
            <Button asChild>
              <Link href="/checkout">{tx(t, "storefront.common.checkout", "Checkout")}</Link>
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h2 className="mb-3 font-black">
          {tx(t, "storefront.home.rightRail.account.title", "Area buyer")}
        </h2>
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
            <User className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">
              {tx(t, "storefront.common.b2bAccount", "Account B2B")}
            </div>
            <div className="truncate text-xs text-slate-500">
              {tx(t, "storefront.home.rightRail.account.subtitle", "Prezzi, ordini e RMA")}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/account">{tx(t, "nav.orders", "Ordini")}</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/rma">RMA</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h2 className="mb-3 font-black">
          {tx(t, "storefront.home.rightRail.invoice.title", "Documenti B2B")}
        </h2>
        <div className="space-y-2 text-sm font-semibold text-slate-600">
          <InfoRow icon={CreditCard} text={tx(t, "storefront.home.rightRail.invoice.payment", "Prezzi netti dopo approvazione")} />
          <InfoRow icon={FileText} text={tx(t, "storefront.home.rightRail.invoice.eInvoice", "Fattura elettronica con PEC / SDI")} />
          <InfoRow icon={Package} text={tx(t, "storefront.home.rightRail.invoice.trace", "SKU e lotti tracciati in ordine")} />
        </div>
      </section>
    </aside>
  );
}

function InfoRow({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 truncate">{text}</span>
    </div>
  );
}
