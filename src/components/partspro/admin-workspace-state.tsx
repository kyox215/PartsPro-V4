"use client";

import * as React from "react";

type Workspace = { userId: string | null; queries: Map<string, unknown> };
const Context = React.createContext<Workspace | null>(null);
export function AdminWorkspaceStateProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const context = React.useMemo(() => ({ userId, queries: new Map<string, unknown>() }), [userId]);
  return <Context.Provider key={userId ?? "anonymous"} value={context}>{children}</Context.Provider>;
}

function restoreShape<T>(raw: unknown, defaults: T): T {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !defaults || typeof defaults !== "object") return defaults;
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const value = (raw as Record<string, unknown>)[key];
    const valid = typeof fallback === "string" ? typeof value === "string" && value.length <= 500
      : typeof fallback === "number" ? typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000
      : typeof fallback === "boolean" ? typeof value === "boolean"
      : Array.isArray(fallback) ? Array.isArray(value) && value.length <= 100 && value.every(item => typeof item === "string")
      : false;
    return [key, valid ? value : fallback];
  })) as T;
}

// Stores query preferences only. Never use this hook for records, messages, forms or secrets.
export function usePersistentAdminQuery<T extends object>(name: string, initial: T | (() => T), options: { persist?: boolean; storage?: "session" | "local" } = {}) {
  const workspace = React.useContext(Context);
  const storageKey = options.persist !== false && workspace?.userId ? `partspro:admin-query:v1:${workspace.userId}:${name}` : null;
  const storageType = options.storage ?? "session";
  const [value, setValue] = React.useState<T>(() => {
    const defaults = typeof initial === "function" ? initial() : initial;
    const cached = workspace?.queries.get(name);
    if (cached) return restoreShape(cached, defaults);
    if (storageKey && typeof window !== "undefined") {
      try {
        const stored = (storageType === "local" ? localStorage : sessionStorage).getItem(storageKey);
        if (stored) return restoreShape(JSON.parse(stored), defaults);
      } catch { /* Optional query preferences. */ }
    }
    return defaults;
  });
  React.useEffect(() => {
    workspace?.queries.set(name, value);
    if (storageKey) {
      try { (storageType === "local" ? localStorage : sessionStorage).setItem(storageKey, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
    }
  }, [name, storageKey, storageType, workspace, value]);
  return [value, setValue] as const;
}

export function usePersistentAdminValue(name: string, initial: string | (() => string)): readonly [string, React.Dispatch<React.SetStateAction<string>>];
export function usePersistentAdminValue(name: string, initial: number | (() => number)): readonly [number, React.Dispatch<React.SetStateAction<number>>];
export function usePersistentAdminValue(name: string, initial: boolean | (() => boolean)): readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>];
export function usePersistentAdminValue<T extends string | number | boolean>(name: string, initial: T | (() => T)): readonly [T, React.Dispatch<React.SetStateAction<T>>];
export function usePersistentAdminValue<T extends string | number | boolean>(name: string, initial: T | (() => T)) {
  const [query, setQuery] = usePersistentAdminQuery(name, () => ({ value: typeof initial === "function" ? initial() : initial }));
  const setValue = React.useCallback((next: React.SetStateAction<T>) => setQuery(current => ({ value: typeof next === "function" ? next(current.value) : next })), [setQuery]);
  return [query.value, setValue] as const;
}

export function useAdminWorkspaceUserId() { return React.useContext(Context)?.userId ?? null; }

export function useAdminMemoryQuery<T extends object>(name: string, initial: T | (() => T)) { return usePersistentAdminQuery(name, initial, { persist: false }); }

// Query text and selected record identifiers survive module switches only in memory.
export function useAdminMemoryValue(name: string, initial: string) {
  const [query, setQuery] = useAdminMemoryQuery(name, { value: initial });
  const setValue = React.useCallback((next: React.SetStateAction<string>) => setQuery(current => ({ value: typeof next === "function" ? next(current.value) : next })), [setQuery]);
  return [query.value, setValue] as const;
}
