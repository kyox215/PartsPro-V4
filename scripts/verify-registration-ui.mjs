// Actual account components and dictionaries; isolated Chrome, all APIs mocked.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = process.cwd();
const temporary = mkdtempSync(path.join(tmpdir(), 'partspro-registration-ui-'));
try {
  const build = readFileSync('tests/fixtures/account-pricing-ui/build.cjs.fixture', 'utf8')
    .replace('return ts.transpileModule(source,', 'if(this.resourcePath.endsWith("/account-page.tsx"))source+=";export {AccountProfileDialog};"; return ts.transpileModule(source,')
    .replace("import React from 'react';export default function Link", "import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link")
    .replace("push(){},replace(){}","push(){},replace(destination){window.fixtureDestination=destination;window.history.replaceState(null,'',destination)}").replace("new URLSearchParams()","new URLSearchParams(location.search)")
    .replace("const alias={", `fs.writeFileSync(dir+'/actions.ts','export async function signOut(){}');fs.writeFileSync(dir+'/locale-actions.ts','export async function setLocale(){return {ok:true}}');fs.writeFileSync(dir+'/session.ts','export const usePricingSession=()=>({ready:true,key:"fixture"});');\nconst alias={'@/app/actions/i18n':dir+'/locale-actions.ts','./use-pricing-session':dir+'/session.ts','@/app/login/actions':dir+'/actions.ts',`);
  for (const name of ['build.cjs', 'entry.tsx', 'run.cjs']) {
    const source = name === 'build.cjs' ? build : readFileSync(`tests/fixtures/registration-ui/${name}.fixture`, 'utf8');
    writeFileSync(path.join(temporary, name), source.replaceAll('__HARNESS_DIR__', JSON.stringify(temporary)));
  }
  execFileSync(process.execPath, [path.join(temporary, 'build.cjs')], { cwd: root, stdio: 'inherit' });
  execFileSync(process.execPath, [path.join(temporary, 'run.cjs'), ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', timeout: 120_000 });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
