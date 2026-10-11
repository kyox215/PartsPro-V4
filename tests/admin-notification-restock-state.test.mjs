import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const base = new URL('../', import.meta.url);
const uuid = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const item = { id: uuid, sku: 'PP-123', status: 'active', productName: 'Synthetic component', createdAt: '2026-10-11T10:00:00Z', targetPath: '/admin?panel=orders', readAt: null };
const json = (data, status = 200) => new Response(JSON.stringify({ data }), { status });
function source(path) { return fs.readFileSync(new URL(path, base), 'utf8'); }
function declarations(path, names) {
  const ast = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Map();
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) found.set(node.name.text, node.getText(ast));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) found.set(node.name.text, 'const ' + node.getText(ast) + ';');
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return names.map(name => { assert.ok(found.has(name), name); return found.get(name); }).join('\n') + '\nexport {' + names.join(',') + '};';
}
function run(code, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Math, JSON, URLSearchParams, AbortSignal, AbortController, Response, Request, setTimeout, clearTimeout, ...globals });
  return exports;
}
const notificationPath = 'src/components/partspro/notification-center.tsx';
const productPath = 'src/components/partspro/admin-products-panel.tsx';
const shared = { isRecord: value => !!value && typeof value === 'object' && !Array.isArray(value) };
function notification(names, globals = {}) { return run(declarations(notificationPath, names), { ...shared, ...globals }); }
function restock(names, globals = {}) { return run(declarations(productPath, names), { ...shared, readString: v => typeof v === 'string' ? v : null, toPublicSku: v => v, ...globals }); }

test('notification parser rejects malformed rows/counts/cursors instead of a false empty state', () => {
  const api = notification(['notificationUuid', 'isNotificationCount', 'readNotification', 'readNotificationPayload', 'readNotificationSummaryPayload']);
  for (const data of [{}, { notifications: [], unreadCount: -1 }, { notifications: [null], unreadCount: 0 }, { notifications: [], unreadCount: 3, hasMore: true }]) assert.throws(() => api.readNotificationPayload({ data }));
  assert.throws(() => api.readNotificationSummaryPayload({ data: {} }));
  const valid = api.readNotificationPayload({ data: { notifications: [item], unreadCount: 121, hasMore: true, nextCursor: { beforeId: uuid, beforeCreatedAt: item.createdAt } } });
  assert.equal(valid.unreadCount, 121); assert.equal(valid.nextCursor.beforeId, uuid);
});
test('appending older notification pages deduplicates IDs and preserves a confirmed read', () => {
  const { mergeNotificationItems } = notification(['mergeNotificationItems']);
  const rows = mergeNotificationItems([{ ...item, readAt: item.createdAt }], [item, { ...item, id: other }]);
  assert.equal(rows.length, 2); assert.equal(rows[0].readAt, item.createdAt);
});
test('notification write validates receipts and distinguishes rejected from unknown outcomes', async () => {
  let response;
  const api = notification(['isNotificationCount', 'NotificationActionError', 'notificationActionRequest'], { fetch: async () => { if (response instanceof Error) throw response; return response; } });
  for (const [value, unknown] of [[json({}, 403), false], [json({}, 503), true], [new Response('{'), true], [json({}), true], [new Error('offline'), true]]) {
    response = value; await assert.rejects(api.notificationActionRequest('/api/notifications/read', {}), e => e.unknown === unknown);
  }
  response = json({ ok: true }); assert.equal((await api.notificationActionRequest('/api/notifications/read', {})).ok, true);
  response = json({ eventCount: 1, pushDeliveredCount: 0, pushFailedCount: 1 }); assert.equal((await api.notificationActionRequest('/api/notifications/test', {})).pushFailedCount, 1);
});
test('already-read notification never sends another POST or decrements the badge; rejected POST preserves unread row', async () => {
  let calls = 0, rows = [item], notice, navigations = 0, busy = null;
  const api = notification(['NotificationActionError', 'openNotification'], {
    notificationActionRef: { current: false }, summarySequenceRef: { current: 0 }, requiresReview: false,
    canLeaveForNotification: () => true, router: { push: () => { navigations++; } }, text: { actionError: 'rejected' },
    setNotice: value => { notice = value; }, setPopoverOpen() {}, setBusyAction: value => { busy = value; }, setRequiresReview() {},
    setItems: callback => { rows = callback(rows); }, loadNotificationSummary: async () => {},
    notificationActionRequest: async () => { calls++; throw new Error('rejected'); },
  });
  await api.openNotification({ ...item, readAt: item.createdAt }); assert.equal(calls, 0); assert.equal(navigations, 1);
  await api.openNotification(item); assert.equal(calls, 1); assert.equal(rows[0].readAt, null); assert.equal(notice.tone, 'error'); assert.equal(busy, null);
  await api.openNotification({ ...item, targetPath: '//evil.invalid' }); assert.equal(navigations, 2);
});
test('notification navigation respects pending operations and a declined dirty-draft confirmation', () => {
  let pending = true, dirty = true, prompts = 0;
  const { canLeaveForNotification } = notification(['canLeaveForNotification'], {
    document: { body: { getAttribute: () => 'true' }, querySelector: selector => selector.includes('mutating') ? pending : dirty },
    window: { confirm: () => { prompts++; return false; } },
  });
  assert.equal(canLeaveForNotification({}), false); assert.equal(prompts, 0);
  pending = false; assert.equal(canLeaveForNotification({}), false); assert.equal(prompts, 1);
  dirty = false; assert.equal(canLeaveForNotification({}), true);
});
test('notification full-list read reports failure and preserves prior rows', async () => {
  let failed = false, loading, writes = 0;
  const { loadNotifications } = notification(['loadNotifications'], {
    notificationRequestRef: { current: { sequence: 0, controller: null } }, nextCursorRef: { current: null },
    text: { refreshed: "refreshed" }, React: { useCallback: fn => fn }, window: { setTimeout, clearTimeout }, fetch: async () => new Response('', { status: 503 }),
    setReadError: v => { failed = v; }, setLoading: v => { loading = v; }, setItems: () => { writes++; },
  });
  assert.equal(await loadNotifications(), false); assert.equal(failed, true); assert.equal(loading, false); assert.equal(writes, 0);
});
test('known notification write plus failed read is locked for review, and concurrent tests send once', async () => {
  let resolve, calls = 0, review, notice, busy;
  const pending = new Promise(done => { resolve = done; });
  const { sendTest } = notification(['NotificationActionError', 'sendTest'], {
    notificationActionRef: { current: false }, requiresReview: false,
    text: { savedReadError: 'saved-read-failed', testLocal: 'local-only' },
    notificationActionRequest: async () => { calls++; await pending; return { eventCount: 1, pushDeliveredCount: 0, pushFailedCount: 0 }; },
    loadNotifications: async () => false, setRequiresReview: v => { review = v; }, setNotice: v => { notice = v; }, setBusyAction: v => { busy = v; },
  });
  const first = sendTest(); await sendTest(); assert.equal(calls, 1); resolve(); await first;
  assert.equal(review, true); assert.equal(notice.message, 'saved-read-failed'); assert.equal(busy, null);
});
function readBody(request) { return request.json().then(data => ({ ok: true, data }), () => ({ ok: false })); }
function notificationReadRoute(auth = true) {
  const calls = [];
  const api = run(source('src/app/api/notifications/read/route.ts'), { require: name => {
    if (name === 'zod') return req('zod');
    if (name === 'next/server') return { NextResponse: { json: body => ({ status: 200, body }) } };
    if (name.endsWith('partspro-api')) return { readJsonBody: readBody, apiError: (status, code) => ({ status, code }), formatZodIssues: e => e.issues };
    if (name.endsWith('partspro-account-context')) return { getCurrentAccountContext: async () => ({ authenticated: auth, userId: auth ? uuid : null }) };
    if (name.endsWith('partspro-notifications')) return { markNotificationEventsRead: async input => { calls.push(input); return { ok: true }; }, NotificationServiceError: class extends Error {} };
    throw Error(name);
  } });
  return { ...api, calls };
}
test('read API rejects broken JSON/empty IDs before any write; explicit empty object remains mark-all', async () => {
  const route = notificationReadRoute();
  for (const body of ['{', '{"ids":[]}', '{"ids":"bad"}']) {
    const result = await route.POST(new Request('https://fixture.invalid', { method: 'POST', body })); assert.equal(result.status, 400);
  }
  assert.equal(route.calls.length, 0);
  assert.equal((await route.POST(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }))).status, 200);
  assert.equal(route.calls.length, 1); assert.equal(route.calls[0].userId, uuid);
  const anonymous = notificationReadRoute(false); assert.equal((await anonymous.POST(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }))).status, 401); assert.equal(anonymous.calls.length, 0);
});
test('notification cursor sanitizes raw filters and service scopes both queries to the current recipient', async () => {
  const names = ['notificationCursorFilter', 'listNotificationEvents'];
  const calls = [];
  const client = { from: table => {
    const query = { table }; calls.push(query);
    const chain = Object.fromEntries(['select', 'eq', 'order', 'limit', 'is', 'or'].map(name => [name, (...args) => { (query[name] ??= []).push(args); return chain; }]));
    chain.then = (resolve, reject) => Promise.resolve(query.select[0][1]?.head ? { count: 121 } : { data: [item, { ...item, id: other }] }).then(resolve, reject);
    return chain;
  } };
  const api = run(declarations('src/lib/partspro-notifications.ts', names), { ...shared, getNotificationClient: () => client, readRows: x => x, toNotificationEventDto: x => x, NotificationServiceError: class extends Error {} });
  for (const [date, id] of [[item.createdAt, 'id),or(status.eq.read)'], ['bad),id.eq.x', uuid], [undefined, uuid]]) assert.throws(() => api.notificationCursorFilter(date, id));
  const precise = '2026-10-11T10:00:00.123456+00:00';
  assert.equal(api.notificationCursorFilter(precise, uuid), `created_at.lt.${precise},and(created_at.eq.${precise},id.lt.${uuid})`);
  const result = await api.listNotificationEvents({ userId: uuid, limit: 1, beforeId: uuid, beforeCreatedAt: precise });
  assert.equal(result.hasMore, true); assert.equal(result.notifications.length, 1); assert.equal(result.nextCursor.beforeId, uuid); assert.equal(result.unreadCount, 121);
  assert.equal(calls.length, 2); for (const query of calls) assert.deepEqual(query.eq[0], ['recipient_user_id', uuid]);
  assert.equal(calls[0].limit[0][0], 2); assert.equal(calls[0].order.length, 2); assert.ok(calls[0].or[0][0].includes('id.lt.' + uuid)); assert.ok(calls[0].or[0][0].includes('.123456+00:00'));

});
const restockNames = ['normalizeRestockRequestStatus', 'parseRestockRequestRow', 'readRestockRequestRows', 'readPayloadDataObject', 'RestockActionError', 'confirmedRestockRow', 'fetchAdminRestockRequests', 'fetchAdminRestockRequest', 'updateAdminRestockRequestStatus'];
function restockApi(fetch) { return restock(restockNames, { fetch, readJsonResponse: response => response.json() }); }
test('restock pages retain exact total/offset and reject malformed data instead of hiding reminders', async () => {
  let payload, url;
  const api = restockApi(async value => { url = value; return new Response(JSON.stringify(payload)); });
  payload = { data: [item], meta: { total: 121, limit: 50, offset: 100 } };
  const page = await api.fetchAdminRestockRequests(100); assert.equal(page.total, 121); assert.match(url, /offset=100/); assert.match(url, /limit=50/);
  for (const value of [{ data: [null], meta: { total: 121, limit: 50, offset: 100 } }, { data: [], meta: {} }, { data: [], meta: { total: 0, limit: 50, offset: 0, warning: 'schema absent' } }]) { payload = value; await assert.rejects(api.fetchAdminRestockRequests(value.meta?.offset ?? 0)); }
  payload = { data: [], meta: { total: 1, limit: 50, offset: 100 } }; assert.equal((await api.fetchAdminRestockRequests(100)).total, 1);
});
test('restock write requires exact ID/SKU/final status; unknown results and 409 require read-back', async () => {
  let response;
  const api = restockApi(async () => { if (response instanceof Error) throw response; return response; });
  for (const value of [json(null), json({ ...item, id: other, status: 'notified' }), json({ ...item, sku: 'OTHER', status: 'notified' }), json(item), new Response('{'), json({}, 503), json({}, 409), new Error('offline')]) {
    response = value; await assert.rejects(api.updateAdminRestockRequestStatus(item, 'notified'), error => error.requiresReview === true);
  }
  response = json({}, 403); await assert.rejects(api.updateAdminRestockRequestStatus(item, 'notified'), error => error.requiresReview === false);
  response = json({ ...item, status: 'notified' }); assert.equal((await api.updateAdminRestockRequestStatus(item, 'notified')).status, 'notified');
});
test('restock recovery performs only a scoped GET and accepts a current active or final state', async () => {
  let args, state = 'active';
  const api = restockApi(async (...input) => { args = input; return json({ ...item, status: state }); });
  assert.equal((await api.fetchAdminRestockRequest(item)).status, 'active'); assert.equal(args[0], '/api/admin/restock-requests/' + uuid); assert.equal(args[1].method, undefined);
  state = 'cancelled'; assert.equal((await api.fetchAdminRestockRequest(item)).status, 'cancelled');
});
test('restock repository update is atomic only for active rows and conflicts never overwrite a processed reminder', async () => {
  const filters = [], updates = [];
  const chain = { update: value => { updates.push(value); return chain; }, eq: (...args) => { filters.push(args); return chain; }, select: () => chain, single: async () => ({ error: { code: 'PGRST116' } }) };
  const api = run(declarations('src/lib/partspro-repository.ts', ['updateAdminProductRestockRequestStatus']), {
    requireSupabaseContext: async () => ({ client: { from: table => { assert.equal(table, 'product_restock_requests'); return chain; } } }), productRestockRequestSelect: 'id',
    RepositoryWriteError: class extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } },
  });
  await assert.rejects(api.updateAdminProductRestockRequestStatus(uuid, 'notified'), e => e.status === 409 && e.code === 'RESTOCK_REQUEST_NOT_ACTIVE');
  assert.deepEqual(filters, [['id', uuid], ['status', 'active']]); assert.equal(updates.length, 1);
});
test('restock GET route checks existing admin permission and validates IDs before repository access', async () => {
  let permission, reads = 0, authenticated = true;
  const api = run(source('src/app/api/admin/restock-requests/[id]/route.ts'), { require: name => {
    if (name === 'zod') return req('zod');
    if (name === 'next/server') return { NextResponse: { json: body => ({ status: 200, body }) } };
    if (name.endsWith('partspro-api')) return { apiError: (status, code) => ({ status, code }) };
    if (name.endsWith('partspro-repository')) return { getAdminProductRestockRequest: async id => { reads++; assert.equal(id, uuid); return { data: item, source: 'supabase' }; } };
    if (name === '../../_shared') return { requireAdminApi: async value => { permission = value; return authenticated ? { ok: true } : { ok: false, response: { status: 403 } }; }, repositoryErrorResponse: () => ({ status: 502 }) };
    throw Error(name);
  } });
  assert.equal((await api.GET({}, { params: Promise.resolve({ id: 'invalid' }) })).status, 400); assert.equal(reads, 0);
  assert.equal((await api.GET({}, { params: Promise.resolve({ id: uuid }) })).status, 200); assert.equal(reads, 1); assert.equal(permission, 'product.read_admin');
  authenticated = false; assert.equal((await api.GET({}, { params: Promise.resolve({ id: uuid }) })).status, 403); assert.equal(reads, 1);
});

test('missing authoritative notification summary count fails rather than resetting the badge to zero', async () => {
  let count = null;
  const client = { from: () => {
    const chain = Object.fromEntries(['select', 'eq', 'is', 'order', 'limit', 'maybeSingle'].map(name => [name, () => chain]));
    chain.then = (resolve, reject) => Promise.resolve({ count, data: null }).then(resolve, reject); return chain;
  } };
  const { getNotificationSummary } = run(declarations('src/lib/partspro-notifications.ts', ['getNotificationSummary']), {
    getNotificationClient: () => client, readString: value => typeof value === 'string' ? value : null,
    NotificationServiceError: class extends Error { constructor(status, code) { super(code); this.status = status; } },
  });
  await assert.rejects(getNotificationSummary({ userId: uuid }), error => error.status === 502);
  count = 0; assert.equal((await getNotificationSummary({ userId: uuid })).unreadCount, 0);
  count = 55; assert.equal((await getNotificationSummary({ userId: uuid })).unreadCount, 55);
});

test('declining a catalog draft navigation sends neither a router transition nor a mark-read POST', async () => {
  let navigated = 0, posts = 0, confirmed = 0;
  const api = notification(['NotificationActionError', 'canLeaveForNotification', 'openNotification'], {
    notificationActionRef: { current: false }, requiresReview: false, text: { unsavedLeave: 'leave?', navigationBusy: 'cancelled' },
    document: { body: { getAttribute: () => 'true' }, querySelector: selectors => selectors.split(',').some(s => s.trim() === '[data-catalog-dirty="true"]') },
    window: { confirm: () => { confirmed++; return false; } }, router: { push: () => { navigated++; } }, setNotice() {},
    notificationActionRequest: async () => { posts++; return { ok: true }; },
  });
  await api.openNotification(item);
  assert.equal(confirmed, 1); assert.equal(navigated, 0); assert.equal(posts, 0);
});
