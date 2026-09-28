// Real React components, isolated browser profile, local fixtures only.
// PLAYWRIGHT_MODULE may point to a bundled package. CSS is compiled from current sources.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(path.join(tmpdir(), 'partspro-overlay-ui-'));
try {
  const build = readFileSync(path.join(root, 'tests/fixtures/account-pricing-ui/build.cjs.fixture'), 'utf8')
    .replace('return ts.transpileModule(source,', 'const extra=JSON.parse(process.env.OVERLAY_TEST_EXPORTS||"{}")[require("path").basename(this.resourcePath)]; if(extra)source+=";export {"+extra+"};"; return ts.transpileModule(source,');
  for (const name of ['build.cjs', 'entry.tsx', 'run.cjs']) {
    const source = name === 'build.cjs' ? build : readFileSync(path.join(root, 'tests/fixtures/overlay-ui', `${name}.fixture`), 'utf8');
    writeFileSync(path.join(temporary, name), source.replaceAll('__HARNESS_DIR__', JSON.stringify(temporary)));
  }
  execFileSync(process.execPath, [path.join(temporary, 'build.cjs')], {
    cwd: root, stdio: 'inherit', env: { ...process.env, OVERLAY_TEST_EXPORTS: JSON.stringify({
      'admin-accounts-panel.tsx': 'CustomerAccountActionDialog,AccountActionDialog,AccountProfileEditorDialog',
      'account-page.tsx': 'AccountProfileDialog',
      'admin-finance-panel.tsx': 'ExpenseDialog,SupplierPaymentDialog,financeCopy',
      'admin-products-panel.tsx': 'StockAdjustmentDialog,panelText',
      'admin-orders-panel.tsx': 'OrderPaymentMethodCard,OrderLogisticsCard,buildOrderLabels',
      'checkout-client.tsx': 'CheckoutSuccessDialog',
    }) },
  });
  execFileSync(process.execPath, [path.join(temporary, 'run.cjs')], {
    cwd: root, stdio: 'inherit', timeout: 180_000,
    env: { ...process.env, OVERLAY_UI_OUTPUT_DIR: path.resolve(root, process.argv[2] || 'outputs/overlay-ui/2026-09-28') },
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
