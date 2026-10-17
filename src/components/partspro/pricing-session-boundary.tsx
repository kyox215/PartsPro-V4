"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { PartProduct } from "@/lib/partspro-data";
import { usePricingSession } from "./use-pricing-session";
import { StorefrontLoading } from "./storefront-loading";

/** Only an identity mismatch replaces private UI. Refreshes preserve every child. */
export function PricingSessionBoundary({ userId, children }: { userId?: string | null; children: ReactNode }) {
  const session = usePricingSession(userId);
  const pathname = usePathname();
  if (!session.ready) return <StorefrontLoading variant={pathname.startsWith("/prodotto/") ? "product" : pathname === "/" ? "home" : "catalog"} />;
  return <div key={session.key}>{children}</div>;
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
      window.dispatchEvent(new CustomEvent("partspro-pricing-invalidated", { detail: { reason: "expiry" } }));
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
