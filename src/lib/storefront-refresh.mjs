/** Bounded shared scheduler; no polling and no component remount. */
export function createStorefrontRefresh({ run, changed = () => {}, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let state = { refreshVersion: 0, completedVersion: 0, refreshing: false, pricesInvalid: false, error: null };
  let lastSuccess = now();
  let debounce, deadline;
  let disposed = false;
  let lastIdentityReason;
  let dirty = false;
  const emit = (patch) => { if (Object.entries(patch).every(([key,value]) => Object.is(state[key],value))) return; state = { ...state, ...patch }; changed(state); };
  const clear = () => { cancel(debounce); cancel(deadline); debounce = deadline = undefined; };
  const fail = (version) => {
    if (disposed || version !== state.refreshVersion) return;
    cancel(deadline); deadline = undefined;
    dirty = false;
    emit({ refreshing: false, pricesInvalid: true, error: "refresh_failed" });
  };
  const start = () => {
    if (disposed || state.refreshing) return;
    cancel(debounce); debounce = undefined;
    const version = state.refreshVersion + 1;
    emit({ refreshVersion: version, refreshing: true, error: null });
    deadline = schedule(() => fail(version), 15_000);
    try { run(version); } catch { fail(version); }
  };
  return {
    getSnapshot: () => state,
    request(reason = "focus") {
      if (disposed) return;
      const identityChange = reason === "identity" || reason.startsWith("identity:");
      if (reason.startsWith("identity:")) {
        if (lastIdentityReason === reason) return;
        lastIdentityReason = reason;
      }
      const urgent = reason !== "focus";
      if (urgent) emit({ pricesInvalid: true });
      if (state.refreshing && !identityChange) { if (urgent) dirty = true; return; }
      if (state.refreshing) { clear(); dirty = false; emit({ refreshing: false }); }
      if (!urgent && (state.error || now() - lastSuccess < 30_000)) return;
      if (urgent) start();
      else if (debounce === undefined) debounce = schedule(start, 300);
    },
    complete(version) {
      if (disposed || version !== state.refreshVersion || !state.refreshing) return;
      clear();
      if (dirty) { dirty = false; emit({refreshing:false,pricesInvalid:true}); start(); return; }
      lastSuccess = now();
      emit({ completedVersion: version, refreshing: false, pricesInvalid: false, error: null });
    },
    fail,
    activate() { disposed = false; if (state.refreshing) deadline = schedule(() => fail(state.refreshVersion), 15_000); },
    dispose() { disposed = true; clear(); },
  };
}

export function quoteIsCurrent(product, now = Date.now()) {
  const until = Date.parse(product.priceValidUntil ?? "");
  return !Number.isFinite(until) || until > now;
}

/** Refresh already-loaded rows without reducing pagination or flooding the API. */
export async function refreshVisibleCatalog(count, loadPage, signal) {
  const offsets = Array.from({length: Math.ceil(Math.max(1, count) / 50)}, (_, i) => i * 50);
  const pages = new Array(offsets.length);
  let next = 0;
  let failed = false;
  async function worker() {
    while (!failed && next < offsets.length) {
      signal.throwIfAborted();
      const index = next++;
      try {
        pages[index] = await loadPage(offsets[index], Math.min(50, Math.max(1, count) - offsets[index]));
        signal.throwIfAborted();
      } catch (error) { failed = true; throw error; }
    }
  }
  await Promise.all(Array.from({length: Math.min(2, offsets.length)}, worker));
  return { products: pages.flatMap(page => page.products), total: pages[0].total };
}
