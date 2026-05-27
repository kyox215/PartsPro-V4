"use client";

import { useEffect } from "react";

type CustomerActivityTrackerProps = {
  brand?: string | null;
  enabled?: boolean;
  eventType: "product_view";
  metadata?: Record<string, unknown>;
  model?: string | null;
  modelSeries?: string | null;
  productName?: string | null;
  searchQuery?: string | null;
  skuCode?: string | null;
};

const dedupeWindowMs = 5 * 60 * 1000;

export function CustomerActivityTracker({
  brand,
  enabled = true,
  eventType,
  metadata,
  model,
  modelSeries,
  productName,
  searchQuery,
  skuCode,
}: CustomerActivityTrackerProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const dedupeKey = [
      "partspro",
      "activity",
      eventType,
      skuCode,
      brand,
      modelSeries,
      model,
      searchQuery,
    ]
      .filter(Boolean)
      .join(":");
    const now = Date.now();

    try {
      const previous = Number(window.sessionStorage.getItem(dedupeKey) ?? "0");

      if (Number.isFinite(previous) && now - previous < dedupeWindowMs) {
        return;
      }

      window.sessionStorage.setItem(dedupeKey, String(now));
    } catch {
      // Activity tracking must never block product browsing.
    }

    const controller = new AbortController();

    void fetch("/api/customer-activity", {
      body: JSON.stringify({
        brand,
        eventType,
        metadata,
        model,
        modelSeries,
        productName,
        searchQuery,
        skuCode,
      }),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      keepalive: true,
      method: "POST",
      signal: controller.signal,
    }).catch(() => {
      // Anonymous users and staff without a linked customer may receive 401/403.
    });

    return () => controller.abort();
  }, [brand, enabled, eventType, metadata, model, modelSeries, productName, searchQuery, skuCode]);

  return null;
}
