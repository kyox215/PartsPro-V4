import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { createPublicReadClient } from "@/lib/supabase/public";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

export const publicNavigationTag = "partspro:public-navigation:v1";
export const publicBannersTag = "partspro:public-banners:v1";
type PublicTag = typeof publicNavigationTag | typeof publicBannersTag;
type PublicClient = ReturnType<typeof createPublicReadClient>;
const clearPending = new Map<PublicTag, Set<() => void>>();

export function createCachedPublicRead<T>(
  tag: PublicTag,
  seconds: number,
  read: (client: PublicClient) => Promise<T | null>,
  options: { requireFresh?: boolean } = {}
) {
  const load = async () => {
    const result = await read(createPublicReadClient());
    // Throw within the cache scope so a temporary error/fallback cannot become
    // a successful shared cache entry. The caller keeps its existing fallback.
    if (result === null) throw new Error(`Public read unavailable: ${tag}`);
    return { data: result, readAt: Date.now() };
  };
  const cached = unstable_cache(async (projectUrl: string) => {
    if (projectUrl !== getSupabaseEnv().url) throw new Error("Public cache project mismatch");
    return load();
  }, [tag], { revalidate: seconds, tags: [tag] });
  const pending = new Map<string, Promise<T | null>>();
  const resets = clearPending.get(tag) ?? new Set<() => void>();
  resets.add(() => pending.clear());
  clearPending.set(tag, resets);

  return function readCached(): Promise<T | null> {
    if (!isSupabaseConfigured()) return Promise.resolve(null);
    const projectUrl = getSupabaseEnv().url;
    const inFlight = pending.get(projectUrl);
    if (inFlight) return inFlight;
    const request = cached(projectUrl).then(async (entry) => {
      // Scheduled banners must not use an expired SWR response. Next refreshes
      // the stable cache key in the background; this request reads fresh data.
      const value = options.requireFresh && Date.now() - entry.readAt >= seconds * 1000
        ? await load() : entry;
      return value.data;
    }).catch(() => null).finally(() => {
      if (pending.get(projectUrl) === request) pending.delete(projectUrl);
    });
    pending.set(projectUrl, request);
    return request;
  };
}

export function invalidatePublicNavigationCache() {
  invalidate(publicNavigationTag);
}

export function invalidatePublicBannersCache() {
  invalidate(publicBannersTag);
}

function invalidate(tag: PublicTag) {
  for (const reset of clearPending.get(tag) ?? []) reset();
  revalidateTag(tag, { expire: 0 });
}
