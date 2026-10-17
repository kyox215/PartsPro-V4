"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isStorefrontPath } from "./storefront-navigation";
import { emptyCatalogDirectory, type CatalogDirectory, type CatalogNode } from "@/lib/partspro-catalog-directory";

const Context = createContext<CatalogDirectory>(emptyCatalogDirectory);
export function useCatalogDirectory() { return useContext(Context); }
export function notifyCatalogChanged() { window.dispatchEvent(new Event("partspro:catalog-changed")); }
export function CatalogDirectoryProvider({ children }: { children: ReactNode }) {
  const [directory, setDirectory] = useState(emptyCatalogDirectory);
  const revision = useRef("");
  const router = useRouter();
  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/catalog-directory", { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
      if (!response.ok) return;
      const payload = await response.json();
      const next = payload.data as CatalogDirectory;
      if (signal?.aborted || !Array.isArray(next?.nodes) || typeof next.revision !== "string") return;
      const changed = Boolean(revision.current && revision.current !== next.revision);
      revision.current = next.revision;
      setDirectory(next);
      if (changed) {
        window.dispatchEvent(new Event("partspro:catalog-refreshed"));
        if (!isStorefrontPath(window.location.pathname)) router.refresh();
      }
    } catch { /* Static labels remain usable when metadata is unavailable. Admin writes fail closed. */ }
  }, [router]);
  useEffect(() => {
    let controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void reload(controller.signal); });
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      controller.abort(); controller = new AbortController();
      void reload(controller.signal);
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("partspro:catalog-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("partspro:catalog-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);
  return <Context.Provider value={directory}>{children}</Context.Provider>;
}
export function sortedCatalogValues(nodes: CatalogNode[], kind: CatalogNode["kind"], values: string[]) {
  const configured = new Map(nodes.filter((n) => n.kind === kind).map((n) => [n.value.toLowerCase(), n]));
  return values.filter((v) => configured.get(v.toLowerCase())?.active !== false).sort((a, b) =>
    (configured.get(a.toLowerCase())?.position ?? 10000) - (configured.get(b.toLowerCase())?.position ?? 10000));
}
