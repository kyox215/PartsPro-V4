import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationSource = readFileSync(
  path.join(
    repoRoot,
    "supabase/migrations/20260926091650_admin_customer_bulk_settlement_and_remax_price_rounding.sql"
  ),
  "utf8"
);
const routeSource = readFileSync(
  path.join(
    repoRoot,
    "src/app/api/admin/customers/[customerId]/settlement/route.ts"
  ),
  "utf8"
);
const repositorySource = readFileSync(
  path.join(repoRoot, "src/lib/partspro-customer-settlement.ts"),
  "utf8"
);
const panelSource = readFileSync(
  path.join(repoRoot, "src/components/partspro/admin-accounts-panel.tsx"),
  "utf8"
);

test("bulk settlement requires customer read and order management permissions at every boundary", () => {
  assert.match(routeSource, /requireAdminApi\("customers\.read"\)/);
  assert.match(routeSource, /hasAdminPermission\(admin\.authState, "orders\.manage"\)/);
  assert.match(
    migrationSource,
    /partspro_has_permission\('customers\.read'\)[\s\S]*partspro_has_permission\('orders\.manage'\)/
  );
  assert.match(migrationSource, /revoke all on function public\.admin_settle_customer_orders/);
  assert.match(migrationSource, /grant execute on function public\.admin_settle_customer_orders[\s\S]*to authenticated/);
});

test("preview covers the full eligible order set and includes wallet-aware balances", () => {
  const previewStart = migrationSource.indexOf(
    "create or replace function private.admin_preview_customer_settlement"
  );
  const settleStart = migrationSource.indexOf(
    "create or replace function private.admin_settle_customer_orders"
  );
  const previewSource = migrationSource.slice(previewStart, settleStart);

  assert.ok(previewStart >= 0);
  assert.ok(settleStart > previewStart);
  assert.match(previewSource, /o\.customer_id = p_customer_id/);
  assert.match(previewSource, /o\.soft_deleted_at is null/);
  assert.match(previewSource, /o\.status <> 'cancelled'/);
  assert.match(previewSource, /o\.payment_status <> 'paid'/);
  assert.match(
    previewSource,
    /wallet_applied_amount[\s\S]*payment_received_amount[\s\S]*due_amount/
  );
  assert.match(previewSource, /md5\([\s\S]*updated_at/);
  assert.doesNotMatch(previewSource, /limit\s+20/i);
});

test("settlement locks and revision-checks the complete set before an atomic update", () => {
  assert.match(migrationSource, /from public\.customers as c[\s\S]*for update/);
  assert.match(migrationSource, /locked_orders as materialized[\s\S]*for update/);
  assert.match(
    migrationSource,
    /v_current_revision is distinct from v_expected_revision[\s\S]*CUSTOMER_SETTLEMENT_STALE/
  );
  assert.match(
    migrationSource,
    /v_payment_method is null[\s\S]*v_payment_method not in \('bank_transfer', 'cash'\)/
  );
  assert.match(
    migrationSource,
    /payment_received_amount = greatest\([\s\S]*previous_received_amount[\s\S]*gross_amount - p\.wallet_applied_amount/
  );
  assert.match(migrationSource, /insert into public\.order_events/);
  assert.match(migrationSource, /'bulk_settlement_id', v_batch_id/);
  assert.match(migrationSource, /'previous_received_at', u\.previous_received_at/);
  assert.match(migrationSource, /'previous_received_by', u\.previous_received_by/);
  assert.match(migrationSource, /'previous_reference', u\.previous_reference/);
  assert.match(migrationSource, /'previous_note', u\.previous_note/);
  assert.match(
    migrationSource,
    /when p\.collected_amount > 0 then v_received_at[\s\S]*else p\.previous_received_at/
  );
  assert.match(migrationSource, /'orders', v_previous_orders/);
  assert.match(migrationSource, /'customer\.orders_bulk_settled'/);
  assert.match(migrationSource, /entity_type,[\s\S]*'customer'/);
});

test("API and server adapter fail closed on stale or malformed settlement results", () => {
  assert.match(routeSource, /export async function GET/);
  assert.match(routeSource, /export async function POST/);
  assert.match(routeSource, /expectedRevision: z\.string\(\)\.trim\(\)\.regex/);
  assert.match(repositorySource, /ADMIN_CUSTOMER_SETTLEMENT_STALE/);
  assert.match(repositorySource, /orderCount !== parsed\.data\.orders\.length/);
  assert.match(repositorySource, /customerSettlementPreviewSchema\.safeParse/);
  assert.match(repositorySource, /customerSettlementResultSchema\.safeParse/);
  assert.match(repositorySource, /postgresNonnegativeNumberSchema/);
  assert.doesNotMatch(repositorySource, /z\.coerce\.number/);
  assert.doesNotMatch(routeSource, /decodeURIComponent/);
});

test("customer panel exposes a second-confirmation flow with payment method and audit fields", () => {
  assert.match(panelSource, /function CustomerSettlementDialog/);
  assert.match(panelSource, /一次结清/);
  assert.match(panelSource, /二次确认/);
  assert.match(panelSource, /value="bank_transfer"/);
  assert.match(panelSource, /value="cash"/);
  assert.match(panelSource, /const preview = customerSettlement\?\.preview/);
  assert.match(panelSource, /expectedRevision: preview\.revision/);
  assert.match(panelSource, /type="datetime-local"/);
  assert.match(panelSource, /receivedAt: toDateTimeLocalInput\(new Date\(\)\.toISOString\(\)\)/);
  assert.match(panelSource, /receivedAt: new Date\(receivedAtTimestamp\)\.toISOString\(\)/);
  assert.match(panelSource, /loadDetail\(settlement\.account\.userId, \{ includes: \["orders"\] \}\)/);
});

test("REMAX data update rounds only active confirmed-batch sale prices upward to EUR 0.10", () => {
  assert.match(migrationSource, /upper\(btrim\(coalesce\(p\.brand, ''\)\)\) = 'REMAX'/);
  assert.match(migrationSource, /p\.status = 'active'/);
  assert.match(migrationSource, /p\.batch_code = 'REMAX-SONG-2026-07-A'/);
  assert.match(migrationSource, /round\(ceil\(p\.b2b_price \* 10\) \/ 10, 2\)/);
  assert.match(migrationSource, /round\(ceil\(p\.retail_price \* 10\) \/ 10, 2\)/);
  assert.match(migrationSource, /product\.remax_active_prices_rounded_up/);
  assert.match(
    migrationSource,
    /lock table public\.products in share mode;[\s\S]*perform p\.id[\s\S]*order by p\.id[\s\S]*for update;[\s\S]*with target_prices as materialized/
  );

  const priceUpdateStart = migrationSource.indexOf("with target_prices as materialized");
  const priceUpdateSource = migrationSource.slice(priceUpdateStart);

  assert.ok(priceUpdateStart >= 0);
  assert.doesNotMatch(priceUpdateSource, /cost_price\s*=/);
  assert.doesNotMatch(priceUpdateSource, /status\s*=\s*'draft'/);
});
