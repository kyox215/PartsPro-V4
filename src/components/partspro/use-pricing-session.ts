"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Prices are invalidated before a changed identity can reuse hydrated state. */
export function usePricingSession(serverUserId: string | null | undefined) {
  const expectedUserId = serverUserId ?? null;
  const router = useRouter();
  const [session, setSession] = useState({ userId: expectedUserId, revision: 0 });
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const { data } = createClient().auth.onAuthStateChange((event, next) => {
      const userId = next?.user.id ?? null;
      if (event === "INITIAL_SESSION") {
        setSession((current) => current.userId === userId ? current : { userId, revision: current.revision + 1 });
        if (userId !== expectedUserId) queueMicrotask(() => router.refresh());
        return;
      }
      setSession((current) => ({ userId, revision: current.revision + 1 }));
      queueMicrotask(() => {
        window.dispatchEvent(new Event("partspro-pricing-invalidated"));
        router.refresh();
      });
    });
    return () => data.subscription.unsubscribe();
  }, [router, expectedUserId]);
  return {
    key: session.userId ?? "anonymous",
    ready: session.userId === expectedUserId,
  };
}
