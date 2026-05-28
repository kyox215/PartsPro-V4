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
};

const syncDebounceMs = 500;

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

    async function loadRemoteCart() {
      try {
        const response = await fetch("/api/cart", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 404) {
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load remote cart");
        }

        const payload = (await response.json()) as CartApiPayload;
        const remoteItems = readCartItemsFromPayload(payload);
        const mergedItems = mergeCartItemCollections(
          readClientStoredCartItems({ preserveUnknown: true }),
          remoteItems
        );

        applyingRemoteRef.current = true;
        replaceStoredCartItems(mergedItems, { preserveUnknown: true });
        lastSyncedSnapshotRef.current = serializeCartItems(mergedItems);
        setSyncEnabled(true);
        setRemoteLoaded(true);
        queueMicrotask(() => {
          applyingRemoteRef.current = false;
        });

        if (serializeCartItems(remoteItems) !== lastSyncedSnapshotRef.current) {
          await writeRemoteCart(mergedItems, controller.signal);
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
    if (!syncEnabled || !remoteLoaded || applyingRemoteRef.current) {
      return;
    }

    const snapshot = serializeCartItems(localItems);

    if (snapshot === lastSyncedSnapshotRef.current) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      writeRemoteCart(localItems, controller.signal)
        .then(() => {
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
  }, [localItems, remoteLoaded, syncEnabled]);

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

async function writeRemoteCart(items: readonly CartItem[], signal: AbortSignal) {
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
    return;
  }

  if (!response.ok) {
    throw new Error("Unable to sync remote cart");
  }
}
