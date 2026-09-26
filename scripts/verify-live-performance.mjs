import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.PERF_BASE_URL;
assert.ok(['https://www.partspro.app', 'https://partspro.app'].includes(baseURL), 'Verified PartsPro production origin required');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseURL}/catalogo`, { waitUntil: 'networkidle' });
  const products = page.locator('a[href^="/prodotto/"]');
  assert.ok(await products.count() > 0);
  const firstHref = await products.first().getAttribute('href');
  const start = performance.now();
  await products.first().click();
  await page.waitForURL((url) => url.pathname.startsWith('/prodotto/'));
  await page.locator('h1').waitFor();
  assert.ok((await page.locator('h1').innerText()).trim().length > 0);
  results.push({ check: 'catalog-product-navigation', ms: Math.round(performance.now() - start), pass: true });
  await page.goBack({ waitUntil: 'networkidle' });
  await page.locator(`a[href="${firstHref}"]`).first().waitFor();
  const filterStart = performance.now();
  const responsePromise = page.waitForResponse((r) => r.url().includes('/api/catalogo?') && r.request().method() === 'GET');
  await page.locator('aside').getByRole('button', { name: /^Smartphone/ }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const payload = await response.json();
  assert.ok(payload.data.length > 0);
  await page.getByText(payload.data[0].name, { exact: true }).first().waitFor();
  results.push({ check: 'real-catalog-filter', ms: Math.round(performance.now() - filterStart), serverTiming: response.headers()['server-timing'], pass: true });
  const optimizedImage = await page.locator('img').evaluateAll((images) => images.map((i) => i.currentSrc).find((src) => src.includes('/_next/image?')));
  assert.ok(optimizedImage, 'optimized image URL present');
  const image = await page.request.get(optimizedImage, { headers: { accept: 'image/avif,image/webp,*/*' } });
  assert.equal(image.status(), 200);
  assert.match(image.headers()['content-type'], /^image\//);
  results.push({ check: 'optimized-image', status: image.status(), contentType: image.headers()['content-type'], pass: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Apri menu|Menu/i }).first().click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  results.push({ check: 'mobile-navigation', pass: true });
  for (const path of ['/account?section=wallet', '/admin', '/rma']) {
    await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname === '/login');
  }
  await page.goto(`${baseURL}/checkout`, { waitUntil: 'networkidle' });
  const blocked = page.getByRole('button', { name: /^Non inviabile$/ });
  assert.ok(await blocked.count() > 0);
  for (const button of await blocked.all()) assert.equal(await button.isDisabled(), true);
  for (const path of ['/api/admin/orders?limit=20&offset=0', '/api/admin/overview?view=compact']) {
    const r = await page.request.get(`${baseURL}${path}`);
    assert.ok([401, 403].includes(r.status()));
  }
  assert.deepEqual(errors, []);
  results.push({ check: 'anonymous-access-gates-and-browser-errors', pass: true });
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await writeFile(process.env.PERF_LIVE_RESULT || '/tmp/partspro-live-interactions.json', JSON.stringify({ baseURL, results }, null, 2));
}
