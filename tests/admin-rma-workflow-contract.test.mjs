import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const migration = read("supabase/migrations/20260827210026_rma_simple_flow_expand.sql");
const adminRoute = read("src/app/api/admin/rma/[requestId]/actions/route.ts");
const adminAuth = read("src/lib/partspro-admin-auth.ts");
const adminDto = read("src/lib/partspro-rma-admin-dto.ts");
const repository = read("src/lib/partspro-repository.ts");

test("admin v3 freezes fine-grained permissions and legacy delegation", () => {
  assert.match(migration, /create or replace function public\.admin_perform_rma_action_v3/);
  assert.match(migration, /create or replace function public\.admin_perform_rma_action\(/);
  assert.match(migration, /from public\.admin_perform_rma_action_v3\(/);
  assert.match(migration, /partspro_has_permission\('rma\.manage'\)/);
  assert.match(migration, /partspro_has_permission\('rma\.refund'\)/);
  assert.match(migration, /partspro_has_permission\('rma\.inventory'\)/);
  assert.match(migration, /v_action = 'restock_return'[\s\S]*?partspro_has_permission\('product\.adjust_stock'\)/);
  assert.match(migration, /v_action = 'record_qc'/);
  assert.match(migration, /partspro_has_permission\('orders\.manage'\)/);
  assert.match(migration, /revoke all on function public\.admin_perform_rma_action_v3/);
  assert.match(migration, /grant execute on function public\.admin_perform_rma_action_v3/);
  assert.match(migration, /create or replace function public\.admin_perform_rma_action\([\s\S]*?v_auth_uid uuid := \(select auth\.uid\(\)\)/);
  assert.match(adminRoute, /adminRmaActionSchema/);
  assert.match(adminRoute, /action === "restock_return"[\s\S]*?product\.adjust_stock/);
  assert.match(adminRoute, /hasExactAdminPermission\(admin\.authState, "product\.adjust_stock"\)/);
  assert.match(adminDto, /hasExactAdminPermission\(authState, "product\.adjust_stock"\)/);
  assert.doesNotMatch(adminDto, /adjustStock:\s*hasAdminPermission/);
  assert.match(
    adminAuth,
    /export function hasExactAdminPermission[\s\S]*authState\.permissions\.includes\(permission\)/
  );
  assert.match(adminRoute, /workflow: "admin_perform_rma_action_v3"/);
  assert.match(repository, /rpc\("admin_perform_rma_action_v3"/);
  assert.match(repository, /p_location: input\.warehouse \?\? null/);
});

test("action ledger and terminal disposition guard make restock idempotent", () => {
  assert.match(migration, /constraint rma_action_executions_unique_key unique \(rma_request_id, action, idempotency_key\)/);
  assert.match(migration, /payload_fingerprint/);
  assert.match(migration, /rma_action_executions_terminal_disposition_unique/);
  assert.match(migration, /where execution_status = 'succeeded'[\s\S]*action in \('restock_return', 'mark_scrapped', 'supplier_return'\)/);
  assert.match(migration, /from public\.rma_requests as r\n  where r\.id = p_request_id\n  for update/);
  assert.match(migration, /RMA inventory disposition has already been completed/);
  assert.match(migration, /execution_status = 'succeeded'/);
  assert.match(migration, /execution_status = 'started'/);
  assert.match(migration, /p_idempotency_key text default null/);
  assert.match(migration, /different payload/);
  assert.match(migration, /drop index if exists public\.rma_action_executions_commercial_outcome_unique/);
  assert.match(migration, /rma_action_executions_replacement_outcome_unique/);
  assert.doesNotMatch(migration, /create unique index if not exists rma_action_executions_commercial_outcome_unique/);
  assert.match(migration, /rma_action_executions_qc_unique/);
  assert.match(migration, /rma-action:%s:%s:%s:%s/);
  assert.match(repository, /idempotencyKey/);
  assert.match(repository, /rawCode === "P0001"/);
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
  assert.match(migration, /resolution_action = v_resolution_action/);
  assert.match(migration, /v_resolution_action := v_before\.resolution_action/);
  assert.doesNotMatch(migration, /v_resolution_action := case when v_action = 'mark_scrapped' then 'scrap' else 'supplier_return' end/);
  assert.match(migration, /v_inventory_disposition := case when v_action = 'mark_scrapped' then 'scrap' else 'supplier_return' end/);
  assert.match(migration, /Restock requires an explicit batch code and location/);
  assert.match(migration, /Inventory disposition requires an explicit batch code and location/);
  assert.match(migration, /v_next_status := v_before\.status/);
  assert.match(migration, /rma_requests_inventory_disposition_quantity/);
  assert.match(migration, /RMA V1 actions must process the complete RMA quantity/);
  assert.match(migration, /complete RMA quantity to be received/);
  assert.match(migration, /inventory_disposition_quantity = v_before\.quantity/);
});

test("wallet, replacement and state guards are explicit", () => {
  assert.match(migration, /request_type,\s+requested_amount/);
  assert.match(migration, /'rma_return'/);
  assert.match(migration, /tax_and_shipping_included', false/);
  assert.match(migration, /Refund amount must be explicitly confirmed/);
  assert.match(migration, /v_refund_amount > v_refundable_amount/);
  assert.match(migration, /p_replacement_order_id is null/);
  assert.match(migration, /v_replacement_order\.status <> 'shipped'/);
  assert.match(migration, /v_next_status := 'replacement_sent'/);
  assert.match(migration, /v_before\.status not in \('received', 'refunded', 'replacement_sent', 'replaced'\)/);
  assert.match(migration, /Received RMAs must have both a terminal commercial outcome/);
  assert.match(migration, /v_before\.received_at is not null/);
  assert.match(migration, /v_before\.status = 'refunded'[\s\S]*?v_before\.resolution_action = 'refund_wallet'/);
  assert.match(migration, /v_before\.status in \('replacement_sent', 'replaced'\)[\s\S]*?v_before\.resolution_action = 'replacement'/);
  assert.match(migration, /wr\.status = 'approved'/);
  assert.match(migration, /v_before\.replacement_order_id is null/);
  assert.match(migration, /v_before\.replacement_order_id is not null/);
  assert.match(migration, /v_before\.wallet_refund_request_id is null/);
  assert.match(migration, /wr\.request_type = 'rma_return'/);
  assert.match(migration, /Approved wallet refund exceeds the remaining order-line cap/);
  assert.match(migration, /rma_wallet_refund_approval_sync/);
  assert.match(migration, /Replacement order does not contain enough of the returned SKU/);
  assert.match(migration, /ol\.quantity - coalesce\(ol\.cancelled_qty, 0\)/);
  assert.match(migration, /v_replacement_order\.id = v_order\.id/);
  assert.match(migration, /Only approved RMAs can be received/);
  assert.match(migration, /Wallet approval is not available for this RMA commercial outcome/);
  assert.match(migration, /RMA already has a replacement outcome/);
  assert.match(migration, /RMA already has a wallet refund outcome/);
  assert.match(migration, /rma_order_line_returnable_quantity/);
  assert.match(migration, /order-line returnable quantity/);
  assert.match(migration, /rma-refund-line:%s/);
  assert.match(migration, /v_order_refundable_amount/);
  assert.match(migration, /v_rma\.received_quantity is distinct from v_rma\.quantity/);
  assert.match(migration, /Closed or rejected RMAs cannot be assigned/);
  assert.match(migration, /Refund requires the complete RMA quantity to be received/);
  assert.match(migration, /Replacement requires the complete RMA quantity to be received/);
  assert.match(migration, /RMA assignment is limited to the authenticated staff member/);
  assert.match(migration, /RMA is already assigned; reassign requires a separate explicit action/);
  assert.match(migration, /RMA QC has already been recorded/);
  assert.match(migration, /v_before\.status not in \('received', 'refunded', 'replacement_sent', 'replaced'\)/);
  assert.match(migration, /v_action = 'close' and v_before\.status = 'closed'/);
  assert.match(migration, /no_op/);
  assert.match(migration, /v_before\.status = 'rejected'[\s\S]*coalesce\(v_before\.received_quantity, 0\) = 0/);
  assert.match(migration, /action_payload_fingerprint/);
  assert.doesNotMatch(migration, /on conflict \(idempotency_key\) do update/);
  assert.match(migration, /v_refund_request\.status <> 'rejected'/);
  assert.match(
    migration,
    /v_before\.resolution_action is not null[\s\S]*v_before\.resolution_action <> 'refund_wallet'/
  );
  assert.match(migration, /Only pending RMA attachments can be cancelled/);
  assert.match(migration, /refund_quantity/);
  assert.match(migration, /replacement_quantity/);
  assert.match(migration, /rma\?requestId=%s/);
  assert.doesNotMatch(migration, /format\('\/rma\/%s'/);
});

test("admin DTO remains allowlisted and supports supplier/replacement actions", () => {
  const contract = read("src/lib/partspro-rma-contract.ts");
  const data = read("src/lib/partspro-data.ts");
  const customerDto = read("src/lib/partspro-rma-customer-dto.ts");
  const adminSchema = contract.slice(
    contract.indexOf("export const adminRmaActionSchema"),
    contract.indexOf("export type AdminRmaActionInput")
  );
  for (const action of [
    "assign",
    "request_wallet_refund",
    "mark_received",
    "record_qc",
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
  assert.match(migration, /Legacy review refund amount ignored/);
  assert.match(migration, /review_refund_amount_ignored/);
  for (const field of [
    "receivedQuantity",
    "resolutionQuantity",
    "inventoryDispositionQuantity",
  ]) {
    assert.match(data, new RegExp(`${field}\\?: number \\| null`));
    assert.match(repository, new RegExp(`${field}`));
  }
  assert.match(data, /qcStatus\?: "pending" \| "passed" \| "failed" \| "not_required" \| null/);
  assert.match(data, /replacementOrderId\?: string \| null/);
  assert.match(data, /walletRefundStatus\?: RmaWalletRefundStatus \| null/);
  assert.match(repository, /qcStatus: normalizeRmaQcStatus/);
  assert.match(repository, /replacementOrderId: pickString/);
  assert.match(repository, /walletRefundStatus/);
  assert.match(repository, /readRmaWalletRefundStatusesByRequestId/);
  assert.match(repository, /from\("wallet_refund_requests"\)/);
  assert.match(repository, /select\("rma_request_id, status, requested_at"\)/);
  assert.match(repository, /refund_approved_quantity/);
  assert.match(repository, /replacement_quantity/);
  assert.doesNotMatch(customerDto, /receivedQuantity|resolutionQuantity|inventoryDispositionQuantity/);
  assert.doesNotMatch(customerDto, /qcStatus|replacementOrderId|walletRefundStatus/);
});

test("historical RMA trigger and INSERT policies use the shared owner and net quantity guards", () => {
  assert.match(migration, /create or replace function private\.enforce_rma_order_line\(\)/);
  assert.match(migration, /private\.rma_user_can_access_order\(v_auth_uid, v_order_customer_id, v_order_id\)/);
  assert.match(migration, /v_returnable_quantity := private\.rma_order_line_returnable_quantity\(new\.order_line_id\)/);
  assert.match(migration, /drop policy if exists "partspro_rma_self_submit"/);
  assert.match(migration, /drop policy if exists "partspro_rma_insert_order_line_guard"/);
  assert.match(migration, /cm\.status = 'active'/);
  assert.match(migration, /c\.profile_kind = 'employee_self'/);
  assert.match(migration, /p\.account_type = 'employee'/);
  assert.match(migration, /p\.customer_id = c\.id/);
  assert.doesNotMatch(migration, /v_order_user_id = v_auth_uid/);
});

test("service reads and readiness fail closed after Migration B revokes browser table SELECT", () => {
  const finalizeMigration = read("supabase/migrations/20260828024331_rma_workflow_finalize.sql");
  assert.match(finalizeMigration, /revoke select, insert, update on public\.rma_requests from public, anon, authenticated/);
  assert.match(finalizeMigration, /revoke select, insert on public\.rma_request_events from public, anon, authenticated/);
  assert.match(repository, /requireRmaServiceClient\(\)/);
  assert.match(repository, /from\("rma_requests"\)/);
  assert.match(repository, /"rma_request_events"/);
  assert.match(repository, /assertRmaWorkflowReady\(context\.client\)/);
  assert.match(repository, /readStrictRmaCustomerId/);
  assert.match(repository, /customer_memberships/);
  assert.match(repository, /\.eq\("status", "active"\)/);
  assert.match(repository, /RMA_WORKFLOW_NOT_READY/);
});
