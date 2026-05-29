"use client";

import * as React from "react";
import { toPublicSku } from "@/lib/partspro-sku";

type RestockSnapshot = {
  error: string | null;
  isLoading: boolean;
  isReady: boolean;
  skus: ReadonlySet<string>;
};

const EMPTY_SKUS = new Set<string>();
const RESTOCK_CHANGED_EVENT = "partspro-restock-requests-changed";

let restockSnapshot: RestockSnapshot = {
  error: null,
  isLoading: false,
  isReady: false,
  skus: EMPTY_SKUS,
};
let restockLoadPromise: Promise<RestockSnapshot> | null = null;

export function useRestockRequests(enabled: boolean) {
  const snapshot = React.useSyncExternalStore(
    subscribeToRestockRequests,
    getRestockSnapshot,
    getRestockSnapshot
  );

  React.useEffect(() => {
    if (enabled) {
      void loadRestockRequests();
    }
  }, [enabled]);

  return enabled ? snapshot : { ...snapshot, skus: EMPTY_SKUS };
}

export async function loadRestockRequests() {
  if (restockLoadPromise) {
    return restockLoadPromise;
  }

  setRestockSnapshot({
    ...restockSnapshot,
    error: null,
    isLoading: true,
  });

  restockLoadPromise = fetch("/api/restock-requests", {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`GET /api/restock-requests responded ${response.status}`);
      }

      const payload = await response.json();
      const skus = readRestockSkus(payload);
      const nextSnapshot = {
        error: null,
        isLoading: false,
        isReady: true,
        skus,
      };

      setRestockSnapshot(nextSnapshot);

      return nextSnapshot;
    })
    .catch((error) => {
      const nextSnapshot = {
        error: error instanceof Error ? error.message : "Restock reminders unavailable.",
        isLoading: false,
        isReady: true,
        skus: restockSnapshot.skus,
      };

      setRestockSnapshot(nextSnapshot);

      return nextSnapshot;
    })
    .finally(() => {
      restockLoadPromise = null;
    });

  return restockLoadPromise;
}

export async function saveRestockRequest(sku: string) {
  const normalizedSku = toPublicSku(sku);
  const response = await fetch("/api/restock-requests", {
    body: JSON.stringify({ sku: normalizedSku }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`POST /api/restock-requests responded ${response.status}`);
  }

  const nextSkus = new Set(restockSnapshot.skus);
  nextSkus.add(normalizedSku);
  setRestockSnapshot({
    error: null,
    isLoading: false,
    isReady: true,
    skus: nextSkus,
  });

  return response.json();
}

function subscribeToRestockRequests(onStoreChange: () => void) {
  window.addEventListener(RESTOCK_CHANGED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener(RESTOCK_CHANGED_EVENT, onStoreChange);
  };
}

function getRestockSnapshot() {
  return restockSnapshot;
}

function setRestockSnapshot(nextSnapshot: RestockSnapshot) {
  restockSnapshot = nextSnapshot;
  window.dispatchEvent(new Event(RESTOCK_CHANGED_EVENT));
}

function readRestockSkus(payload: unknown) {
  const skus = new Set<string>();

  if (isRecord(payload)) {
    const meta = payload.meta;
    const activeSkus = isRecord(meta) ? meta.activeSkus : null;

    if (Array.isArray(activeSkus)) {
      activeSkus.forEach((sku) => {
        if (typeof sku === "string") {
          skus.add(toPublicSku(sku));
        }
      });
    }

    if (Array.isArray(payload.data)) {
      payload.data.forEach((item) => {
        if (isRecord(item) && typeof item.sku === "string") {
          skus.add(toPublicSku(item.sku));
        }
      });
    }
  }

  return skus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
