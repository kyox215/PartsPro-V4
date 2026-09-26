import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/partspro-repository.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('repository.ts', source, ts.ScriptTarget.Latest, true);
const names = ['getCatalogProductBySkuOrSlug', 'readPublicCatalogProduct', 'readPublicCatalogProducts', 'readCatalogProducts', 'readCatalogProductBySkuOrSlug', 'readCatalogProductFromViews', 'readCatalogProductViews', 'shouldFallbackToCatalogSlugLookup', 'isActivePublicBanner'];
const selected = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
assert.equal(selected.length, names.length);
const js = ts.transpileModule(selected.map(n => n.getText(ast)).join('\n'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ summary = true, direct = true } = {}) {
  const calls = [];
  const product = { id: 'p1', sku: 'SKU-1', sku_code: 'SKU-1', slug: 'legacy-phone-part', status: 'active', stock: 7, moq: 2, gallery_image_paths: ['one.webp', 'two.webp'] };
  const rows = { catalog_public_summary: summary ? [product] : null, products: [product], catalog_buyer_prices: [{ id: 'p1', price: 19.5 }] };
  const deps = {
    isSupabaseConfigured: () => true,
    createPublicReadClient: () => ({ role: 'anon' }),
    createClient: async () => ({ role: 'authenticated' }),
    withSupabaseResult: async reader => { calls.push({ type: 'auth' }); return { data: await reader({ client: { role: 'authenticated' } }), source: 'supabase' }; },
    readMatchingRows: async (client, table, select) => { calls.push({ table, select, role: client.role }); return direct ? rows[table] : []; },
    readRows: async (client, table, select) => { calls.push({ table, select, role: client.role }); return rows[table]; },
    mapProductRow: row => ({ ...row }), isDefined: x => x != null,
    pickString: (row, keys) => keys.map(k => row[k]).find(v => typeof v === 'string') ?? null,
    catalogLookupCandidates: value => [value],
    emptyResult: data => ({ data, source: 'local' }),
    listCatalogProducts: () => { throw new Error('anonymous legacy lookup must not use authenticated full catalog'); },
  };
  const result = new Function(...Object.keys(deps), 'exports', `${js}\nreturn {${names.join(',')}};`)(...Object.values(deps), {});
  return { ...result, calls, product };
}

test('anonymous detail skips auth and price queries while keeping the complete product', async () => {
  const f = fixture(); const result = await f.getCatalogProductBySkuOrSlug('SKU-1', { includeBuyerPrices: false });
  assert.deepEqual(result.data, f.product);
  assert.deepEqual(f.calls.map(c => c.table), ['catalog_public_summary']);
  assert.ok(f.calls.every(c => c.role === 'anon'));
});

test('existing default detail retains authenticated price merge and gallery', async () => {
  const f = fixture(); const result = await f.getCatalogProductBySkuOrSlug('SKU-1');
  assert.equal(result.data.price, 19.5);
  assert.deepEqual(result.data.gallery_image_paths, f.product.gallery_image_paths);
  assert.ok(f.calls.some(c => c.type === 'auth'));
  assert.ok(f.calls.some(c => c.table === 'catalog_buyer_prices'));
});

test('anonymous table fallback keeps gallery and never queries buyer prices', async () => {
  const f = fixture({ summary: false }); const result = await f.getCatalogProductBySkuOrSlug('SKU-1', { includeBuyerPrices: false });
  assert.deepEqual(result.data, f.product);
  assert.match(f.calls.find(c => c.table === 'products').select, /gallery_image_paths/);
  assert.ok(!f.calls.some(c => c.table === 'catalog_buyer_prices'));
});

test('anonymous legacy slug fallback also skips prices and returns full detail', async () => {
  const f = fixture({ direct: false }); const result = await f.getCatalogProductBySkuOrSlug('legacy-phone-part', { includeBuyerPrices: false });
  assert.deepEqual(result.data, f.product);
  assert.ok(!f.calls.some(c => c.type === 'auth' || c.table === 'catalog_buyer_prices'));
});

test('cached banners cannot render before start, at expiry, or after deletion', () => {
  const { isActivePublicBanner } = fixture(); const now = Date.parse('2026-09-26T10:00:00Z');
  const banner = { is_active: true, starts_at: '2026-09-26T10:00:00Z', ends_at: '2026-09-26T10:01:00Z' };
  assert.equal(isActivePublicBanner(banner, now - 1), false);
  assert.equal(isActivePublicBanner(banner, now), true);
  assert.equal(isActivePublicBanner(banner, now + 60_000), false);
  assert.equal(isActivePublicBanner({ ...banner, deleted_at: '2026-09-26T09:59:00Z' }, now), false);
  assert.equal(isActivePublicBanner({ ...banner, is_active: false }, now), false);
});
