import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/partspro-public-cache.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture() {
  const entries = new Map();
  let project = 'https://project-a.supabase.co';
  let now = 1_000;
  const invalidations = [];
  const cache = {
    unstable_cache: (fn, parts, options) => async (...args) => {
      const key = JSON.stringify([parts, args]);
      if (entries.has(key)) return entries.get(key).data;
      const data = await fn(...args); // failures must not be persisted
      entries.set(key, { data, tags: options.tags });
      return data;
    },
    revalidateTag: (tag, profile) => {
      invalidations.push({ tag, profile });
      for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
    },
  };
  const loadModule = () => {
    const exports = {};
    const modules = {
      'server-only': {}, 'next/cache': cache,
      '@/lib/supabase/public': { createPublicReadClient: () => ({ project, role: 'anon' }) },
      '@/lib/supabase/env': { isSupabaseConfigured: () => true, getSupabaseEnv: () => ({ url: project }) },
    };
    new Function('require', 'exports', 'Date', compiled)((name) => {
      assert.ok(name in modules, `unexpected request-bound dependency: ${name}`);
      return modules[name];
    }, exports, { now: () => now });
    return exports;
  };
  return { loadModule, entries, invalidations, advance: ms => { now += ms; }, project: value => { project = value; } };
}

test('successful public data is shared across module instances and separated by project', async () => {
  const f = fixture(); let reads = 0;
  const read = async client => { reads++; assert.equal(client.role, 'anon'); return [client.project]; };
  const a = f.loadModule(), b = f.loadModule();
  const first = a.createCachedPublicRead(a.publicNavigationTag, 60, read);
  const second = b.createCachedPublicRead(b.publicNavigationTag, 60, read);
  assert.deepEqual(await first(), await second());
  assert.equal(reads, 1);
  f.project('https://project-b.supabase.co');
  assert.deepEqual(await second(), ['https://project-b.supabase.co']);
  assert.equal(reads, 2);
});

test('failed concurrent reads are not cached and later callers can retry', async () => {
  const f = fixture(), m = f.loadModule(); let reads = 0;
  const read = m.createCachedPublicRead(m.publicNavigationTag, 60, async () => {
    reads++; await Promise.resolve(); return reads === 1 ? null : ['recovered'];
  });
  assert.deepEqual(await Promise.all([read(), read(), read()]), [null, null, null]);
  assert.equal(reads, 1); assert.equal(f.entries.size, 0);
  assert.deepEqual(await read(), ['recovered']); assert.equal(reads, 2);
});

test('post-write invalidation refreshes other instances without evicting other tags', async () => {
  const f = fixture(), a = f.loadModule(), b = f.loadModule(); let version = 1;
  const nav = b.createCachedPublicRead(b.publicNavigationTag, 60, async () => version);
  const banners = b.createCachedPublicRead(b.publicBannersTag, 30, async () => version);
  assert.equal(await nav(), 1); assert.equal(await banners(), 1);
  version = 2; a.invalidatePublicNavigationCache();
  assert.equal(await nav(), 2); assert.equal(await banners(), 1);
  a.invalidatePublicBannersCache(); assert.equal(await banners(), 2);
  assert.ok(f.invalidations.every(x => x.profile.expire === 0));
});

test('scheduled banners bypass an expired SWR result using a stable cache key', async () => {
  const f = fixture(), m = f.loadModule(); let visible = [];
  const banners = m.createCachedPublicRead(m.publicBannersTag, 30, async () => visible, { requireFresh: true });
  assert.deepEqual(await banners(), []);
  f.advance(30_001); visible = ['now-open'];
  assert.deepEqual(await banners(), ['now-open']);
  assert.equal(f.entries.size, 1, 'no growing time-bucket keys');
});

test('public client cannot restore a visitor or admin session', () => {
  const text = readFileSync(new URL('../src/lib/supabase/public.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const calls = []; const exports = {};
  new Function('require', 'exports', js)(name => {
    if (name === 'server-only') return {};
    if (name === './env') return { getSupabaseEnv: () => ({ url: 'https://project.supabase.co', publishableKey: 'public-key' }) };
    assert.equal(name, '@supabase/supabase-js');
    return { createClient: (...args) => { calls.push(args); return {}; } };
  }, exports);
  exports.createPublicReadClient();
  assert.deepEqual(calls, [['https://project.supabase.co', 'public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }]]);
});
