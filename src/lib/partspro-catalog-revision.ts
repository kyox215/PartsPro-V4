import { cache } from "react";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
// React cache deduplicates within a render/request, not between visitors or server instances.
export const readCatalogRevision = cache(async (): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("catalog_directory_revision");
    return !error && typeof data === "string" ? data : null;
  } catch { return null; }
});
