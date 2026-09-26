// Own one visible result set, including pagination. Even responses whose network
// cancellation arrives too late cannot replace or append to a newer selection.
export function createLatestRequest() {
  let active = null;
  return {
    begin() {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      return {
        signal: controller.signal,
        isCurrent: () => active === controller && !controller.signal.aborted,
      };
    },
    cancel() {
      active?.abort();
      active = null;
    },
  };
}
