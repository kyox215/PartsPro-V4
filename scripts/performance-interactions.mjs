import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.PERF_BASE_URL || "http://127.0.0.1:3158";
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local server only");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/catalogo`, { waitUntil: "networkidle" });
  const products = page.locator('a[href^="/prodotto/"]');
  assert.ok(await products.count() > 0, "catalog has real public products");
  const firstHref = await products.first().getAttribute("href");
  await products.first().click();
  await page.waitForURL((url) => url.pathname.startsWith("/prodotto/"));
  await page.locator("h1").waitFor();
  assert.ok((await page.locator("h1").innerText()).length > 0);
  await page.goBack({ waitUntil: "networkidle" });
  await page.locator(`a[href="${firstHref}"]`).first().waitFor();
  console.log("PASS real catalog -> product -> browser back");

  const sampleResponse = await page.request.get(`${baseURL}/api/catalogo?limit=1&offset=0&sort=stock_desc`);
  assert.equal(sampleResponse.ok(), true);
  const sample = (await sampleResponse.json()).data[0];
  assert.ok(sample, "public sample required for browser-only race fixture");
  const sidebar = page.locator("aside");
  let sawMore = false;
  await page.route("**/api/catalogo?**", async (route) => {
    const url = new URL(route.request().url());
    const more = Number(url.searchParams.get("offset")) > 0;
    sawMore ||= more;
    await new Promise((resolve) => setTimeout(resolve, more ? 700 : 50));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      data: [{ ...sample, sku: more ? "TEST-STALE" : "TEST-LATEST", name: more ? "STALE PAGINATION FIXTURE" : "LATEST FILTER FIXTURE" }],
      meta: { total: 1 },
    }) }).catch(() => {}); // Aborted requests must not change visible results.
  });
  const moreButton = page.getByRole("button", { name: /Carica altri|Mostra altri|Carica più/i });
  assert.equal(await moreButton.count(), 1, "load-more control exists");
  await moreButton.click();
  await sidebar.getByRole("button", { name: /^Smartphone/ }).click();
  await page.getByText("LATEST FILTER FIXTURE", { exact: true }).waitFor();
  await page.waitForTimeout(850);
  assert.equal(sawMore, true);
  assert.equal(await page.getByText("STALE PAGINATION FIXTURE", { exact: true }).count(), 0);
  console.log("PASS delayed pagination cannot append to a newer filter (browser-only fixture)");

  await sidebar.getByRole("button", { name: "Tutto il catalogo", exact: true }).click();
  await page.locator(`a[href="${firstHref}"]`).first().waitFor();
  assert.equal(await page.getByText("LATEST FILTER FIXTURE", { exact: true }).count(), 0);
  console.log("PASS original catalog restored from bounded public page cache");
  assert.deepEqual(errors, []);
  await page.unrouteAll({ behavior: "wait" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Apri menu|Menu/i }).first().click();
  assert.ok(await page.getByRole("dialog").isVisible());
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("dialog").count(), 0);
  console.log("PASS mobile navigation opens and closes with keyboard");
  for (const path of ["/account?section=wallet", "/admin", "/rma"]) {
    await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/login");
    assert.equal(new URL(page.url()).pathname, "/login", `anonymous ${path} remains protected`);
  }
  await page.goto(`${baseURL}/checkout`, { waitUntil: "networkidle" });
  const submitButtons = page.getByRole("button", { name: /^Non inviabile$/ });
  assert.ok(await submitButtons.count() > 0);
  for (const button of await submitButtons.all()) assert.equal(await button.isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log("PASS anonymous account/admin/RMA redirect and checkout submission remains disabled");
} finally {
  await browser.close();
}
