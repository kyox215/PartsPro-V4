import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.PERF_BASE_URL || 'http://127.0.0.1:3158';
const origin = new URL(baseURL);
assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname) ||
  (origin.protocol === 'https:' && process.env.PERF_ALLOWED_ORIGIN === origin.origin));
const runs = Number(process.env.PERF_RUNS || 10);
assert.ok(Number.isInteger(runs) && runs >= 1 && runs <= 20);
const output = process.env.PERF_OUTPUT || '/tmp/partspro-cold-samples';
const productPath = process.env.PERF_PRODUCT_PATH || '/prodotto/REMAX-6954851247722';
assert.ok(productPath.startsWith('/prodotto/'));
const results = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir(output, { recursive: true });
try {
  for (const path of ['/', '/catalogo', productPath]) {
    for (let run = 0; run < runs; run++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.clearBrowserCache');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 1_125_000, uploadThroughput: 187_500, connectionType: 'cellular4g' });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const errors = [], badResponses = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('response', r => { if (r.status() >= 400) badResponses.push({ path: new URL(r.url()).pathname, status: r.status() }); });
      await page.addInitScript(() => {
        window.__coldPerf = { lcp: 0, cls: 0 };
        new PerformanceObserver(list => { for (const e of list.getEntries()) window.__coldPerf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__coldPerf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      const response = await page.goto(baseURL + path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      if (path === '/') await page.locator('#stocked-products a[href^="/prodotto/"]').first().waitFor();
      else if (path === '/catalogo') await page.locator('a[href^="/prodotto/"]').first().waitFor();
      else await page.locator('h1').waitFor();
      const contentReadyMs = Math.round(await page.evaluate(() => performance.now()));
      await page.waitForLoadState('load');
      await page.waitForTimeout(1000);
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const scripts = performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script');
        return { ttfbMs: Math.round(nav.responseStart), loadMs: Math.round(nav.loadEventEnd), lcpMs: Math.round(window.__coldPerf.lcp), cls: window.__coldPerf.cls,
          jsEncodedBytes: scripts.reduce((n, r) => n + r.encodedBodySize, 0), jsDecodedBytes: scripts.reduce((n, r) => n + r.decodedBodySize, 0),
          brokenImages: [...document.images].filter(i => i.complete && !i.naturalWidth).length,
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      const result = { path, run, status: response.status(), contentReadyMs, ...metrics, errors, badResponses };
      results.push(result); console.log(JSON.stringify(result));
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, runs, productPath, note: 'Every sample uses a fresh mobile browser context, 9Mbps/80ms network and 4x CPU throttling. Browser-cold is not server/CDN-cold. Public, logged-out only; sample P90 is not real-user P95.', results }, null, 2));
}
