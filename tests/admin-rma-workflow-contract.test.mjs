import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const migration = read("supabase/migrations/20260827210026_rma_simple_flow_expand.sql");
const adminRoute = read("src/app/api/admin/rma/[requestId]/actions/route.ts");
const repository = read("src/lib/partspro-repository.ts");

test("admin v3 freezes fine-grained permissions and legacy delegation", () => {
  assert.match(migration, /create or replace function public\.admin_perform_rma_action_v3/);
  assert.match(migration, /create or replace function public\.admin_perform_rma_action\(/);
  assert.match(migration, /from public\.admin_perform_rma_action_v3\(/);
  assert.match(migration, /partspro_has_permission\('rma\.manage'\)/);
  assert.match(migration, /partspro_has_permission\('rma\.refund'\)/);
  assert.match(migration, /partspro_has_permission\('rma\.inventory'\)/);
  assert.match(migration, /v_action in \('mark_received', 'restock_return', 'mark_scrapped', 'supplier_return'\)/);
  assert.match(migration, /partspro_has_permission\('orders\.manage'\)/);
  assert.match(migration, /revoke all on function public\.admin_perform_rma_action_v3/);
  assert.match(migration, /grant execute on function public\.admin_perform_rma_action_v3/);
  assert.match(migration, /create or replace function public\.admin_perform_rma_action\([\s\S]*?v_auth_uid uuid := \(select auth\.uid\(\)\)/);
  assert.match(adminRoute, /adminRmaActionSchema/);
  assert.match(adminRoute, /workflow: "admin_perform_rma_action_v3"/);
  assert.match(repository, /rpc\("admin_perform_rma_action_v3"/);
});

test("action ledger and terminal disposition guard make restock idempotent", () => {
  assert.match(migration, /constraint rma_action_executions_unique_key unique \(rma_request_id, action, idempotency_key\)/);
  assert.match(migration, /rma_action_executions_terminal_disposition_unique/);
  assert.match(migration, /where execution_status = 'succeeded'[\s\S]*action in \('restock_return', 'mark_scrapped', 'supplier_return'\)/);
  assert.match(migration, /from public\.rma_requests as r\n  where r\.id = p_request_id\n  for update/);
  assert.match(migration, /RMA inventory disposition has already been completed/);
  assert.match(migration, /execution_status = 'succeeded'/);
  assert.match(migration, /execution_status = 'started'/);
  assert.match(migration, /p_idempotency_key text default null/);
  assert.match(repository, /idempotencyKey/);
});

test("receive/restock/disposition preserve quarantine and available-stock invariants", () => {
  assert.match(migration, /'rma_quarantine'/);
  assert.match(migration, /'rma_restock'/);
  assert.match(migration, /'rma_disposition'/);
  assert.match(migration, /'available_qty_delta', 0/);
  assert.match(migration, /'available_qty_delta', v_stock_quantity/);
  assert.match(migration, /private\.admin_adjust_product_stock\(/);
  assert.match(migration, /v_action in \('mark_scrapped', 'supplier_return'\)/);
  assert.match(migration, /v_inventory_disposition <> 'quarantine'/);
  assert.match(migration, /restock_return', 'mark_scrapped', 'supplier_return'/);
  assert.match(migration, /v_resolution_action := case when v_action = 'mark_scrapped' then 'scrap' else 'supplier_return' end/);
});

test("wallet, replacement and state guards are explicit", () => {
  assert.match(migration, /request_type,\n      requested_amount/);
  assert.match(migration, /'rma_return'/);
  assert.match(migration, /tax_and_shipping_included', false/);
  assert.match(migration, /Refund amount must be explicitly confirmed/);
  assert.match(migration, /v_refund_amount > v_refundable_amount/);
  assert.match(migration, /p_replacement_order_id is null/);
  assert.match(migration, /v_replacement_order\.status <> 'shipped'/);
  assert.match(migration, /v_next_status := 'replacement_sent'/);
  assert.match(migration, /v_before\.status not in \('approved', 'received'\)/);
  assert.match(migration, /Received RMA requires a completed inventory disposition/);
});

test("admin DTO remains allowlisted and supports supplier/replacement actions", () => {
  const contract = read("src/lib/partspro-rma-contract.ts");
  const adminSchema = contract.slice(
    contract.indexOf("export const adminRmaActionSchema"),
    contract.indexOf("export type AdminRmaActionInput")
  );
  for (const action of [
    "assign",
    "request_wallet_refund",
    "mark_received",
    "restock_return",
    "mark_scrapped",
    "supplier_return",
    "mark_replacement_sent",
    "close",
  ]) {
    assert.match(adminSchema, new RegExp(`\\"${action}\\"`));
  }
  assert.match(adminSchema, /idempotencyKey/);
  assert.match(adminSchema, /replacementOrderId/);
  assert.match(adminSchema, /\.strict\(\)/);
  assert.match(adminRoute, /requiredPermissionForAction/);
  assert.match(adminRoute, /rma\.inventory/);
});
