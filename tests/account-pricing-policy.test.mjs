import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, imports = {}) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => name in imports ? imports[name] : require(name), Date, console });
  return exports;
}
const pricing = load('lib/partspro-pricing.ts', { '@/lib/partspro-shipping': { freeShippingThresholdEuros: 100 } });
const now = new Date('2026-09-27T12:00:00Z');
const expired = { promoLevel: 'king', promoLevelStartsAt: '2026-06-27T12:00:00Z', promoLevelExpiresAt: now.toISOString() };
test('expiry restores manual base, automatic spend tier, and employee stored tier', () => {
  assert.equal(pricing.effectiveCustomerTier({ ...expired, level: 'gold', levelSource: 'manual', lifetimeSpendNet: 50000 }, now), 'gold');
  assert.equal(pricing.effectiveCustomerTier({ ...expired, level: 'king', levelSource: 'automatic', lifetimeSpendNet: 1000 }, now), 'silver');
  assert.equal(pricing.effectiveCustomerTier({ ...expired, level: 'master', profileKind: 'employee_self', lifetimeSpendNet: 0 }, now), 'master');
  assert.equal(pricing.baseCustomerTier({ level: 'invalid', levelSource: 'manual', lifetimeSpendNet: 10800 }), 'gold');
});
test('active promotion only raises base and is inactive before start', () => {
  const active = { ...expired, promoLevelExpiresAt: '2026-09-28T12:00:00Z' };
  assert.equal(pricing.effectiveCustomerTier({ ...active, level: 'gold', levelSource: 'manual' }, now), 'king');
  assert.equal(pricing.effectiveCustomerTier({ ...active, level: 'king', levelSource: 'manual', promoLevel: 'silver' }, now), 'king');
  assert.equal(pricing.effectiveCustomerTier({ ...active, level: 'gold', levelSource: 'manual', promoLevelStartsAt: '2026-09-28T00:00:00Z' }, now), 'gold');
});
test('all seven spend thresholds and fixed discounts are unchanged', () => {
  const limits = [0, 1000, 10800, 20600, 30400, 40200, 50000];
  limits.forEach((amount, index) => {
    assert.equal(pricing.levelForLifetimeSpend(amount), pricing.customerTiers[index]);
    assert.equal(pricing.getTierRule(pricing.customerTiers[index]).discountAmount, index * .25);
    if (index) assert.equal(pricing.levelForLifetimeSpend(amount - .01), pricing.customerTiers[index - 1]);
  });
});
const account = load('lib/partspro-account-context.ts', {
  react: { cache: (fn) => fn }, '@/lib/partspro-customer-linkage': {}, '@/lib/partspro-pricing': pricing,
  '@/lib/partspro-permissions': {}, '@/lib/supabase/env': {}, '@/lib/supabase/server': {},
  'next/headers': {}, '@/lib/partspro-commerce-rules': {},
});
test('unversioned positive prices cannot become trading quotes; valid backend prices survive', () => {
  const raw = { sku: 'CB25', price: 1.9, retailPrice: 1.9, basePrice: 1.9, brand: 'REMAX', category: 'Accessori' };
  const failed = account.applyAccountPriceToProduct(raw, { canViewPrices: true });
  assert.equal(failed.price, 0);
  assert.equal(failed.quoteStatus, 'unavailable');
  assert.equal(failed.basePrice, undefined);
  const valid = { ...raw, price: 1.4, priceResolved: true, priceVersion: 'server-v1', quoteStatus: 'available' };
  assert.equal(account.applyAccountPriceToProduct(valid, { canViewPrices: true }), valid);
  const hidden = account.applyAccountPriceToProduct(valid, { canViewPrices: false });
  assert.equal(hidden.price, 0);
  assert.equal(hidden.basePrice, undefined);
  assert.equal(hidden.priceVersion, undefined);
  assert.equal(hidden.quoteStatus, 'hidden');
});
const display = load('lib/partspro-price-display.ts', {
  '@/lib/partspro-pricing': pricing,
  '@/i18n/dictionaries/storefront': { txFormat: (_t, _key, fallback, values) => fallback.replace('{amount}', values.amount) },
});
test('discount badge reports actual rounded reduction rather than nominal tier deduction', () => {
  const actual = display.getProductPriceDisplay({ price: 9.7, basePrice: 10, levelDiscountAmount: 1.5, customerLevel: 'king' });
  assert.match(display.formatPriceDiscountBadge(actual), /0,30/);
  const exempt = display.getProductPriceDisplay({ price: 1.4, basePrice: 1.4, levelDiscountAmount: 0 });
  assert.equal(exempt.hasDiscount, false);
});
const schemas = load('lib/partspro-pricing-admin.ts', { './partspro-pricing': pricing });
test('admin policy and quote inputs reject invalid ranges and mixed unknown fields', () => {
  const campaign = { enabled: true, level: 'king', duration_months: 3, starts_at: null, ends_at: null, reason: '测试活动' };
  assert.equal(schemas.signupCampaignSchema.safeParse(campaign).success, true);
  for (const duration_months of [0, 25, 1.5]) assert.equal(schemas.signupCampaignSchema.safeParse({ ...campaign, duration_months }).success, false);
  assert.equal(schemas.signupCampaignSchema.safeParse({ ...campaign, starts_at: '2026-09-27T00:00:00Z', ends_at: '2026-09-26T00:00:00Z' }).success, false);
  for (const quantity of [0, -1, 1.5, 10001]) assert.equal(schemas.pricingItemsSchema.safeParse([{ sku: 'CB25', quantity }]).success, false);
  assert.equal(schemas.pricingItemsSchema.safeParse([{ sku: 'CB25', quantity: 3, price: 1.4 }]).success, false);
});
const linkage = load('lib/partspro-customer-linkage.ts', {});
function customerClient(owned, memberships = [], memberCustomers = []) {
  return { from: (table) => {
    let result = table === 'customer_memberships' ? memberships : owned;
    const query = { select: () => query, eq: (field, value) => { if (field === 'id') result = result.filter(row => row.id === value); return query; }, maybeSingle: () => Promise.resolve({ data: result[0] ?? null, error: null }), order: () => query, limit: () => query,
      in: () => { result = memberCustomers; return query; },
      then: (resolve) => Promise.resolve({ data: result, error: null }).then(resolve) };
    return query;
  } };
}
test('customer linkage never infers a price list from email or arbitrarily chooses wholesale', async () => {
  const retail = { id: 'retail', profile_kind: 'customer', customer_type: 'retail' };
  const wholesale = { id: 'wholesale', profile_kind: 'customer', customer_type: 'wholesale' };
  const options = { profile: {}, email: 'same@example.test', select: '*' };
  assert.equal(await linkage.readLinkedCustomerRow(customerClient([]), 'user', options), null);
  assert.equal(await linkage.readLinkedCustomerRow(customerClient([retail, wholesale]), 'user', options), null);
  assert.equal(await linkage.readLinkedCustomerRow(customerClient([retail]), 'user', options), retail);
  assert.equal(await linkage.readLinkedCustomerRow(customerClient([retail]), 'user', { ...options, profile: { customer_id: 'wholesale' } }), null);
  assert.equal(await linkage.readLinkedCustomerRow(customerClient([retail, wholesale]), 'user', { ...options, profile: { customer_id: 'retail' } }), retail);
  assert.equal(await linkage.readLinkedCustomerRow(customerClient([], [{ customer_id: 'wholesale' }], [wholesale]), 'user', options), wholesale);
});
function adminRouteHarness(permissions, rpcResult = { data: [], error: null }) {
  const calls = [];
  const response = (status, code, message) => ({ status, code, message });
  const route = load('app/api/admin/pricing/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ status: 200, body, headers: options?.headers }) } },
    '@/lib/partspro-api': { apiError: response },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (name, args) => { calls.push({ name, args }); return rpcResult; } }) },
    '@/lib/partspro-admin-auth': { hasAdminPermission: (_state, permission) => permissions.includes(permission) },
    '@/lib/partspro-pricing-admin': schemas,
    '../_shared': {
      requireAdminApi: async (permission) => permissions.includes(permission) ? { ok: true, authState: {} } : { ok: false, response: response(403, 'FORBIDDEN') },
      parseAdminJsonBody: async (request, schema) => { const result = schema.safeParse(request.body); return result.success ? { ok: true, data: result.data } : { ok: false, response: response(400, 'INVALID') }; },
    },
  });
  return { route, calls };
}
const inspection = { customerId: '11111111-1111-4111-8111-111111111111', items: [{ sku: 'CB25', quantity: 10 }] };
test('admin pricing endpoints deny insufficient permissions before executing RPC', async () => {
  const { route, calls } = adminRouteHarness(['customers.read']);
  assert.equal((await route.POST({ body: inspection })).status, 403);
  assert.equal((await route.POST({ body: { ...inspection, customerType: 'wholesale' } })).status, 403);
  assert.equal((await route.PATCH({ body: {} })).status, 403);
  assert.equal((await route.GET({})).status, 403);
  assert.equal(calls.length, 0);
});
test('classification preview is read only and quote inspection preserves actual quantity', async () => {
  const { route, calls } = adminRouteHarness(['customers.read', 'customers.classify', 'orders.manage']);
  const result = await route.POST({ body: inspection });
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'private, no-store, max-age=0');
  assert.equal(calls[0].name, 'resolve_customer_product_quotes');
  assert.equal(calls[0].args.p_items[0].quantity, 10);
  await route.POST({ body: { ...inspection, customerType: 'wholesale' } });
  assert.equal(calls[1].name, 'admin_preview_customer_classification');
  assert.equal(calls[1].args.p_customer_type, 'wholesale');
});
test('campaign input failure and backend quote errors never return fake success or raw SQL', async () => {
  const { route, calls } = adminRouteHarness(['pricing.manage_policy', 'customers.read', 'orders.manage'], { data: null, error: { message: 'private sensitive SQL error' } });
  assert.equal((await route.PATCH({ body: { enabled: true, duration_months: 100 } })).status, 400);
  assert.equal(calls.length, 0);
  const result = await route.POST({ body: inspection });
  assert.equal(result.status, 503);
  assert.equal(result.code, 'QUOTE_UNAVAILABLE');
  assert.doesNotMatch(result.message, /sensitive/);
});
