"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { CartItem } from "./cart-state";
import {
  cartItemsForApi,
  mergeCartItemCollections,
  readClientStoredCartItems,
  replaceStoredCartItems,
  serializeCartItems,
  setCartStorageOwner,
  useStoredCartItems,
} from "./cart-state";
import { useI18n } from "./i18n-provider";

type CartApiPayload = {
  data?: CartItem[] | { items?: CartItem[] };
  error?: { code?: string; message?: string };
  meta?: { persistence?: string; reason?: string };
};

const syncDebounceMs = 500;
const realtimeRefreshDebounceMs = 250;
const sessionRetryDelaysMs = [0, 600, 1500, 3000] as const;
const syncErrorRetryDelaysMs = [1500, 4000, 10000] as const;
const CART_SYNC_RETRY_EVENT = "partspro-cart-sync-retry";
type RemoteCartWriteResult = "synced" | "local";
type RemoteCartLoadResult =
  | { status: "remote"; items: CartItem[] }
  | { status: "local" };
export type CartRemoteSyncStatus =
  | "idle"
  | "loading"
  | "restoring"
  | "ready"
  | "local"
  | "error";

export type CartSyncStatusSnapshot = {
  errorMessage?: string;
  remoteStatus: CartRemoteSyncStatus;
  updatedAt: number;
};

const defaultCartSyncStatus: CartSyncStatusSnapshot = {
  remoteStatus: "idle",
  updatedAt: 0,
};

let cartSyncStatusSnapshot = defaultCartSyncStatus;
const cartSyncStatusListeners = new Set<() => void>();

export function useCartSyncStatus() {
  return React.useSyncExternalStore(
    subscribeToCartSyncStatus,
    getCartSyncStatusSnapshot,
    getCartSyncStatusServerSnapshot
  );
}

export function requestCartSyncRetry() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CART_SYNC_RETRY_EVENT));
}

export function isCartRemoteSyncPending(status: CartRemoteSyncStatus) {
  return status === "loading" || status === "restoring";
}

export function isCartRemoteSyncError(status: CartRemoteSyncStatus) {
  return status === "error";
}

function subscribeToCartSyncStatus(listener: () => void) {
  cartSyncStatusListeners.add(listener);

  return () => {
    cartSyncStatusListeners.delete(listener);
  };
}

function getCartSyncStatusSnapshot() {
  return cartSyncStatusSnapshot;
}

function getCartSyncStatusServerSnapshot() {
  return defaultCartSyncStatus;
}

function setCartSyncStatus(next: Omit<CartSyncStatusSnapshot, "updatedAt">) {
  cartSyncStatusSnapshot = {
    ...next,
    updatedAt: Date.now(),
  };

  for (const listener of cartSyncStatusListeners) {
    listener();
  }
}

export function CartSyncBridge() {
  const { scope } = useI18n();
  const localItems = useStoredCartItems({ preserveUnknown: true });
  const [syncEnabled, setSyncEnabled] = React.useState(false);
  const [remoteLoaded, setRemoteLoaded] = React.useState(false);
  const applyingRemoteRef = React.useRef(false);
  const lastSyncedSnapshotRef = React.useRef("");
  const remoteSnapshotLoadedRef = React.useRef(false);

  React.useEffect(() => {
    if (scope !== "storefront") {
      remoteSnapshotLoadedRef.current = false;
      lastSyncedSnapshotRef.current = "";
      setCartSyncStatus({ remoteStatus: "idle" });
      return;
    }

    setCartSyncStatus({ remoteStatus: "loading" });

    let disposed = false;
    let activeRemoteController: AbortController | null = null;
    let errorRetryIndex = 0;
    let errorRetryTimeout: number | null = null;
    let refreshTimeout: number | null = null;
    let removeRealtimeChannel: (() => void) | null = null;
    let removeAuthListener: (() => void) | null = null;
    let remoteAttempt = 0;

    function beginRemoteAttempt() {
      remoteAttempt += 1;
      activeRemoteController?.abort();
      activeRemoteController = new AbortController();

      return {
        attempt: remoteAttempt,
        signal: activeRemoteController.signal,
      };
    }

    function isCurrentRemoteAttempt(attempt: number, signal: AbortSignal) {
      return !disposed && !signal.aborted && attempt === remoteAttempt;
    }

    function clearErrorRetry() {
      if (errorRetryTimeout !== null) {
        window.clearTimeout(errorRetryTimeout);
        errorRetryTimeout = null;
      }
    }

    function resetErrorRetry() {
      errorRetryIndex = 0;
      clearErrorRetry();
    }

    function stopRemoteListeners() {
      removeRealtimeChannel?.();
      removeRealtimeChannel = null;
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
    }

    function scheduleErrorRetry() {
      if (
        disposed ||
        errorRetryTimeout !== null ||
        errorRetryIndex >= syncErrorRetryDelaysMs.length
      ) {
        return;
      }

      const delay = syncErrorRetryDelaysMs[errorRetryIndex];
      errorRetryIndex += 1;
      errorRetryTimeout = window.setTimeout(() => {
        errorRetryTimeout = null;
        if (!disposed && document.visibilityState === "visible") {
          retryRemoteCartSync({ resetBackoff: false });
        }
      }, delay);
    }

    function enterRemoteErrorMode(
      errorMessage: string,
      options: { remoteLoaded?: boolean } = {}
    ) {
      if (disposed) {
        return;
      }

      setSyncEnabled(false);
      setRemoteLoaded(options.remoteLoaded ?? true);
      setCartSyncStatus({
        errorMessage,
        remoteStatus: "error",
      });
      scheduleErrorRetry();
    }

    function enterLocalMode() {
      stopRemoteListeners();
      resetErrorRetry();

      setCartStorageOwner(null);
      lastSyncedSnapshotRef.current = serializeCartItems([]);
      remoteSnapshotLoadedRef.current = false;
      if (!disposed) {
        setSyncEnabled(false);
        setRemoteLoaded(true);
        setCartSyncStatus({ remoteStatus: "local" });
      }
    }

    function enterRestoringMode() {
      stopRemoteListeners();
      resetErrorRetry();
      remoteSnapshotLoadedRef.current = false;
      if (!disposed) {
        setSyncEnabled(false);
        setRemoteLoaded(false);
        setCartSyncStatus({
          errorMessage: "Restoring account cart session",
          remoteStatus: "restoring",
        });
      }
    }

    function applyRemoteCartItems(remoteItems: CartItem[]) {
      const localStoredItems = readClientStoredCartItems({ preserveUnknown: true });
      const nextItems = preserveLocalSnapshots(remoteItems, localStoredItems);
      const localSnapshot = serializeCartItems(localStoredItems);
      const remoteSnapshot = serializeCartItems(nextItems);

      lastSyncedSnapshotRef.current = remoteSnapshot;
      remoteSnapshotLoadedRef.current = true;

      if (localSnapshot === remoteSnapshot) {
        return true;
      }

      applyingRemoteRef.current = true;

      if (!replaceStoredCartItems(nextItems, { preserveUnknown: true })) {
        applyingRemoteRef.current = false;
        enterLocalMode();
        return false;
      }

      queueMicrotask(() => {
        applyingRemoteRef.current = false;
      });

      return true;
    }

    async function refreshRemoteCart() {
      const { attempt, signal } = beginRemoteAttempt();

      try {
        const result = await readRemoteCart(signal);

        if (!isCurrentRemoteAttempt(attempt, signal)) {
          return;
        }

        if (result.status === "local") {
          enterLocalMode();
          return;
        }

        if (!applyRemoteCartItems(result.items)) {
          return;
        }

        resetErrorRetry();
        setSyncEnabled(true);
        setRemoteLoaded(true);
        setCartSyncStatus({ remoteStatus: "ready" });
      } catch {
        if (!signal.aborted && attempt === remoteAttempt) {
          enterRemoteErrorMode("Unable to refresh remote cart");
        }
      }
    }

    function hasPendingLocalCartWrite() {
      if (!remoteSnapshotLoadedRef.current) {
        return false;
      }

      const localSnapshot = serializeCartItems(
        readClientStoredCartItems({ preserveUnknown: true })
      );

      return localSnapshot !== lastSyncedSnapshotRef.current;
    }

    async function saveCurrentLocalCart() {
      const { attempt, signal } = beginRemoteAttempt();

      try {
        const items = readClientStoredCartItems({ preserveUnknown: true });
        const snapshot = serializeCartItems(items);
        const result = await writeRemoteCart(items, signal);

        if (!isCurrentRemoteAttempt(attempt, signal)) {
          return;
        }

        if (result === "local") {
          enterLocalMode();
          return;
        }

        lastSyncedSnapshotRef.current = snapshot;
        remoteSnapshotLoadedRef.current = true;
        resetErrorRetry();
        setSyncEnabled(true);
        setRemoteLoaded(true);
        setCartSyncStatus({ remoteStatus: "ready" });
      } catch {
        if (!signal.aborted && attempt === remoteAttempt) {
          enterRemoteErrorMode("Unable to save remote cart");
        }
      }
    }

    function scheduleRemoteRefresh() {
      if (disposed) {
        return;
      }

      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }

      refreshTimeout = window.setTimeout(() => {
        refreshTimeout = null;
        void refreshRemoteCart();
      }, realtimeRefreshDebounceMs);
    }

    function subscribeToRemoteCart(userId: string) {
      if (!isSupabaseConfigured()) {
        return;
      }

      const supabase = createClient();
      const channel = supabase
        .channel(`partspro-cart-sync:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            filter: `user_id=eq.${userId}`,
            schema: "public",
            table: "customer_cart_sync_state",
          },
          scheduleRemoteRefresh
        )
        .subscribe();

      removeRealtimeChannel = () => {
        void supabase.removeChannel(channel);
      };
    }

    async function loadInitialRemoteCart() {
      const { attempt, signal } = beginRemoteAttempt();

      if (!isSupabaseConfigured()) {
        enterLocalMode();
        return;
      }

      const userId = await resolveClientSupabaseUserId(signal);

      if (!isCurrentRemoteAttempt(attempt, signal)) {
        return;
      }

      if (!userId) {
        try {
          const result = await readRemoteCart(signal);

          if (!isCurrentRemoteAttempt(attempt, signal)) {
            return;
          }

          if (result.status === "local") {
            enterLocalMode();
            return;
          }

          enterRestoringMode();
        } catch {
          if (!signal.aborted && attempt === remoteAttempt) {
            enterRemoteErrorMode("Unable to restore remote cart session", {
              remoteLoaded: false,
            });
          }
        }
        return;
      }

      setCartStorageOwner(userId);

      try {
        const result = await readRemoteCart(signal);

        if (!isCurrentRemoteAttempt(attempt, signal)) {
          return;
        }

        if (result.status === "local") {
          enterLocalMode();
          return;
        }

        if (!applyRemoteCartItems(result.items)) {
          return;
        }

        if (!disposed) {
          resetErrorRetry();
          setSyncEnabled(true);
          setRemoteLoaded(true);
          setCartSyncStatus({ remoteStatus: "ready" });
          subscribeToRemoteCart(userId);
        }
      } catch {
        if (!signal.aborted && attempt === remoteAttempt) {
          enterRemoteErrorMode("Unable to load remote cart");
        }
      }
    }

    function retryRemoteCartSync(options: { resetBackoff?: boolean } = {}) {
      if (disposed) {
        return;
      }

      if (options.resetBackoff !== false) {
        resetErrorRetry();
      } else {
        clearErrorRetry();
      }
      stopRemoteListeners();

      const shouldSaveLocalCart = hasPendingLocalCartWrite();

      setSyncEnabled(false);
      setRemoteLoaded(shouldSaveLocalCart);
      setCartSyncStatus({ remoteStatus: "loading" });

      if (shouldSaveLocalCart) {
        void saveCurrentLocalCart();
        return;
      }

      void loadInitialRemoteCart();
    }

    function retryRequestedRemoteCartSync() {
      retryRemoteCartSync();
    }

    function retryVisibleRemoteCartSync() {
      if (document.visibilityState === "visible") {
        retryRemoteCartSync();
      }
    }

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          enterLocalMode();
          return;
        }

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          retryRemoteCartSync();
        }
      });

      removeAuthListener = () => {
        data.subscription.unsubscribe();
      };
    }

    void loadInitialRemoteCart();
    window.addEventListener(CART_SYNC_RETRY_EVENT, retryRequestedRemoteCartSync);
    window.addEventListener("online", retryRequestedRemoteCartSync);
    document.addEventListener("visibilitychange", retryVisibleRemoteCartSync);

    return () => {
      disposed = true;
      clearErrorRetry();
      window.removeEventListener(CART_SYNC_RETRY_EVENT, retryRequestedRemoteCartSync);
      window.removeEventListener("online", retryRequestedRemoteCartSync);
      document.removeEventListener("visibilitychange", retryVisibleRemoteCartSync);
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }
      removeRealtimeChannel?.();
      removeAuthListener?.();
      activeRemoteController?.abort();
    };
  }, [scope]);

  React.useEffect(() => {
    if (
      scope !== "storefront" ||
      !syncEnabled ||
      !remoteLoaded ||
      applyingRemoteRef.current
    ) {
      return;
    }

    const snapshot = serializeCartItems(localItems);

    if (snapshot === lastSyncedSnapshotRef.current) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      writeRemoteCart(localItems, controller.signal)
        .then((result) => {
          if (result === "local") {
            setCartStorageOwner(null);
            lastSyncedSnapshotRef.current = serializeCartItems([]);
            remoteSnapshotLoadedRef.current = false;
            setSyncEnabled(false);
            setRemoteLoaded(true);
            setCartSyncStatus({ remoteStatus: "local" });
            return;
          }

          lastSyncedSnapshotRef.current = snapshot;
          remoteSnapshotLoadedRef.current = true;
          setCartSyncStatus({ remoteStatus: "ready" });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSyncEnabled(false);
            setCartSyncStatus({
              errorMessage: "Unable to save remote cart",
              remoteStatus: "error",
            });
            window.setTimeout(requestCartSyncRetry, syncErrorRetryDelaysMs[0]);
          }
        });
    }, syncDebounceMs);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [localItems, remoteLoaded, scope, syncEnabled]);

  return null;
}

function readCartItemsFromPayload(payload: CartApiPayload) {
  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.data?.items)) {
    return payload.data.items;
  }

  return [];
}

async function readRemoteCart(signal: AbortSignal): Promise<RemoteCartLoadResult> {
  const response = await fetch("/api/cart", {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });

  if (response.status === 401 || response.status === 404) {
    return { status: "local" };
  }

  if (!response.ok) {
    throw new Error("Unable to load remote cart");
  }

  const payload = (await response.json()) as CartApiPayload;

  if (payload.meta?.persistence === "local_cart") {
    return { status: "local" };
  }

  return {
    items: readCartItemsFromPayload(payload),
    status: "remote",
  };
}

function preserveLocalSnapshots(
  authoritativeItems: readonly CartItem[],
  cachedItems: readonly CartItem[]
) {
  const snapshotsBySku = new Map<string, CartItem["snapshot"]>();

  for (const item of cachedItems) {
    if (item.snapshot) {
      snapshotsBySku.set(item.sku, item.snapshot);
    }
  }

  return authoritativeItems.map((item) => ({
    ...item,
    snapshot: item.snapshot ?? snapshotsBySku.get(item.sku),
  }));
}

async function writeRemoteCart(
  items: readonly CartItem[],
  signal: AbortSignal
): Promise<RemoteCartWriteResult> {
  const normalizedItems = cartItemsForApi(mergeCartItemCollections(items, []));
  const response = await fetch("/api/cart", {
    method: normalizedItems.length > 0 ? "PUT" : "DELETE",
    headers:
      normalizedItems.length > 0
        ? { "Content-Type": "application/json" }
        : undefined,
    body:
      normalizedItems.length > 0
        ? JSON.stringify({ items: normalizedItems })
        : undefined,
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });

  if (response.status === 401 || response.status === 404) {
    return "local";
  }

  if (!response.ok) {
    throw new Error("Unable to sync remote cart");
  }

  return "synced";
}

async function resolveClientSupabaseUserId(signal: AbortSignal) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createClient();

  for (const delay of sessionRetryDelaysMs) {
    if (signal.aborted) {
      return null;
    }

    if (delay > 0) {
      await sleep(delay, signal);
    }

    if (signal.aborted) {
      return null;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        return session.user.id;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        return user.id;
      }
    } catch {
      // Standalone PWA cold starts can briefly surface auth storage/network
      // errors before Supabase has restored the session. Retry before falling
      // back to local cart mode.
    }
  }

  return null;
}

function sleep(delayMs: number, signal: AbortSignal) {
  if (delayMs <= 0 || signal.aborted) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, delayMs);

    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });
}
