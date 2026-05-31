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
type RemoteCartWriteResult = "synced" | "local";
type RemoteCartLoadResult =
  | { status: "remote"; items: CartItem[] }
  | { status: "local" };

export function CartSyncBridge() {
  const { scope } = useI18n();
  const localItems = useStoredCartItems({ preserveUnknown: true });
  const [syncEnabled, setSyncEnabled] = React.useState(false);
  const [remoteLoaded, setRemoteLoaded] = React.useState(false);
  const applyingRemoteRef = React.useRef(false);
  const lastSyncedSnapshotRef = React.useRef("");

  React.useEffect(() => {
    if (scope !== "storefront") {
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    let refreshTimeout: number | null = null;
    let removeRealtimeChannel: (() => void) | null = null;

    function enterLocalMode() {
      removeRealtimeChannel?.();
      removeRealtimeChannel = null;
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }

      setCartStorageOwner(null);
      lastSyncedSnapshotRef.current = serializeCartItems([]);
      if (!disposed) {
        setSyncEnabled(false);
        setRemoteLoaded(true);
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

      let userId: string | undefined;

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id;
      } catch {
        enterLocalMode();
        return;
      }

      if (!userId) {
        enterLocalMode();
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
          subscribeToRemoteCart(userId);
        }
      } catch {
        if (!controller.signal.aborted) {
          enterLocalMode();
        }
      }
    }

    void loadInitialRemoteCart();

    return () => {
      disposed = true;
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }
      removeRealtimeChannel?.();
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
            return;
          }

          lastSyncedSnapshotRef.current = snapshot;
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSyncEnabled(false);
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
