// Isolated real React components + mocked auth/API. Never places an order or accesses production.
// PLAYWRIGHT_MODULE may point to the installed Playwright package. Uses a fresh Chrome profile.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(path.join(tmpdir(), 'partspro-pricing-ui-'));
const output = path.resolve(root, process.argv[2] || 'outputs/pricing/2026-09-27');
try {
  for (const name of ['build.cjs', 'entry.tsx', 'run.cjs']) {
    const source = readFileSync(path.join(root, 'tests/fixtures/account-pricing-ui', `${name}.fixture`), 'utf8');
    writeFileSync(path.join(temporary, name), source.replaceAll('__HARNESS_DIR__', JSON.stringify(temporary)));
  }
  execFileSync(process.execPath, [path.join(temporary, 'build.cjs')], { cwd: root, stdio: 'inherit' });
  execFileSync(process.execPath, [path.join(temporary, 'run.cjs')], {
    cwd: root, stdio: 'inherit', timeout: 90_000,
    env: { ...process.env, PRICING_UI_OUTPUT_DIR: output },
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
