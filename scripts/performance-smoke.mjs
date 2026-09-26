import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Run against a production build. No login, writes, or customer data collection.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.PERF_BASE_URL || "http://127.0.0.1:3158";
const isLocal = ["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname);
if (!isLocal && !(new URL(baseURL).protocol === "https:" && process.env.PERF_ALLOWED_ORIGIN === new URL(baseURL).origin)) {
  throw new Error("Remote read-only checks require explicit PERF_ALLOWED_ORIGIN matching the HTTPS target.");
}
const output = resolve(process.env.PERF_OUTPUT || "/tmp/partspro-performance");
const runs = Number(process.env.PERF_RUNS || 3);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
await mkdir(output, { recursive: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    if (mobile) {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false, latency: 80, downloadThroughput: 1_125_000,
        uploadThroughput: 187_500, connectionType: "cellular4g",
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    await page.addInitScript(() => {
      window.__perf = { lcp: 0, cls: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__perf.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    const routes = ["/", "/catalogo", "/login", "/professionale", "/carrello"];
    for (const path of routes) {
      for (let run = 0; run < runs; run++) {
        if (run === 0) await cdp.send("Network.clearBrowserCache");
        const errors = [];
        const onError = (error) => errors.push(error.message);
        page.on("pageerror", onError);
        const response = await page.goto(`${baseURL}${path}`, { waitUntil: "load", timeout: 60_000 });
        if (path === "/") await page.locator('#stocked-products a[href^="/prodotto/"]').first().waitFor();
        if (path === "/catalogo") await page.locator('a[href^="/prodotto/"]').first().waitFor();
        const contentReadyMs = Math.round(await page.evaluate(() => performance.now()));
        await page.waitForTimeout(500);
        const metrics = await page.evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          const resources = performance.getEntriesByType("resource");
          return {
            ttfbMs: Math.round(nav.responseStart), loadMs: Math.round(nav.loadEventEnd),
            lcpMs: Math.round(window.__perf.lcp), cls: window.__perf.cls,
            requests: resources.length,
            transferredBytes: resources.reduce((sum, r) => sum + r.transferSize, nav.transferSize),
            brokenImages: [...document.images].filter((i) => i.complete && !i.naturalWidth).length,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        page.off("pageerror", onError);
        results.push({ path, device: mobile ? "mobile-4g-4x-cpu" : "desktop", cache: run ? "warm" : "browser-cold", run, status: response.status(), contentReadyMs, ...metrics, errors });
        console.log(JSON.stringify(results.at(-1)));
        if (run === runs - 1) await page.screenshot({ path: `${output}/${mobile ? "mobile" : "desktop"}-${path.replaceAll("/", "") || "home"}.png` });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, runs, note: `Public, logged-out ${isLocal ? "local" : "remote"} smoke samples; not production P95 or authenticated-flow acceptance. Browser-cold does not imply server/CDN-cold.`, results }, null, 2));
}
