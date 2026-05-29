"use client";

import * as React from "react";
import type { CartItem } from "./cart-state";
import {
  mergeCartItemCollections,
  readClientStoredCartItems,
  replaceStoredCartItems,
  serializeCartItems,
  useStoredCartItems,
} from "./cart-state";
import { useI18n } from "./i18n-provider";

type CartApiPayload = {
  data?: CartItem[] | { items?: CartItem[] };
  error?: { code?: string; message?: string };
  meta?: { persistence?: string; reason?: string };
};

const syncDebounceMs = 500;
type RemoteCartWriteResult = "synced" | "local";

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

    function enterLocalMode() {
      lastSyncedSnapshotRef.current = serializeCartItems(
        readClientStoredCartItems({ preserveUnknown: true })
      );
      setSyncEnabled(false);
      setRemoteLoaded(true);
    }

    async function loadRemoteCart() {
      try {
        const response = await fetch("/api/cart", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 404) {
          enterLocalMode();
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load remote cart");
        }

        const payload = (await response.json()) as CartApiPayload;

        if (payload.meta?.persistence === "local_cart") {
          enterLocalMode();
          return;
        }

        const remoteItems = readCartItemsFromPayload(payload);
        const localStoredItems = readClientStoredCartItems({ preserveUnknown: true });
        const mergedItems = mergeCartItemCollections(
          localStoredItems,
          remoteItems
        );
        const localSnapshot = serializeCartItems(localStoredItems);
        const remoteSnapshot = serializeCartItems(remoteItems);
        const mergedSnapshot = serializeCartItems(mergedItems);

        if (localSnapshot !== mergedSnapshot) {
          applyingRemoteRef.current = true;

          if (!replaceStoredCartItems(mergedItems, { preserveUnknown: true })) {
            applyingRemoteRef.current = false;
            enterLocalMode();
            return;
          }

          queueMicrotask(() => {
            applyingRemoteRef.current = false;
          });
        }

        lastSyncedSnapshotRef.current = mergedSnapshot;
        setSyncEnabled(true);
        setRemoteLoaded(true);

        if (remoteSnapshot !== mergedSnapshot) {
          const result = await writeRemoteCart(mergedItems, controller.signal);

          if (result === "local") {
            enterLocalMode();
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setSyncEnabled(false);
          setRemoteLoaded(true);
        }
      }
    }

    void loadRemoteCart();

    return () => {
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

async function writeRemoteCart(
  items: readonly CartItem[],
  signal: AbortSignal
): Promise<RemoteCartWriteResult> {
  const normalizedItems = mergeCartItemCollections(items, []);
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
