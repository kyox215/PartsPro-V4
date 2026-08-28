import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  normalizeCustomerOrderNumber,
  toCustomerRmaPrivacySafeFields,
} from "../src/lib/partspro-rma-customer-order.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const contract = read("src/lib/partspro-rma-contract.ts");
const http = read("src/lib/partspro-rma-http.ts");
const helper = read("src/lib/partspro-rma-simple-flow.ts");
const evidence = read("src/lib/partspro-rma-evidence.ts");
const customerRoute = read("src/app/api/rma/route.ts");
const customerDto = read("src/lib/partspro-rma-customer-dto.ts");
const rules = read("src/lib/partspro-rma-rules.mjs");
const legacyEvidenceRoute = read("src/app/api/rma/evidence/route.ts");
const completeRoute = read("src/app/api/rma/drafts/[draftId]/attachments/[attachmentId]/complete/route.ts");
const migration = read("supabase/migrations/20260827210026_rma_simple_flow_expand.sql");
const finalizeMigration = read("supabase/migrations/20260828024331_rma_workflow_finalize.sql");
const repository = read("src/lib/partspro-repository.ts");
const readiness = read("src/lib/partspro-rma-workflow-readiness.ts");

test("customer contract freezes six reasons, three resolutions and strict payload allowlists", () => {
  for (const reason of [
    "quality_defect",
    "shipping_damage",
    "not_as_described",
    "wrong_item",
    "missing_or_quantity_error",
    "withdrawal_no_longer_needed",
  ]) {
    assert.match(contract, new RegExp(`\\"${reason}\\"`));
  }

  for (const resolution of ["replacement", "refund", "wallet_credit"]) {
    assert.match(contract, new RegExp(`\\"${resolution}\\"`));
  }

  const submitSchema = contract.slice(
    contract.indexOf("export const rmaCustomerSubmitSchema"),
    contract.indexOf("export type RmaCustomerSubmitInput")
  );
  assert.match(submitSchema, /orderLineId/);
  assert.match(submitSchema, /quantity/);
  assert.match(submitSchema, /reasonCode/);
  assert.match(submitSchema, /requestedResolution/);
  assert.match(submitSchema, /attachmentIds/);
  assert.match(submitSchema, /idempotencyKey/);
  assert.match(submitSchema, /draftId/);
  assert.match(submitSchema, /draftId: uuid,/);
  assert.match(submitSchema, /\.strict\(\)/);
  for (const forbidden of ["orderId", "sku", "bucket", "signedUrl", "storagePath"]) {
    assert.doesNotMatch(submitSchema, new RegExp(`\\b${forbidden}\\s*:`));
  }

  assert.match(contract, /rmaMaxAttachments = 6/);
  assert.match(contract, /rmaMaxAttachmentBytes = 4 \* 1024 \* 1024/);
  assert.match(contract, /reasonRequiresImage/);
  assert.match(contract, /withdrawal_no_longer_needed/);
  assert.match(contract, /statutory_b2c_withdrawal/);
  assert.match(contract, /rmaCanonicalPolicyScope = "b2b_commercial"/);
  assert.match(contract, /rmaCanonicalPolicyVersion = "partspro-b2b-v1"/);
});

test("server upload/complete/submit path is opaque and legacy writes require upgrade", () => {
  assert.match(helper, /createSignedUploadUrl\(storagePath/);
  assert.match(helper, /uploadUrl: signed\.signedUrl/);
  assert.doesNotMatch(helper, /return \{[^}]*storagePath/);
  assert.match(helper, /download\(storagePath\)/);
  assert.match(helper, /detectImageContentType/);
  assert.match(helper, /createHash\("sha256"\)/);
  assert.match(helper, /rma_complete_attachment/);
  assert.match(helper, /verification_token/);
  assert.doesNotMatch(helper, /verificationToken,\s*uploadUrl/);
  assert.match(helper, /RMA_DRAFT_REQUIRED/);
  assert.match(helper, /p_reason_code: input\.reasonCode \?\? null/);
  assert.match(http, /handleLegacyRmaSubmit/);
  assert.match(http, /RMA_CLIENT_UPGRADE_REQUIRED/);
  assert.match(http, /410/);
  assert.doesNotMatch(http, /normalizeLegacyRmaAttachments|attachments\.length < 1|RMA_EVIDENCE_REQUIRED/);
  assert.match(http, /Cache-Control/);
  assert.match(customerRoute, /handleRmaSubmit/);
  assert.match(customerDto, /customerStageForRmaStatus/);
  assert.doesNotMatch(customerRoute, /data:\s*customerRequests[\s\S]*internalNote/);
  assert.match(legacyEvidenceRoute, /RMA_CLIENT_UPGRADE_REQUIRED/);
  assert.match(legacyEvidenceRoute, /410/);
  assert.doesNotMatch(legacyEvidenceRoute, /maxEvidenceBytes|video\/mp4|createSignedUrl|\.storage/);
  assert.match(evidence, /isRmaEvidencePathOwnedByUser/);
  assert.match(evidence, /stripSignedUrl/);
  assert.match(evidence, /!attachmentOwnerUserId/);
  assert.match(evidence, /storage_path/);
  assert.match(completeRoute, /export async function DELETE/);
  assert.match(completeRoute, /cancelRmaAttachment/);
  assert.match(customerDto, /assignees, notes, wallet ids, inventory fields and storage paths never cross/);
  assert.doesNotMatch(customerDto, /internalNote|assignedTo|walletRefundRequestId|inventoryDisposition|storagePath/);
  assert.doesNotMatch(customerRoute, /rma\/\$\{request\.id\}/);
});

test("Migration A owns isolated draft/attachment/action tables and fixed storage path", () => {
  for (const table of ["rma_drafts", "rma_attachments", "rma_action_executions"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
  }

  assert.match(migration, /storage_path text not null unique/);
  assert.match(migration, /storage_path ~ '\^rma\//);
  assert.doesNotMatch(migration, /update storage\.buckets/);
  assert.match(migration, /20 MiB image\/video/);
  assert.match(migration, /'image\/heif'/);
  assert.doesNotMatch(migration, /'video\/mp4'/);
  assert.doesNotMatch(migration, /'video\/quicktime'/);
  assert.match(migration, /status = 'verified'/);
  assert.match(migration, /verification_token uuid not null/);
  assert.match(migration, /p_verification_token uuid/);
  assert.match(migration, /p_attachment_ids uuid\[\] default '\{\}'/);
  assert.match(migration, /rma_cancel_attachment/);
  assert.match(migration, /status in \('pending', 'verified', 'committed', 'rejected', 'expired', 'cancelled'\)/);
  assert.match(migration, /when \(new\.request_type <> 'rma_return'\)/);
  assert.match(migration, /RMA draft is no longer open/);
  assert.match(migration, /rma_gc_expired_attachments/);
  assert.match(migration, /grant execute on function public\.rma_gc_expired_attachments\(integer\)\s+to service_role/);
  assert.match(migration, /status in \('pending', 'verified', 'committed'\)\s+and a\.expires_at > now\(\)/);
  assert.match(migration, /d\.status in \('open', 'submitted', 'abandoned', 'expired'\)/);
  assert.match(migration, /a\.rma_request_id is null/);
  assert.match(migration, /rma_order_line_returnable_quantity/);
  assert.match(migration, /fulfilled_qty/);
  assert.match(migration, /fulfilled_qty = 0/);
  assert.match(migration, /rma_requests_inventory_disposition_quantity_check/);
});

test("RMA RPCs bind auth/ownership, preserve policy uncertainty and use explicit grants", () => {
  for (const fn of [
    "rma_create_draft",
    "rma_prepare_attachment_upload",
    "rma_complete_attachment",
    "rma_submit_request",
    "admin_perform_rma_action_v3",
  ]) {
    const start = migration.indexOf(`function public.${fn}`);
    assert.notEqual(start, -1, `${fn} must exist`);
    const body = migration.slice(start, migration.indexOf("$$;", start));
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = pg_catalog, public, private, pg_temp/);
    assert.match(body, /v_auth_uid uuid := \(select auth\.uid\(\)\)/);
  }

  assert.match(migration, /policy_scope text not null default 'legacy_unverified'/);
  assert.match(migration, /eligible_until timestamptz/);
  assert.match(migration, /'legacy_unverified'/);
  assert.doesNotMatch(migration, /rmaDays|rma_days/);
  assert.match(migration, /grant execute on function public\.rma_submit_request/);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /revoke all on function public\.rma_submit_request[\s\S]*from public, anon/);
  assert.match(migration, /customer_memberships as cm/);
  assert.match(migration, /v_order\.status not in \('shipped', 'completed', 'delivered'\)/);
  assert.match(migration, /v_customer\.status <> 'active'/);
  assert.match(migration, /private\.rma_user_can_access_order/);
  assert.match(migration, /c\.profile_kind = 'employee_self'/);
  assert.match(migration, /c\.user_id = p_auth_uid/);
  assert.match(migration, /c\.id = v_profile_customer_id/);
  assert.match(migration, /cm\.status = 'active'/);
  assert.match(migration, /v_account_type = 'customer'/);
  assert.doesNotMatch(migration, /v_order\.user_id = v_auth_uid/);
  assert.match(migration, /'b2b_commercial',\s+'partspro-b2b-v1'/);
  assert.match(migration, /rma-submit-user:%s:%s/);
  assert.match(migration, /submit_payload_fingerprint/);
  assert.match(migration, /RMA has no immutable unit-price snapshot/);
  assert.match(migration, /v_order_line_returnable_quantity := private\.rma_order_line_returnable_quantity/);
  assert.match(migration, /create or replace function private\.enforce_rma_order_line\(\)/);
  assert.match(migration, /drop policy if exists "partspro_rma_self_submit"/);
  assert.match(contract, /orderLineEligibleQuantity/);
  for (const field of [
    "quantity\\?: number \\| null",
    "receivedQuantity\\?: number \\| null",
    "resolutionQuantity\\?: number \\| null",
    "inventoryDispositionQuantity\\?: number \\| null",
  ]) {
    assert.match(contract, new RegExp(field));
  }
});

test("statutory withdrawal and pure safety helpers remain separate from defect evidence", () => {
  assert.match(rules, /policyScope === statutoryWithdrawalScope/);
  assert.match(rules, /reasonCode === "withdrawal_no_longer_needed"/);
  assert.match(contract, /export function isRmaActionAvailable/);
  assert.match(contract, /export function calculateRmaLineRefundCap/);
  assert.match(contract, /export function isCommercialOutcomeAvailable/);
  assert.match(migration, /reason is required unless the draft is a statutory B2C withdrawal/);
  assert.match(migration, /v_policy_scope = 'statutory_b2c_withdrawal'/);
  assert.match(migration, /unit_price_snapshot/);
  assert.match(rules, /only scope where a reason and evidence may both be/);
  assert.match(migration, /v_policy_scope = 'statutory_b2c_withdrawal'/);
  assert.match(migration, /and \(v_reason is null or v_reason = 'withdrawal_no_longer_needed'\)/);
  assert.match(migration, /if v_attachment_count < 1/);
});

test("V1 processing is whole-RMA and idempotency conflicts remain typed", () => {
  const triggerStart = migration.indexOf("create or replace function private.enforce_rma_order_line()");
  assert.notEqual(triggerStart, -1);
  const trigger = migration.slice(triggerStart, migration.indexOf("$$;", triggerStart));
  assert.match(trigger, /if tg_op = 'UPDATE' then/);
  assert.match(trigger, /v_current_rma_id uuid/);
  assert.match(trigger, /from public\.rma_requests as r/);
  assert.match(trigger, /r\.order_line_id = new\.order_line_id/);
  assert.match(trigger, /r\.status <> 'rejected'/);
  assert.match(trigger, /r\.id is distinct from v_current_rma_id/);
  assert.match(trigger, /r\.id is distinct from new\.id/);
  assert.match(trigger, /coalesce\(new\.status, 'submitted'\) <> 'rejected'/);
  assert.match(trigger, /coalesce\(v_existing_requested_quantity, 0\) \+ new\.quantity > v_returnable_quantity/);
  assert.match(trigger, /where ol\.id = new\.order_line_id[\s\S]*for update/);
  assert.match(migration, /RMA V1 actions must process the complete RMA quantity/);
  assert.match(migration, /p_quantity is not null and p_quantity <> v_before\.quantity/);
  assert.match(migration, /received_quantity is distinct from v_before\.quantity/);
  assert.match(migration, /inventory_disposition_quantity = v_before\.quantity/);
  assert.match(migration, /v_before\.refund_approved_quantity = v_before\.quantity/);
  assert.match(migration, /v_before\.replacement_quantity = v_before\.quantity/);
  assert.match(helper, /rawCode === "P0001"/);
  assert.match(helper, /RMA attachment ticket compensation could not cancel/);
  assert.match(helper, /const \{ error \} = await client\.rpc\("rma_cancel_attachment"/);
});

test("customer RMA DTO order aliases reject internal UUIDs at runtime", () => {
  assert.equal(
    normalizeCustomerOrderNumber("11111111-1111-4111-8111-111111111111"),
    null
  );
  assert.equal(
    normalizeCustomerOrderNumber("11111111-1111-7111-8111-111111111111"),
    null,
    "newer UUID versions must not cross the customer order-number boundary"
  );
  assert.equal(
    normalizeCustomerOrderNumber("00000000-0000-0000-0000-000000000000"),
    null,
    "nil UUIDs are still internal identifiers"
  );
  assert.equal(normalizeCustomerOrderNumber("ORD-2026-0007"), "ORD-2026-0007");
  assert.equal(normalizeCustomerOrderNumber("  ORD-2026-0008  "), "ORD-2026-0008");
  assert.equal(normalizeCustomerOrderNumber(null), null);
  assert.match(customerDto, /orderId: privacySafeFields\.orderId/);
  assert.match(customerDto, /orderNumber: privacySafeFields\.orderNumber/);
  const safe = toCustomerRmaPrivacySafeFields({
    orderId: "11111111-1111-4111-8111-111111111111",
    orderNumber: " ORD-2026-0008 ",
    requestedResolution: "refund",
    resolution: "INTERNAL SUMMARY MUST NOT CROSS",
    customerVisibleNote: "Public note",
    labResult: "SECRET LAB RESULT",
    resolutionNote: "SECRET INTERNAL NOTE",
    refundAmount: 999,
    orderLineId: "22222222-2222-4222-8222-222222222222",
  });
  assert.deepEqual(safe.orderId, "ORD-2026-0008");
  assert.deepEqual(safe.orderNumber, "ORD-2026-0008");
  assert.deepEqual(safe.requestedResolution, "refund");
  assert.deepEqual(safe.customerVisibleNote, "Public note");
  for (const forbidden of ["labResult", "resolutionNote", "refundAmount", "orderLineId"]) {
    assert.equal(Object.hasOwn(safe, forbidden), false, `${forbidden} must stay internal`);
  }
  assert.equal(Object.values(safe).includes("11111111-1111-4111-8111-111111111111"), false);
});

test("customer DTO does not derive requested resolution from internal summaries", () => {
  const safe = toCustomerRmaPrivacySafeFields({
    orderId: "ORD-2026-0009",
    resolution: "SECRET INTERNAL STATUS",
    resolutionNote: "SECRET",
    labResult: "SECRET",
    refundAmount: 42,
  });

  assert.equal(safe.orderId, "ORD-2026-0009");
  assert.equal(safe.requestedResolution, "");
  assert.equal(Object.hasOwn(safe, "resolution"), false);
});

test("Migration B closes direct RMA table reads and exposes only a readiness probe", () => {
  assert.match(
    finalizeMigration,
    /revoke select, insert, update on public\.rma_requests from public, anon, authenticated/
  );
  assert.match(
    finalizeMigration,
    /revoke select, insert on public\.rma_request_events from public, anon, authenticated/
  );
  assert.match(finalizeMigration, /drop policy if exists "partspro_rma_self_or_staff_read"/);
  assert.match(finalizeMigration, /drop policy if exists "partspro_rma_events_read"/);
  assert.doesNotMatch(finalizeMigration, /grant select on public\.rma_requests to authenticated/);
  assert.doesNotMatch(finalizeMigration, /grant select on public\.rma_request_events to authenticated/);
  assert.match(finalizeMigration, /grant select on public\.rma_requests to service_role/);
  assert.match(finalizeMigration, /grant select on public\.rma_request_events to service_role/);
  assert.match(finalizeMigration, /create or replace function public\.rma_workflow_capabilities\(\)/);
  assert.match(finalizeMigration, /'rma-workflow-b1'/);
  assert.match(readiness, /RMA_WORKFLOW_NOT_READY/);
  assert.match(repository, /assertRmaWorkflowReady\(context\.client\)/);
});

test("Migration B customer shipped RPC and refund preview stay narrow and parity-guarded", () => {
  const shippedStart = finalizeMigration.indexOf("create function public.rma_mark_customer_shipped");
  const shippedBody = finalizeMigration.slice(shippedStart, finalizeMigration.indexOf("$$;", shippedStart));
  assert.notEqual(shippedStart, -1);
  assert.match(shippedBody, /returns table\(/);
  assert.doesNotMatch(shippedBody, /returns public\.rma_requests/);
  assert.match(shippedBody, /request_id uuid/);
  assert.match(shippedBody, /return query select/);

  const previewStart = finalizeMigration.indexOf("create or replace function public.admin_rma_refund_preview");
  const previewBody = finalizeMigration.slice(previewStart, finalizeMigration.indexOf("$$;", previewStart));
  assert.match(previewBody, /requested_resolution not in \('refund', 'wallet_credit', 'credit_note'\)/);
  assert.match(previewBody, /received_at is null/);
  assert.match(previewBody, /received_quantity is distinct from v_rma\.quantity/);
  assert.match(previewBody, /wr\.status <> 'rejected'/);
  assert.match(previewBody, /linked\.status = 'rejected'/);
  assert.match(previewBody, /coalesce\(r\.refund_net_amount, r\.refund_amount, 0\) > 0/);
  assert.match(previewBody, /v_rma\.qc_status not in \('passed', 'failed', 'not_required'\)/);
  assert.match(previewBody, /v_rma\.replacement_order_id is not null/);

  const candidateStart = finalizeMigration.indexOf("create or replace function public.admin_rma_replacement_candidates");
  const candidateBody = finalizeMigration.slice(candidateStart, finalizeMigration.indexOf("$$;", candidateStart));
  assert.match(candidateBody, /other_rma\.replacement_order_id = o\.id/);
  assert.doesNotMatch(candidateBody, /other_rma\.status <> 'rejected'/);
});
