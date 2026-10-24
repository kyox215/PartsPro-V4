/** Only accepts our escaped, locally generated packing slips; never remote HTML. */
export function packingSlipPreview(documents) {
  if (!documents.length || documents.length > 50) throw new Error("Select 1–50 orders");
  const pages = documents.map(html => html.match(/<body>([\s\S]*?)<\/body>/i)?.[1]);
  if (pages.some(page => !page)) throw new Error("Packing slip could not be prepared");
  const css = documents[0].match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? "";
  // Scope every selector, including selectors nested inside @media. @page stays global.
  const styles = css.replace(/(^|(?<=[{}]))\s*([^{}]+)\{/g, (match, boundary, selector) => {
    if (selector.trim().startsWith("@")) return match;
    return `${boundary}\n${selector.split(",").map(value => value.trim() === "body" ? ".order-print-document" : `.order-print-document ${value.trim()}`).join(", ")} {`;
  });
  return { styles, body: pages.map(page => `<section class="order-print-page">${page}</section>`).join("") };
}

/** Wait before enabling manual print, with bounded waiting and complete cleanup. */
export function waitForPackingSlipImages(images, signal, timeoutMs = 5000) {
  return new Promise(resolve => {
    const pending = images.filter(image => !image.complete);
    const cleanups = [];
    let remaining = pending.length;
    let timer;
    const finish = () => {
      clearTimeout(timer);
      cleanups.forEach(cleanup => cleanup());
      signal.removeEventListener("abort", finish);
      resolve();
    };
    if (!remaining || signal.aborted) return finish();
    pending.forEach(image => {
      const done = () => {
        image.removeEventListener("load", done);
        image.removeEventListener("error", done);
        if (--remaining === 0) finish();
      };
      image.addEventListener("load", done);
      image.addEventListener("error", done);
      cleanups.push(() => { image.removeEventListener("load", done); image.removeEventListener("error", done); });
    });
    signal.addEventListener("abort", finish, { once: true });
    timer = setTimeout(finish, timeoutMs);
  });
}
