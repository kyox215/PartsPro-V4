import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

// This client deliberately has no cookie/session adapter. Shared public reads
// must keep anonymous RLS even when the request belongs to an administrator.
export function createPublicReadClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
