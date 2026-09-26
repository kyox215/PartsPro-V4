import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/partspro-overview-model.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { buildOverviewModel } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const order = (id, createdAt, total, paymentStatus = 'paid', status = 'submitted') => ({
  id, company: `Customer ${id}`, createdAt, items: 2,
  lines: [{ sku: 'A', name: 'Alpha', quantity: 2, lineTotal: total }],
  paymentStatus, status, total,
});
const product = (sku, overrides = {}) => ({
  sku, name: sku, catalogStatus: 'active', galleryImagePaths: [], galleryImageUrls: [],
  imageUrl: 'https://example.com/image.png', lockedQty: 1, price: 10,
  status: 'Low Stock', stock: 5, availableQty: 4, ...overrides,
});

test('overview retains bounded-sample sales, pipeline, stock and top SKU semantics', () => {
  const orders = [
    order('today', '2026-09-26T10:00:00Z', 40),
    order('yesterday', '2026-09-25T10:00:00Z', 20),
    order('previous', '2026-09-19T10:00:00Z', 30),
    order('unpaid', '2026-09-26T11:00:00Z', 90, 'unpaid'),
  ];
  const model = buildOverviewModel(orders, [product('A')], 7, new Date('2026-09-26T12:00:00Z'), 'Europe/Rome');
  assert.equal(model.todayOrders, 2);
  assert.equal(model.yesterdayOrders, 1);
  assert.equal(model.sales7d, 60);
  assert.equal(model.previousSales7d, 30);
  assert.equal(model.paidOrders7d, 2);
  assert.equal(model.averageOrder7d, 30);
  assert.equal(model.pendingPayments, 1);
  assert.equal(model.fulfillmentQueue, 4);
  assert.equal(model.hotSku[0].quantity, 4);
  assert.equal(model.hotSku[0].revenue, 60);
  assert.equal(model.hotStockAlerts[0].sold7d, 4);
  assert.equal(model.stockAlerts, 1);
  assert.equal(model.salesTrend.length, 7);
  assert.equal(model.salesTrend.at(-1).sales, 40);
});

test('7/30/90 day buckets follow the client calendar across DST and midnight', () => {
  const orders = [
    order('before-midnight', '2026-03-28T22:30:00Z', 10), // Rome March 28
    order('after-midnight', '2026-03-28T23:30:00Z', 20), // Rome March 29
    order('dst-day', '2026-03-29T22:30:00Z', 30), // Rome March 30
  ];
  const anchor = new Date('2026-03-30T12:00:00Z');
  for (const range of [7, 30, 90]) {
    const model = buildOverviewModel(orders, [], range, anchor, 'Europe/Rome');
    assert.equal(model.salesTrend.length, range);
    assert.equal(model.salesTrend.at(-3).key, '2026-03-28');
    assert.equal(model.salesTrend.at(-3).sales, 10);
    assert.equal(model.salesTrend.at(-2).sales, 20);
    assert.equal(model.salesTrend.at(-1).sales, 30);
    assert.equal(model.todayOrders, 1);
    assert.equal(model.yesterdayOrders, 1);
  }
});
