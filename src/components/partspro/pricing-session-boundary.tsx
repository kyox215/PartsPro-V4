"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PartProduct } from "@/lib/partspro-data";
import { tx } from "@/i18n/dictionaries/storefront";
import { useT } from "./i18n-provider";
import { usePricingSession } from "./use-pricing-session";

/** Catalog pages can discard cached results; checkout preserves its form separately. */
export function PricingSessionBoundary({ userId, children }: { userId?: string | null; children: ReactNode }) {
  const session = usePricingSession(userId);
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => {
        setRevision((value) => value + 1);
        router.refresh();
      });
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("partspro-pricing-invalidated", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("partspro-pricing-invalidated", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  const loading = <div role="status" className="p-8">{tx(t, "storefront.cart.sync.catalogTitle", "Aggiornamento prezzi e disponibilità...")}</div>;
  if (!session.ready) return loading;
  return <>{pending ? loading : null}<div hidden={pending} key={`${session.key}:${revision}`}>{children}</div></>;
}

// Shared by streamed shelves so one expired boundary causes one refresh, even on remount.
const refreshedExpiries = new Set<number>();
export function QuoteExpiryRefresh({ products }: { products: readonly Pick<PartProduct, "priceValidUntil">[] }) {
  const boundaries = JSON.stringify(Array.from(new Set(products.map((product) => Date.parse(product.priceValidUntil ?? "")).filter(Number.isFinite))).sort((a, b) => a - b));
  useEffect(() => {
    const times = JSON.parse(boundaries) as number[];
    const refresh = (time: number) => {
      if (refreshedExpiries.has(time)) return;
      refreshedExpiries.add(time);
      if (refreshedExpiries.size > 256) refreshedExpiries.delete(refreshedExpiries.values().next().value!);
      window.dispatchEvent(new Event("partspro-pricing-invalidated"));
    };
    const expired = times.filter((time) => time <= Date.now() && !refreshedExpiries.has(time));
    if (expired.length) {
      const timer = window.setTimeout(() => {
        expired.slice(0, -1).forEach((time) => refreshedExpiries.add(time));
        refresh(expired[expired.length - 1]);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const next = times.find((time) => time > Date.now());
    if (next === undefined) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (Date.now() < next) schedule();
        else refresh(next);
      }, Math.min(2_147_483_647, Math.max(1, next - Date.now() + 50)));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [boundaries]);
  return null;
}
