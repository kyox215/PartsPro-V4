import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const customerA = '11111111-1111-4111-8111-111111111111';
const customerB = '22222222-2222-4222-8222-222222222222';
const campaign = { enabled: true, level: 'silver', duration_months: 3, starts_at: null, ends_at: null };
const json = data => new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

// Execute the actual TSX with a deterministic hook/JSX host. Browser layout and
// native fieldset behavior are verified separately in the real-component fixture.
function harness({ fetch: fetchImpl = async () => json(campaign), locale = 'zh-CN', commerce = false } = {}) {
  const instances = new Map(); let current = null, cursor = 0, needsRender = false, tree, component, props;
  const jsx = (type, props = {}, key) => ({ type, props, key });
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const index = cursor++, instance = current;
      if (!instance.hooks[index]) instance.hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
      const hook = instance.hooks[index];
      if (!hook.set) hook.set = value => { const next = typeof value === 'function' ? value(hook.value) : value; if (!Object.is(next, hook.value)) { hook.value = next; needsRender = true; } };
      return [hook.value, hook.set];
    },
    useRef(initial) { const index = cursor++; return (current.hooks[index] ??= { current: initial }); },
    useEffect(effect, deps) {
      const index = cursor++, old = current.hooks[index];
      if (!old || !same(old.deps, deps)) current.hooks[index] = { deps, effect, cleanup: old?.cleanup, pending: true };
    },
    useCallback(fn, deps) { const index = cursor++, old = current.hooks[index]; if (!old || !same(old.deps, deps)) current.hooks[index] = { deps, fn }; return current.hooks[index].fn; },
  };
  const host = name => input => jsx(name, input);
  const feedback = {
    AdminActionButton: ({ pending, pendingLabel, children, disabled, ...rest }) => jsx('button', { ...rest, disabled: pending || disabled, 'aria-busy': pending, children: pending && pendingLabel ? pendingLabel : children }),
    AdminNotice: ({ tone, title, message, children, action }) => jsx('aside', { 'data-admin-notice': tone, children: [title, children ?? message, action] }),
    AdminEmptyState: ({ title, description, action }) => jsx('aside', { 'data-admin-empty': true, children: [title, description, action] }),
    AdminRefreshBar: ({ pending, label }) => pending ? jsx('span', { role: 'status', children: label }) : null,
  };
  const listeners = new Map();
  const context = {
    module: { exports: {} }, exports: null, console, Date, Intl, JSON, Response, AbortController, AbortSignal,
    fetch: fetchImpl,
    window: { addEventListener: (name, fn) => { const set = listeners.get(name) ?? new Set(); set.add(fn); listeners.set(name, set); }, removeEventListener: (name, fn) => listeners.get(name)?.delete(fn) },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name.endsWith('i18n-provider')) return { useI18n: () => ({ locale }) };
      if (name.endsWith('admin-feedback')) return feedback;
      if (name.endsWith('/button')) return { Button: host('button') };
      if (name.endsWith('/input')) return { Input: host('input') };
      if (name.endsWith('/label')) return { Label: host('label') };
      if (name.endsWith('partspro-pricing')) return { customerTiers: ['bronze', 'silver', 'gold', 'emerald', 'diamond', 'master', 'king'] };
      if (name === 'lucide-react') return { ShoppingBag: host('svg') };
      if (name.endsWith('/select')) return Object.fromEntries(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'].map(name => [name, host(name)]));
      if (name.endsWith('/tabs')) return Object.fromEntries(['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger'].map(name => [name, host(name)]));
      if (name === './admin-marketplace-panel') return { AdminMarketplacePanel: () => jsx('span', { children: 'Marketplace fixture' }) };
      throw Error('Unexpected import: ' + name);
    },
  };
  context.exports = context.module.exports;
  const source = readFileSync(new URL(`src/components/partspro/admin-${commerce ? 'commerce' : 'pricing'}-panel.tsx`, root), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  function expand(value, path) {
    if (value == null || value === false) return null;
    if (Array.isArray(value)) return value.map((child, index) => expand(child, `${path}.${index}`));
    if (typeof value !== 'object') return value;
    if (typeof value.type === 'function') {
      const id = `${path}:${value.type.name}:${value.key ?? ''}`;
      let instance = instances.get(id); if (!instance) { instance = { hooks: [] }; instances.set(id, instance); }
      instance.seen = true; const previous = current, previousCursor = cursor; current = instance; cursor = 0;
      const output = value.type(value.props); current = previous; cursor = previousCursor;
      return expand(output, `${id}/`);
    }
    return { ...value, children: expand(value.props.children, path + '/children') };
  }
  function render() {
    let count = 0;
    do {
      if (++count > 30) throw Error('Hook render did not settle');
      needsRender = false; for (const instance of instances.values()) instance.seen = false;
      tree = expand(jsx(component, props), 'root');
      for (const [id, instance] of instances) if (!instance.seen) { for (const hook of instance.hooks) hook?.cleanup?.(); instances.delete(id); }
      for (const instance of instances.values()) for (const hook of instance.hooks) if (hook?.pending) { hook.pending = false; hook.cleanup?.(); hook.cleanup = hook.effect(); }
    } while (needsRender);
    return tree;
  }
  const api = {
    mount(name = commerce ? 'AdminCommercePanel' : 'AdminPricingPanel', input = { permissions: ['pricing.manage_policy', 'customers.read', 'orders.manage'], customerId: customerA }) { component = context.module.exports[name]; props = input; render(); return api; },
    update(input) { props = { ...props, ...input }; render(); },
    render, get tree() { return tree; }, listeners,
    async settle() { for (let i = 0; i < 4; i++) { await new Promise(resolve => setImmediate(resolve)); render(); } },
    dispose() { for (const instance of instances.values()) for (const hook of instance.hooks) hook?.cleanup?.(); instances.clear(); },
  };
  return api;
}
function nodes(tree, result = []) { if (Array.isArray(tree)) tree.forEach(node => nodes(node, result)); else if (tree && typeof tree === 'object') { result.push(tree); nodes(tree.children, result); } return result; }
function text(tree) { if (Array.isArray(tree)) return tree.map(text).join(' '); if (tree && typeof tree === 'object') return text(tree.children); return tree == null ? '' : String(tree); }
function find(h, predicate) { const node = nodes(h.tree).find(predicate); assert.ok(node, 'Expected UI node'); return node; }
function button(h, label) { return find(h, node => node.type === 'button' && text(node).includes(label)); }
function months(h) { return find(h, node => node.type === 'input' && node.props.max === 24); }
function reason(h) { return find(h, node => node.type === 'input' && node.props['aria-describedby'] === 'campaign-reason-hint'); }
function edit(h, month = 8, why = '活动审查原因') { months(h).props.onChange({ target: { value: String(month) } }); h.render(); reason(h).props.onChange({ target: { value: why } }); h.render(); }
function toggle(h, open) { const node = find(h, node => node.type === 'details'); node.props.onToggle({ currentTarget: { open } }); h.render(); }
function submit(h) { find(h, node => node.type === 'form').props.onSubmit({ preventDefault() {} }); h.render(); }
async function opened(options) { const h = harness(options).mount(); toggle(h, true); await h.settle(); return h; }

test('actual global campaign draft survives collapse and customer switch while quote context resets', async () => {
  let reads = 0; const h = await opened({ fetch: async () => { reads++; return json(campaign); } });
  edit(h); toggle(h, false); toggle(h, true); h.update({ customerId: customerB }); await h.settle();
  assert.equal(months(h).props.value, 8); assert.equal(reason(h).props.value, '活动审查原因'); assert.equal(reads, 1);
  assert.ok(nodes(h.tree).some(node => node.type === 'input' && node.props.value === customerB));
  assert.equal(find(h, node => node.props['data-admin-pricing']).props['data-admin-dirty'], 'true'); h.dispose();
});

test('actual pending save freezes fields, rejects duplicate submit and collapse, and preserves submitted body', async () => {
  const pending = deferred(); const writes = []; const mutations = [];
  const h = await opened({ fetch: async (url, init) => { if (init?.method === 'PATCH') { writes.push(JSON.parse(init.body)); return pending.promise; } return json(campaign); } });
  h.update({ onMutatingChange: value => mutations.push(value) }); edit(h, 6); submit(h); submit(h);
  assert.equal(writes.length, 1); assert.equal(writes[0].duration_months, 6);
  const fieldset = find(h, node => node.type === 'fieldset' && nodes(node).some(child => child.type === 'input' && child.props.max === 24)); assert.equal(fieldset.props.disabled, true);
  edit(h, 9, '新的原因'); assert.equal(months(h).props.value, 6); assert.equal(reason(h).props.value, '活动审查原因');
  const details = find(h, node => node.type === 'details'); const target = { open: false }; details.props.onToggle({ currentTarget: target }); h.render(); assert.equal(target.open, true);
  assert.equal(find(h, node => node.props['data-admin-pricing']).props['data-admin-mutating'], 'true'); assert.ok(mutations.includes(true));
  pending.resolve(json({ ...campaign, duration_months: 6 })); await h.settle(); assert.equal(months(h).props.value, 6); assert.equal(reason(h).props.value, ''); h.dispose();
});

test('2xx invalid JSON locks PATCH, preserves attempt, rereads without overwriting draft, and requires explicit adoption', async () => {
  let writes = 0; let current = campaign;
  const h = await opened({ fetch: async (url, init) => { if (init?.method === 'PATCH') { writes++; current = { ...campaign, duration_months: 6 }; return new Response('{invalid', { status: 200 }); } return json(current); } });
  edit(h, 6, '原提交原因'); submit(h); await h.settle(); submit(h); await h.settle();
  assert.equal(writes, 1); assert.ok(text(h.tree).includes('保存结果未知')); assert.ok(text(h.tree).includes('原提交原因')); assert.equal(reason(h).props.value, '原提交原因');
  button(h, '只读重读').props.onClick(); await h.settle(); assert.equal(writes, 1); assert.ok(text(h.tree).includes('当前服务器配置')); assert.equal(reason(h).props.value, '原提交原因');
  assert.equal(find(h, node => node.type === 'fieldset' && nodes(node).some(child => child.type === 'input' && child.props.max === 24)).props.disabled, true);
  button(h, '已核对，采用').props.onClick(); h.render(); assert.equal(months(h).props.value, 6); assert.equal(reason(h).props.value, ''); assert.ok(text(h.tree).includes('原提交原因')); assert.equal(writes, 1); h.dispose();
});

test('network unknown and failed reconciliation retain frozen original input without extra writes', async () => {
  let writes = 0, reads = 0;
  const h = await opened({ fetch: async (url, init) => { if (init?.method === 'PATCH') { writes++; throw Error('network'); } if (++reads > 1) return new Response('broken', { status: 503 }); return json(campaign); } });
  edit(h, 7, '网络未知原因'); submit(h); await h.settle(); button(h, '只读重读').props.onClick(); await h.settle();
  assert.equal(writes, 1); assert.equal(months(h).props.value, 7); assert.equal(reason(h).props.value, '网络未知原因'); assert.ok(text(h.tree).includes('读取配置失败')); assert.ok(text(h.tree).includes('保存结果未知')); assert.ok(!nodes(h.tree).some(node => node.type === 'button' && text(node).includes('已核对，采用'))); h.dispose();
});

test('explicit write refusal is an error with retained editable draft and initial read has a real retry', async () => {
  let failRead = true; const h = await opened({ fetch: async (url, init) => init?.method === 'PATCH' ? new Response(JSON.stringify({ error: { code: 'HTTP_403' } }), { status: 403 }) : failRead ? new Response('{}', { status: 503 }) : json(campaign) });
  assert.ok(text(h.tree).includes('读取配置失败')); failRead = false; button(h, '重读配置').props.onClick(); await h.settle(); edit(h); submit(h); await h.settle();
  assert.ok(text(h.tree).includes('保存被拒绝')); assert.equal(months(h).props.value, 8); assert.equal(reason(h).props.value, '活动审查原因'); assert.equal(find(h, node => node.type === 'fieldset' && nodes(node).some(child => child.type === 'input' && child.props.max === 24)).props.disabled, false); h.dispose();
});

test('late quote from customer A cannot render in customer B or overwrite its context', async () => {
  const pending = deferred(); let signal;
  const h = await opened({ fetch: async (url, init) => { if (init?.method === 'POST') { signal = init.signal; return pending.promise; } return json(campaign); } });
  button(h, '查询价格').props.onClick(); h.render(); h.update({ customerId: customerB });
  assert.equal(signal.aborted, true); pending.resolve(json([{ sku_code: 'OLD-CUSTOMER-SKU', effective_unit_price: 9 }])); await h.settle();
  assert.ok(!text(h.tree).includes('OLD-CUSTOMER-SKU')); assert.ok(nodes(h.tree).some(node => node.type === 'input' && node.props.value === customerB)); h.dispose();
});

test('Italian pricing empty/error/check states and Commerce shell contain translated UI', async () => {
  const h = await opened({ locale: 'it-IT', fetch: async url => url.includes('view=') ? json([]) : json(campaign) });
  assert.doesNotMatch(text(h.tree), /[\u3400-\u9fff]/); button(h, 'Verifica coerenza').props.onClick(); await h.settle(); assert.ok(text(h.tree).includes('Nessuna anomalia'));
  button(h, 'Leggi modifiche').props.onClick(); await h.settle(); assert.ok(text(h.tree).includes('Nessuna modifica')); assert.doesNotMatch(text(h.tree), /[\u3400-\u9fff]/); h.dispose();
  const commerce = harness({ locale: 'it-IT', commerce: true }).mount(); assert.ok(text(commerce.tree).includes('Canali di vendita')); assert.ok(text(commerce.tree).includes('Sito attuale')); assert.doesNotMatch(text(commerce.tree), /[\u3400-\u9fff]/); assert.equal(find(commerce, node => node.type === 'TabsList').props['aria-label'], 'Funzioni dei canali di vendita'); commerce.dispose();
});

test('actual classification preview invalidates readiness and aborts late results on scope change', async () => {
  const pending = deferred(); let signal; const ready = [];
  const h = harness({ locale: 'it-IT', fetch: async (url, init) => { signal = init.signal; return pending.promise; } }).mount('ClassificationPricePreview', { customerId: customerA, customerType: 'retail', onReady: value => ready.push(value) });
  button(h, "Anteprima dell'impatto").props.onClick(); h.render(); h.update({ customerId: customerB, customerType: 'wholesale' }); assert.equal(signal.aborted, true);
  pending.resolve(json({ items: [{ sku_code: 'OLD-SKU', before: { sku_code: 'OLD-SKU', effective_unit_price: 10 }, after: { sku_code: 'OLD-SKU', effective_unit_price: 9 } }] })); await h.settle();
  assert.ok(!text(h.tree).includes('OLD-SKU')); assert.ok(!ready.includes(`${customerA}:retail`)); assert.equal(ready.at(-1), ''); assert.doesNotMatch(text(h.tree), /[\u3400-\u9fff]/); h.dispose();
});

test('beforeunload protects actual draft and unknown request but is cleaned up on unmount', async () => {
  const h = await opened(); edit(h); let prevented = false; const event = { preventDefault() { prevented = true; }, returnValue: null };
  for (const callback of h.listeners.get('beforeunload')) callback(event); assert.equal(prevented, true); assert.equal(event.returnValue, ''); h.dispose(); assert.equal(h.listeners.get('beforeunload').size, 0);
});

test('a newer failed reconciliation invalidates the prior current snapshot and cannot unlock saving', async () => {
  let reads = 0;
  const h = await opened({ fetch: async (url, init) => init?.method === 'PATCH' ? new Response('{bad', { status: 200 }) : ++reads < 3 ? json(campaign) : new Response('{}', { status: 503 }) });
  edit(h); submit(h); await h.settle(); button(h, '只读重读').props.onClick(); await h.settle(); assert.ok(button(h, '已核对，采用'));
  button(h, '只读重读').props.onClick(); await h.settle(); assert.ok(!nodes(h.tree).some(node => node.type === 'button' && text(node).includes('已核对，采用'))); assert.equal(reason(h).props.value, '活动审查原因'); h.dispose();
});

test('2xx structurally invalid write response is unknown rather than a false success', async () => {
  let writes = 0; const h = await opened({ fetch: async (url, init) => { if (init?.method === 'PATCH') { writes++; return json({ ...campaign, enabled: 'yes' }); } return json(campaign); } });
  edit(h); submit(h); await h.settle(); submit(h); assert.equal(writes, 1); assert.ok(text(h.tree).includes('保存结果未知')); assert.ok(!text(h.tree).includes('活动已保存')); h.dispose();
});

test('classification empty/invalid/success states never authorize missing quotes and are Italian', async () => {
  let outcome = 'empty'; const ready = [];
  const quote = { sku_code: 'VALID-SKU', effective_unit_price: 10 };
  const h = harness({ locale: 'it-IT', fetch: async () => json(outcome === 'empty' ? { items: [] } : outcome === 'invalid' ? null : { items: [{ sku_code: 'VALID-SKU', before: quote, after: { ...quote, effective_unit_price: 9 } }] }) }).mount('ClassificationPricePreview', { customerId: customerA, customerType: 'retail', onReady: value => ready.push(value) });
  button(h, "Anteprima dell'impatto").props.onClick(); await h.settle(); assert.ok(text(h.tree).includes('Nessun prezzo valido')); assert.equal(ready.at(-1), '');
  outcome = 'invalid'; button(h, "Anteprima dell'impatto").props.onClick(); await h.settle(); assert.ok(text(h.tree).includes('Anteprima non riuscita')); assert.equal(ready.at(-1), '');
  outcome = 'valid'; button(h, "Anteprima dell'impatto").props.onClick(); await h.settle(); assert.ok(text(h.tree).includes('VALID-SKU')); assert.equal(ready.at(-1), `${customerA}:retail`); assert.doesNotMatch(text(h.tree), /[\u3400-\u9fff]/); h.dispose();
});

test('actual accounts focus defers customer switch during pricing save and consumes it after release', () => {
  const source = readFileSync(new URL('src/components/partspro/admin-accounts-panel.tsx', root), 'utf8');
  const ast = ts.createSourceFile('accounts.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let focus, open;
  function walk(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'focusAccount') focus = node.initializer.arguments[0].getText(ast);
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'openDetail') open = node.getText(ast);
    ts.forEachChild(node, walk);
  }
  walk(ast); assert.ok(focus && open);
  const selected = [], loaded = [];
  const context = { module: { exports: {} }, exports: null, AbortController, Set,
    pricingMutatingRef: { current: true }, pricingDeferredFocusRef: { current: false }, focusAccountId: customerB, appliedFocusId: { current: customerA }, selectedAccountId: customerA,
    detailEpochRef: { current: 0 }, detailAbortRef: { current: null },
    setSelectedAccountId: value => selected.push(value), setDetail() {}, setDetailLoadedIncludes() {}, setDetailLoadingIncludes() {}, setDetailOpen() {},
    loadDetail: (target, options) => loaded.push({ target, options }), window: { matchMedia: () => ({ matches: false }) }, accountDetailInlineMediaQuery: '(min-width: 1280px)' };
  context.exports = context.module.exports;
  vm.runInNewContext(ts.transpileModule(`export const focus = ${focus};\n${open}\nexport { openDetail };`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
  context.module.exports.openDetail({ userId: customerB }); context.module.exports.focus();
  assert.equal(selected.length, 0); assert.equal(loaded.length, 0); assert.equal(context.pricingDeferredFocusRef.current, true); assert.equal(context.appliedFocusId.current, customerA);
  context.pricingMutatingRef.current = false; context.module.exports.focus(); assert.equal(selected[0], customerB); assert.equal(loaded[0].target, customerB); assert.equal(context.pricingDeferredFocusRef.current, false); assert.equal(context.appliedFocusId.current, customerB);
});

test('revoking customer-read permission aborts and removes anomaly results without discarding global draft', async () => {
  const pending = deferred(); let signal;
  const h = await opened({ fetch: async (url, init) => { if (url.includes('view=anomalies')) { signal = init.signal; return pending.promise; } return json(campaign); } });
  edit(h); button(h, '运行价格一致性').props.onClick(); h.render(); h.update({ permissions: ['pricing.manage_policy'] }); assert.equal(signal.aborted, true);
  pending.resolve(json([{ kind: 'manual_effective_mismatch', customer_id: 'PRIVATE-CUSTOMER' }])); await h.settle();
  assert.ok(!text(h.tree).includes('PRIVATE-CUSTOMER')); assert.equal(months(h).props.value, 8); assert.equal(reason(h).props.value, '活动审查原因'); assert.equal(button(h, '运行价格一致性').props.disabled, true); h.dispose();
});


test('5xx campaign responses are unknown, preserve the original attempt and lock a retry', async () => {
  for (const body of ['{bad', JSON.stringify({ error: { code: 'CAMPAIGN_UPDATE_FAILED' } })]) {
    let writes = 0;
    const h = await opened({ fetch: async (_url, init) => init?.method === 'PATCH' ? (writes++, new Response(body, { status: 503 })) : json(campaign) });
    edit(h, 6, 'Audit 5xx'); submit(h); await h.settle();
    assert.equal(writes, 1); assert.ok(text(h.tree).includes('保存结果未知'));
    assert.equal(find(h, node => node.type === 'fieldset' && nodes(node).some(child => child.type === 'input' && child.props.max === 24)).props.disabled, true);
    submit(h); await h.settle(); assert.equal(writes, 1); h.dispose();
  }
});
