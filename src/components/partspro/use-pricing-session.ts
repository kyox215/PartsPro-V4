"use client";

import { useEffect, useRef } from "react";
import { useStorefrontRefresh } from "./storefront-refresh-provider";

/** Only changed identities replace private UI; same-account refresh preserves it. */
export function usePricingSession(serverUserId: string | null | undefined) {
  const state = useStorefrontRefresh();
  const expectedUserId = serverUserId ?? null;
  const ready = state.userId === undefined || state.userId === expectedUserId;
  const requestedIdentity = useRef<string | null>(null);
  useEffect(() => {
    state.reportExpectedUserId(expectedUserId);
    const identityKey = JSON.stringify([state.userId,expectedUserId]);
    if (ready) requestedIdentity.current=null;
    else if (requestedIdentity.current !== identityKey && !state.refreshing && !state.error) { requestedIdentity.current=identityKey; state.request(`identity:${JSON.stringify(state.userId)}`); }
  }, [ready, expectedUserId, state]);
  return { ...state, key: state.userId === undefined ? expectedUserId ?? "anonymous" : state.userId ?? "anonymous", ready };
}
