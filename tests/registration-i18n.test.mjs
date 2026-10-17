import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = process.cwd();
const cache = new Map();
function load(relativePath, mocks = {}, extra = '') {
  const filename = path.resolve(root, relativePath);
  if (!extra && cache.has(filename)) return cache.get(filename);
  const source = fs.readFileSync(filename, 'utf8') + extra;
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  const component = ({ children }) => React.createElement('div', null, children);
  const fallback = new Proxy({}, { get: () => component });
  vm.runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name === 'zod') return zod;
      if (name === '@/lib/partspro-account-profile-validation') return load('src/lib/partspro-account-profile-validation.ts');
      if (name === 'react' || name === 'react/jsx-runtime') return name === 'react' ? React : { ...jsxRuntime };
      if (name.startsWith('.') && filename.includes('/src/i18n/')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')));
      if (name.startsWith('@/i18n/')) return load('src/' + name.slice(2) + '.ts');
      return fallback;
    }, console, URLSearchParams,
  }, { filename });
  if (!extra) cache.set(filename, loadedModule.exports);
  return loadedModule.exports;
}
const zod = await import('zod');
const jsxRuntime = await import('react/jsx-runtime');
const { getDictionary, translate } = load('src/i18n/get-dictionary.ts');
const copy = locale => (key, params) => translate(getDictionary(locale), key, params);
const extra = '\nexport { AccountProfileDialog, formatAccountOrderDateTime, orderStatusLabel, paymentStatusLabel, customerPromoHelper };';
const errors = load('src/lib/partspro-account-errors.ts');
const {accountCopy}=load('src/lib/partspro-account-copy.ts');
const {accountTranslationKeys}=load('src/i18n/account-translation-keys.ts');
const translatedCopy=locale=>text=>accountTranslationKeys[text]?copy(locale)(accountTranslationKeys[text]):accountCopy(text,locale);
const account = {...load('src/components/partspro/account-page.tsx', {}, extra),...errors};

test('profile form renders the real locale dictionary, not hardcoded Chinese', () => {
  for (const locale of ['en-US', 'it-IT', 'zh-CN']) {
    const { AccountProfileDialog } = load('src/components/partspro/account-page.tsx', {
      './i18n-provider': { useT: () => copy(locale), useI18n: () => ({ locale }) },
      './use-account-copy': {useAccountCopy:()=>translatedCopy(locale)},
    }, extra);
    const html = renderToStaticMarkup(React.createElement(AccountProfileDialog, {
      open: true, onOpenChange() {}, onSaved() {}, userEmail: 'fixture@example.test',
      profile: { companyName: '', contactName: '', email: 'fixture@example.test', phone: '', fiscalCode: '', pec: '', shippingAddress: '', billingAddress: '' },
    }));
    assert.ok(html.includes(copy(locale)('storefront.account.profile.title')));
    assert.ok(html.includes(copy(locale)('storefront.account.profile.save')));
    if (locale !== 'zh-CN') assert.doesNotMatch(html, /\p{Script=Han}|storefront\./u);
  }
});

test('API errors map to safe keys; unknown and network errors never expose raw messages', () => {
  const cases = [
    ['profile', 'INVALID_ACCOUNT_PROFILE', 400, 'profile.invalid'],
    ['profile', 'ACCOUNT_PROFILE_AUTH_REQUIRED', 401, 'profile.authRequired'],
    ['profile', 'CUSTOMER_PROFILE_UPDATE_FAILED', 403, 'profile.forbidden'],
    ['profile', 'CUSTOMER_PROFILE_UPDATE_FAILED', 500, 'profile.saveError'],
    ['orders', 'AUTH_REQUIRED', 401, 'orders.authRequired'],
    ['orders', 'ORDER_FORBIDDEN', 403, 'orders.forbidden'],
    ['orders', 'ORDER_NOT_FOUND', 404, 'orders.notFound'],
    ['orders', 'UNKNOWN', 500, 'orders.unavailable'],
  ];
  for (const [context, code, status, expected] of cases) {
    const key = account.accountRequestErrorKey(new account.AccountRequestError(code, status), context);
    assert.equal(key, 'storefront.account.' + expected);
    for (const locale of ['en-US', 'it-IT', 'zh-CN']) assert.notEqual(copy(locale)(key), key);
  }
  assert.equal(account.accountRequestErrorKey(new Error('RAW BACKEND ERROR'), 'profile'), 'storefront.account.profile.saveError');
});

test('labels, dates and promotions use the requested language', () => {
  assert.equal(translatedCopy('it-IT')(account.orderStatusLabel('shipped')), 'Spedito');
  assert.equal(translatedCopy('zh-CN')(account.paymentStatusLabel('paid')), '已付款');
  const value = '2026-10-17T10:00:00Z';
  for (const locale of ['en-US', 'it-IT', 'zh-CN']) {
    const result = account.formatAccountOrderDateTime(value, locale);
    assert.equal(result, new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone:'Europe/Rome' }).format(new Date(value)));
    const promo = account.customerPromoHelper({ promoLevel: 'gold', promoLevelStartsAt: new Date(Date.now() - 60_000).toISOString(), promoLevelExpiresAt: new Date(Date.now() + 60_000).toISOString() }, null, locale);
    const translated=translatedCopy(locale)(promo);
    assert.match(translated, locale === 'en-US' ? /^Promotion until / : locale === 'it-IT' ? /^Promozione fino al / : /^活动至 /);
  }
});

test('every server auth error and notice code exists in both locale dictionaries', () => {
  const source=fs.readFileSync('src/app/login/actions.ts','utf8');
  const refs=[...source.matchAll(/(error|notice):\s*["']([a-z_]+)["']/g)].map(m=>`storefront.login.${m[1]}.${m[2]}`);
  assert.ok(refs.length>10);
  for(const locale of ['en-US','it-IT','zh-CN'])for(const key of refs){assert.notEqual(copy(locale)(key),key);}
});

test('registration and account dictionary placeholders stay aligned', () => {
  const it = getDictionary('it-IT'), zh = getDictionary('zh-CN');
  for (const key of Object.keys(it).filter(key => /^storefront\.(account|login)\./.test(key))) {
    assert.deepEqual((it[key].match(/\{\w+\}/g) ?? []).sort(), (zh[key].match(/\{\w+\}/g) ?? []).sort(), key);
  }
});

test('registration and verification pages render notices and errors in the request locale', async () => {
  for (const locale of ['en-US', 'it-IT', 'zh-CN']) {
    const { default: LoginPage } = load('src/app/login/page.tsx', {
      'next/headers': { cookies: async () => ({ get: () => undefined }) },
      '@/i18n/request': { getRequestI18n: async () => ({ locale }) },
      '@/lib/supabase/env': { isSupabaseConfigured: () => true, isWeChatLoginEnabled: () => false },
      '@/lib/partspro-auth-redirect': { cleanAuthRedirect: () => '/account' },
      '@/lib/partspro-signup-verification': { SIGNUP_VERIFICATION_EMAIL_COOKIE: 'fixture-email', normalizeSignupVerificationEmail: () => '' },
      '@/lib/partspro-account-context': { getCurrentAccountContext: async () => ({ authenticated: false }) },
      '@/lib/partspro-admin-auth': { getAdminAuthState: async () => ({ allowed: false }) },
    }, '\nexport {};');
    for (const params of [{}, { mode: 'verify', notice: 'code_sent' }, { mode: 'verify', error: 'code' }, { mode: 'verify', error: 'resend_rate' }, { error: 'unknown', notice: 'unknown' }]) {
      const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve(params) }));
      assert.doesNotMatch(html, /storefront\./);
      if (locale !== 'zh-CN') assert.doesNotMatch(html, /\p{Script=Han}/u);
      else assert.match(html, /\p{Script=Han}/u);
    }
  }
});

test('every literal account copy has an Italian translation', () => {
  const source = fs.readFileSync('src/components/partspro/account-page.tsx','utf8');
  const ast = ts.createSourceFile('account.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const leaks=[];
  function walk(node){
    if(ts.isCallExpression(node)&&node.expression.getText(ast)==='c'&&node.arguments.length&&ts.isStringLiteral(node.arguments[0])){
      const literal=node.arguments[0].text;
      if(/\p{Script=Han}/u.test(translatedCopy('it-IT')(literal)))leaks.push(literal);
    }
    ts.forEachChild(node,walk);
  }
  walk(ast);assert.deepEqual(leaks,[]);
  for(const key of Object.values(accountTranslationKeys))for(const locale of ['en-US','it-IT','zh-CN'])assert.notEqual(copy(locale)(key),key);
});
