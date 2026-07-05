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

  React.useEffect(() => {
    if (scope !== "storefront") {
      setCartSyncStatus({ remoteStatus: "idle" });
      return;
    }

    setCartSyncStatus({ remoteStatus: "loading" });

    const controller = new AbortController();
    let disposed = false;
    let refreshTimeout: number | null = null;
    let removeRealtimeChannel: (() => void) | null = null;
    let removeAuthListener: (() => void) | null = null;

    function stopRemoteListeners() {
      removeRealtimeChannel?.();
      removeRealtimeChannel = null;
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
    }

    function enterLocalMode() {
      stopRemoteListeners();

      setCartStorageOwner(null);
      lastSyncedSnapshotRef.current = serializeCartItems([]);
      if (!disposed) {
        setSyncEnabled(false);
        setRemoteLoaded(true);
        setCartSyncStatus({ remoteStatus: "local" });
      }
    }

    function enterRestoringMode() {
      stopRemoteListeners();
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
      try {
        const result = await readRemoteCart(controller.signal);

        if (disposed || controller.signal.aborted) {
          return;
        }

        if (result.status === "local") {
          enterLocalMode();
          return;
        }

        applyRemoteCartItems(result.items);
      } catch {
        if (!controller.signal.aborted) {
          setSyncEnabled(false);
          setCartSyncStatus({
            errorMessage: "Unable to refresh remote cart",
            remoteStatus: "error",
          });
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
      if (!isSupabaseConfigured()) {
        enterLocalMode();
        return;
      }

      const userId = await resolveClientSupabaseUserId(controller.signal);

      if (controller.signal.aborted || disposed) {
        return;
      }

      if (!userId) {
        try {
          const result = await readRemoteCart(controller.signal);

          if (controller.signal.aborted || disposed) {
            return;
          }

          if (result.status === "local") {
            enterLocalMode();
            return;
          }

          enterRestoringMode();
        } catch {
          if (!controller.signal.aborted && !disposed) {
            setSyncEnabled(false);
            setRemoteLoaded(false);
            setCartSyncStatus({
              errorMessage: "Unable to restore remote cart session",
              remoteStatus: "error",
            });
          }
        }
        return;
      }

      setCartStorageOwner(userId);

      try {
        const result = await readRemoteCart(controller.signal);

        if (disposed || controller.signal.aborted) {
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
          setSyncEnabled(true);
          setRemoteLoaded(true);
          setCartSyncStatus({ remoteStatus: "ready" });
          subscribeToRemoteCart(userId);
        }
      } catch {
        if (!controller.signal.aborted) {
          if (!disposed) {
            setSyncEnabled(false);
            setRemoteLoaded(true);
            setCartSyncStatus({
              errorMessage: "Unable to load remote cart",
              remoteStatus: "error",
            });
          }
        }
      }
    }

    function retryRemoteCartSync() {
      if (disposed) {
        return;
      }

      stopRemoteListeners();

      setSyncEnabled(false);
      setRemoteLoaded(false);
      setCartSyncStatus({ remoteStatus: "loading" });
      void loadInitialRemoteCart();
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
    window.addEventListener(CART_SYNC_RETRY_EVENT, retryRemoteCartSync);
    window.addEventListener("online", retryRemoteCartSync);
    document.addEventListener("visibilitychange", retryVisibleRemoteCartSync);

    return () => {
      disposed = true;
      window.removeEventListener(CART_SYNC_RETRY_EVENT, retryRemoteCartSync);
      window.removeEventListener("online", retryRemoteCartSync);
      document.removeEventListener("visibilitychange", retryVisibleRemoteCartSync);
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }
      removeRealtimeChannel?.();
      removeAuthListener?.();
      controller.abort();
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
            setSyncEnabled(false);
            setCartSyncStatus({ remoteStatus: "local" });
            return;
          }

          lastSyncedSnapshotRef.current = snapshot;
          setCartSyncStatus({ remoteStatus: "ready" });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSyncEnabled(false);
            setCartSyncStatus({
              errorMessage: "Unable to save remote cart",
              remoteStatus: "error",
            });
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
