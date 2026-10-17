"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createStorefrontRefresh, quoteIsCurrent, type RefreshState } from "@/lib/storefront-refresh.mjs";
import type { PartProduct } from "@/lib/partspro-data";

type RefreshContext = RefreshState & { userId: string | null | undefined; request: (reason?: string) => void; retry: () => void; reportExpectedUserId:(id:string|null)=>void };
const initial: RefreshState = { refreshVersion: 0, completedVersion: 0, refreshing: false, pricesInvalid: false, error: null };
const noop = () => {};
const Context = createContext<RefreshContext>({ ...initial, userId: undefined, request: noop, retry: noop, reportExpectedUserId:noop });

export function StorefrontRefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState(initial);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const identity = useRef<string | null | undefined>(undefined);
  const serverIdentity = useRef<string | null | undefined>(undefined);
  const sawPending = useRef(false);
  const [coordinator] = useState(() => createStorefrontRefresh({
    changed: setState,
    run: () => {
      startTransition(() => router.refresh());
    },
  }));
  useEffect(() => {
    if (pending) sawPending.current = true;
    else if (sawPending.current) {
      sawPending.current = false;
      if (identity.current !== undefined && serverIdentity.current !== undefined && identity.current !== serverIdentity.current) coordinator.fail(state.refreshVersion);
      else coordinator.complete(state.refreshVersion);
    }
  }, [pending, coordinator, state.refreshVersion]);
  useEffect(() => {
    coordinator.activate();
    const passive = () => { if (document.visibilityState === "visible") coordinator.request("focus"); };
    const invalidated = (event: Event) => {
      if (document.visibilityState !== "visible") return;
      coordinator.request((event as CustomEvent<{reason?: string}>).detail?.reason ?? "pricing");
    };
    window.addEventListener("focus", passive);
    document.addEventListener("visibilitychange", passive);
    window.addEventListener("partspro-pricing-invalidated", invalidated);
    window.addEventListener("partspro:catalog-refreshed", invalidated);
    const auth = isSupabaseConfigured() ? createClient().auth.onAuthStateChange((event, next) => {
      const nextId = next?.user.id ?? null;
      const previous = identity.current;
      identity.current = nextId;
      setUserId(nextId);
      if (event === "INITIAL_SESSION") return;
      queueMicrotask(() => {
        if (previous !== nextId || event === "SIGNED_OUT") coordinator.request(`identity:${JSON.stringify(nextId)}`);
        else if (event === "USER_UPDATED") coordinator.request("pricing");
        else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") coordinator.request("focus");
      });
    }) : null;
    return () => {
      window.removeEventListener("focus", passive);
      document.removeEventListener("visibilitychange", passive);
      window.removeEventListener("partspro-pricing-invalidated", invalidated);
      window.removeEventListener("partspro:catalog-refreshed", invalidated);
      auth?.data.subscription.unsubscribe();
      coordinator.dispose();
    };
  }, [coordinator]);
  const request = useCallback((reason?: string) => coordinator.request(reason), [coordinator]);
  const retry = useCallback(() => coordinator.request("retry"), [coordinator]);
  const reportExpectedUserId = useCallback((id:string|null) => { serverIdentity.current=id; }, []);
  const value = useMemo(() => ({ ...state, userId, request, retry, reportExpectedUserId }), [state, userId, request, retry, reportExpectedUserId]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStorefrontRefresh() { return useContext(Context); }

export function usePriceFreshness(product?: Pick<PartProduct, "priceValidUntil" | "quoteStatus">) {
  const state = useStorefrontRefresh();
  const [, tick] = useState(0);
  const expiry = Date.parse(product?.priceValidUntil ?? "");
  useEffect(() => {
    if (!Number.isFinite(expiry)) return;
    const remaining = expiry - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => tick(value => value + 1), Math.min(2_147_483_647, remaining + 5));
    return () => window.clearTimeout(timer);
  }, [expiry]);
  return { ...state, available: !state.pricesInvalid && !state.error && (!product || quoteIsCurrent(product)) };
}
