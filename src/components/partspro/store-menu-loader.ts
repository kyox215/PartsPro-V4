type MenuLoadState<T> = {
  Component: T | null;
  status: "idle" | "loading" | "ready" | "error";
};

// Cache successful imports and coalesce intent events, but allow failed chunks
// to be requested again by the same, still usable trigger.
export function createMenuLoader<T>(importMenu: () => Promise<T>) {
  const initialState: MenuLoadState<T> = { Component: null, status: "idle" };
  let state = initialState;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  function publish(next: MenuLoadState<T>) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initialState,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load() {
      if (pending || state.Component) {
        return pending ?? Promise.resolve();
      }

      publish({ Component: null, status: "loading" });
      pending = Promise.resolve()
        .then(importMenu)
        .then(
          (Component) => publish({ Component, status: "ready" }),
          () => publish({ Component: null, status: "error" })
        )
        .finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}
