import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.PERF_BASE_URL || 'http://127.0.0.1:3158';
const origin = new URL(baseURL);
assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname) ||
  (origin.protocol === 'https:' && process.env.PERF_ALLOWED_ORIGIN === origin.origin));
const output = process.env.PERF_OUTPUT || '/tmp/partspro-menu-verification';
await mkdir(output, { recursive: true });
const chunkDirectory = new URL('../.next/static/chunks/', import.meta.url);
const chunks = await Promise.all((await readdir(chunkDirectory)).filter(f => f.endsWith('.js')).map(async name => ({ name, code: await readFile(new URL(name, chunkDirectory), 'utf8') })));
const accountChunk = process.env.PERF_ACCOUNT_CHUNK || chunks.find(c => c.code.includes('focusFirstItem') && c.code.includes('onSignOut'))?.name;
const mobileChunk = process.env.PERF_MOBILE_CHUNK || chunks.find(c => c.code.includes('catalogSearch') && c.code.includes('"data-slot":"sheet"'))?.name;
assert.ok(accountChunk && mobileChunk, 'Built menu chunks must be identifiable');
const results = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function scenario(name, run, { mobile = false, injectedFailure = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], scripts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname); });
  try {
    await run(page, scripts);
    assert.deepEqual(errors, [], 'No unhandled browser errors, including injected chunk failures');
    results.push({ check: name, pass: true, injectedFailure });
    console.log(`${name}: PASS`);
  } finally { await context.close(); }
}
function account(page) { return page.getByRole('button', { name: /^Apri centro personale/ }); }
function mobileMenu(page) { return page.getByRole('button', { name: /^Apri menu/ }); }
async function closeAndCheckFocus(page, role, trigger) {
  await page.keyboard.press('Escape');
  await page.getByRole(role).waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Escape restores trigger focus');
}
async function holdChunk(page, chunk) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(`**/${chunk}`, async route => { await gate; await route.continue(); });
  return release;
}
try {
  await scenario('desktop has one account trigger and loads neither menu until intent', async (page, scripts) => {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    assert.equal(await account(page).count(), 1);
    assert.ok(!scripts.some(s => s.endsWith(accountChunk) || s.endsWith(mobileChunk)));
    await page.screenshot({ path: `${output}/desktop.png`, fullPage: false });
    await account(page).hover();
    await page.waitForFunction(chunk => performance.getEntriesByType('resource').some(r => r.name.endsWith(chunk)), accountChunk);
    assert.equal(await page.getByRole('menu').count(), 0, 'Hover preloads without opening');
    await account(page).click();
    await page.getByRole('menu').waitFor();
    await closeAndCheckFocus(page, 'menu', account(page));
    await account(page).press('ArrowDown');
    await page.getByRole('menuitem').first().waitFor();
    assert.equal(await page.getByRole('menuitem').first().evaluate(node => node === document.activeElement), true);
    await closeAndCheckFocus(page, 'menu', account(page));
    assert.ok(!scripts.some(s => s.endsWith(mobileChunk)));
  });

  for (const activation of ['click', 'keyboard']) {
    await scenario(`account retains first ${activation} while its chunk is delayed`, async page => {
      const release = await holdChunk(page, accountChunk);
      try {
        await page.goto(baseURL, { waitUntil: 'networkidle' });
        if (activation === 'click') await account(page).click();
        else { await account(page).focus(); await account(page).press('ArrowDown'); }
        await page.waitForFunction(() => document.querySelector('button[aria-haspopup="menu"][aria-busy="true"]'));
        assert.equal(await page.getByRole('menu').count(), 0);
        release();
        await page.getByRole('menu').waitFor();
        if (activation === 'keyboard') assert.equal(await page.getByRole('menuitem').first().evaluate(node => node === document.activeElement), true);
        await closeAndCheckFocus(page, 'menu', account(page));
      } finally { release(); }
    });
  }

  for (const cancellation of ['Escape', 'Tab']) {
    await scenario(`account cancels delayed open after ${cancellation}`, async page => {
      const release = await holdChunk(page, accountChunk);
      try {
        await page.goto(baseURL, { waitUntil: 'networkidle' });
        await account(page).click();
        await page.keyboard.press(cancellation);
        release();
        await page.waitForFunction(() => !document.querySelector('button[aria-haspopup="menu"][aria-busy="true"]'));
        assert.equal(await page.getByRole('menu').count(), 0);
        await account(page).click();
        await page.getByRole('menu').waitFor();
      } finally { release(); }
    });
  }

  await scenario('account chunk failure recovers on retry', async page => {
    let requests = 0;
    await page.route(`**/${accountChunk}`, route => ++requests === 1 ? route.abort('failed') : route.continue());
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await account(page).hover();
    await page.getByRole('button', { name: /Apri centro personale.*Riprova/ }).waitFor();
    await account(page).click();
    await page.getByRole('menu').waitFor();
    assert.equal(requests, 2);
  }, { injectedFailure: true });

  await scenario('mobile retains first click, restores focus and closes on desktop resize', async page => {
    const release = await holdChunk(page, mobileChunk);
    try {
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('button[aria-haspopup="dialog"][aria-busy="true"]'));
      await mobileMenu(page).click();
      release();
      await page.getByRole('dialog').waitFor();
      await closeAndCheckFocus(page, 'dialog', mobileMenu(page));
      await mobileMenu(page).click();
      await page.getByRole('dialog').waitFor();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.setViewportSize({ width: 390, height: 844 });
      await mobileMenu(page).waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/mobile.png`, fullPage: false });
    } finally { release(); }
  }, { mobile: true });

  await scenario('mobile chunk failure recovers on retry', async page => {
    let requests = 0;
    await page.route(`**/${mobileChunk}`, route => ++requests === 1 ? route.abort('failed') : route.continue());
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Apri menu.*Riprova/ }).waitFor();
    await mobileMenu(page).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(requests, 2);
  }, { mobile: true, injectedFailure: true });
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, accountChunk, mobileChunk, results }, null, 2));
}
