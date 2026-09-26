import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/i18n/translate.ts', import.meta.url), 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { translate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('pure translator retains Chinese, Italian, repeated placeholders, zero and unknown-key fallback', () => {
 const dictionary = { it: '{count} articoli · {count}', zh: '{name}，共{count}件', blank: '' };
 assert.equal(translate(dictionary,'it',{count:0}), '0 articoli · 0');
 assert.equal(translate(dictionary,'zh',{name:'客户',count:2}), '客户，共2件');
 assert.equal(translate(dictionary,'missing'), 'missing');
 assert.equal(translate(dictionary,'blank'), '');
 assert.equal(translate(dictionary,'it'), '{count} articoli · {count}');
});
