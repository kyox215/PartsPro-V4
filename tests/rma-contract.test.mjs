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
const adminRmaRoute = read("src/app/api/admin/rma/route.ts");
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

test("customer-visible RMA events never fall back to internal review text", () => {
  const reviewStart = migration.indexOf("create or replace function public.admin_update_rma_request");
  const reviewBody = migration.slice(reviewStart, migration.indexOf("$$;", reviewStart));
  const v3Start = migration.indexOf("create or replace function public.admin_perform_rma_action_v3");
  const v3Body = migration.slice(v3Start, migration.indexOf("$$;", v3Start));
  const v3EventStart = v3Body.indexOf("insert into public.rma_request_events");
  const v3EventBody = v3Body.slice(v3EventStart);
  const reviewVisibleBranchStart = reviewBody.indexOf("if v_customer_visible then");
  const reviewVisibleBranch = reviewBody.slice(
    reviewVisibleBranchStart,
    reviewBody.indexOf("else", reviewVisibleBranchStart)
  );

  assert.match(
    reviewBody,
    /v_customer_visible := v_before\.status is distinct from v_next_status[\s\S]*p_customer_visible_note/
  );
  assert.doesNotMatch(
    reviewBody,
    /v_customer_visible := v_before\.status is distinct from v_next_status[\s\S]{0,160}p_lab_result/
  );
  assert.match(reviewBody, /v_event_note := nullif\(btrim\(coalesce\(p_customer_visible_note, ''\)\), ''\)/);
  assert.match(reviewBody, /v_event_note := coalesce\(v_event_note, 'RMA review status updated\.'/);
  assert.doesNotMatch(reviewVisibleBranch, /p_resolution_note|p_lab_result|p_internal_note/);

  assert.match(v3Body, /v_event_note text := nullif\(btrim\(p_customer_visible_note\), ''\)/);
  assert.doesNotMatch(
    v3Body,
    /v_event_note text := nullif\(btrim\(coalesce\(p_customer_visible_note, p_reason, p_internal_note/
  );
  for (const systemCopy of [
    "Returned item received into quarantine",
    "Wallet refund request created",
    "Replacement order shipped",
    "RMA closed",
  ]) {
    assert.match(v3Body, new RegExp(`v_event_note := coalesce\\(v_event_note, '${systemCopy}'\\)`));
  }
  assert.match(v3EventBody, /jsonb_strip_nulls\(jsonb_build_object/);
  assert.match(v3EventBody, /case when not v_customer_visible then v_after\.wallet_refund_request_id else null end/);
  assert.match(v3EventBody, /case when not v_customer_visible then v_after\.replacement_order_id else null end/);
  assert.doesNotMatch(v3EventBody, /p_reason|p_internal_note|p_lab_result|p_resolution_note/);
});

test("RMA API keeps unavailable reads as typed non-200 errors", () => {
  assert.match(repository, /function rmaReadUnavailable\(message: string/);
  assert.match(repository, /new RepositoryWriteError\(503, "RMA_READ_UNAVAILABLE"/);
  assert.match(repository, /readAdminRmaRequests\(context, query\)/);
  assert.match(repository, /readAdminRmaRequestById\(context, requestId, options\)/);
  assert.match(customerRoute, /error instanceof RepositoryWriteError/);
  assert.match(customerRoute, /apiError\(error\.status, error\.code, error\.message, error\.details\)/);
  assert.match(helper, /function rmaReadUnavailable\(message: string/);
  assert.match(helper, /if \(error\) \{[\s\S]*RMA request could not be read/);
  assert.match(helper, /if \(attachmentError\) \{[\s\S]*RMA attachments could not be read/);
  assert.match(helper, /if \(eventError\) \{[\s\S]*RMA customer events could not be read/);
  assert.match(helper, /requireCanonicalState/);
  assert.match(helper, /RMA_READ_UNAVAILABLE/);
  assert.match(evidence, /class RmaEvidenceReadError/);
  assert.match(evidence, /RMA_READ_UNAVAILABLE/);
  assert.match(evidence, /canonical RMA attachment/);
  assert.match(evidence, /status !== "committed"/);
  assert.match(helper, /status === "committed"/);
  assert.match(customerRoute, /RmaEvidenceReadError/);
  assert.match(adminRmaRoute, /totalIsExact: result\.data\.totalIsExact/);
  assert.match(adminRmaRoute, /hasMore: result\.data\.hasMore/);
  assert.match(adminRmaRoute, /lowerBound: result\.data\.lowerBound/);
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
  const cleanupStart = helper.indexOf("async function cancelRmaAttachmentAfterTicketFailure");
  const cleanup = helper.slice(cleanupStart, helper.indexOf("async function readDraftDto", cleanupStart));
  assert.notEqual(cleanupStart, -1, "ticket compensation helper must remain explicit and auditable");
  assert.match(cleanup, /RMA attachment ticket compensation could not cancel/);
  assert.match(cleanup, /const \{ data, error \} = await client\.rpc\("rma_cancel_attachment"/);
  assert.match(cleanup, /cancellationSucceeded = !error && data === true/);
  assert.match(
    cleanup,
    /if \(!cancellationSucceeded\) \{[\s\S]*?return;[\s\S]*?\n  \}\n\n  \/\/ A successful cancellation RPC is not enough/
  );
  assert.match(cleanup, /select\("id,user_id,draft_id,status,bucket,storage_path"\)/);
  assert.match(cleanup, /readString\(attachment\.user_id\) === userId/);
  assert.match(cleanup, /readString\(attachment\.draft_id\) === draftId/);
  assert.match(cleanup, /readString\(attachment\.bucket\) === rmaEvidenceBucket/);
  assert.match(cleanup, /readString\(attachment\.storage_path\) === storagePath/);
  assert.match(cleanup, /readString\(attachment\.status\) === "cancelled"/);
  assert.match(cleanup, /if \(!canRemoveStorage\) \{[\s\S]*?return;/);
  const verifiedGuardIndex = cleanup.indexOf('readString(attachment.status) === "cancelled"');
  const removeIndex = cleanup.indexOf(".remove([storagePath])");
  assert.ok(verifiedGuardIndex >= 0 && verifiedGuardIndex < removeIndex, "verified/committed rows must be rejected before remove");
  assert.match(cleanup, /const \{ error: removeError \} = await service\.storage/);
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
  assert.match(shippedBody, /private\.rma_canonical_source_facts\(v_before\.id\)/);
  assert.match(shippedBody, /v_source_customer_id/);
  assert.match(shippedBody, /rma_user_can_access_order\([\s\S]*v_source_customer_id,[\s\S]*v_source_order_id/);
  assert.match(shippedBody, /set customer_shipped_at = now\(\)/);
  for (const protectedColumn of ["customer_id", "order_id", "order_line_id", "order_no", "sku_code"]) {
    assert.doesNotMatch(
      shippedBody,
      new RegExp(`\\n\\s+${protectedColumn}\\s*=`),
      `customer shipment must not write protected canonical column ${protectedColumn}`
    );
  }

  const previewStart = finalizeMigration.indexOf("create or replace function public.admin_rma_refund_preview");
  const previewBody = finalizeMigration.slice(previewStart, finalizeMigration.indexOf("$$;", previewStart));
  assert.match(previewBody, /v_rma\.refund_currency is not null[\s\S]*btrim\(v_rma\.refund_currency\) <> 'EUR'/);
  assert.match(previewBody, /return query select false, 'invalid_snapshot', 'EUR'/);
  assert.match(previewBody, /requested_resolution not in \('refund', 'wallet_credit', 'credit_note'\)/);
  assert.match(previewBody, /resolution_action is not null and v_rma\.resolution_action <> 'refund_wallet'/);
  assert.match(previewBody, /received_at is null/);
  assert.match(previewBody, /received_quantity is distinct from v_rma\.quantity/);
  assert.match(previewBody, /wr\.status <> 'rejected'/);
  assert.match(previewBody, /linked\.status = 'rejected'/);
  assert.match(previewBody, /coalesce\(r\.refund_net_amount, r\.refund_amount, 0\) > 0/);
  assert.match(previewBody, /v_rma\.qc_status not in \('passed', 'failed', 'not_required'\)/);
  assert.match(previewBody, /v_rma\.replacement_order_id is not null/);
  assert.match(previewBody, /private\.rma_canonical_source_facts\(v_rma\.id\)/);
  assert.match(previewBody, /v_source_order_line_id/);
  assert.match(previewBody, /v_source_customer_id/);

  const candidateStart = finalizeMigration.indexOf("create or replace function public.admin_rma_replacement_candidates");
  const candidateBody = finalizeMigration.slice(candidateStart, finalizeMigration.indexOf("$$;", candidateStart));
  assert.match(candidateBody, /v_rma\.requested_resolution <> 'replacement'/);
  assert.match(candidateBody, /v_rma\.status <> 'received'/);
  assert.match(candidateBody, /v_rma\.received_at is null/);
  assert.match(candidateBody, /v_rma\.received_quantity is distinct from v_rma\.quantity/);
  assert.match(candidateBody, /v_rma\.qc_status not in \('passed', 'failed', 'not_required'\)/);
  assert.match(candidateBody, /v_rma\.wallet_refund_request_id is not null/);
  assert.match(candidateBody, /v_rma\.resolution_action is not null/);
  assert.match(candidateBody, /v_rma\.replacement_order_id is not null/);
  assert.match(candidateBody, /wr\.request_type is distinct from 'rma_return'/);
  assert.match(candidateBody, /wr\.status <> 'rejected'/);
  assert.match(candidateBody, /e\.action in \('request_wallet_refund', 'mark_replacement_sent'\)/);
  assert.match(candidateBody, /private\.rma_canonical_source_facts\(v_rma\.id\)/);
  assert.match(candidateBody, /v_source_order_line_id/);
  assert.match(candidateBody, /v_source_customer_id/);
  assert.match(candidateBody, /v_customer_id := v_source_customer_id/);
  assert.doesNotMatch(candidateBody, /v_customer_id := v_rma\.customer_id/);
  assert.match(candidateBody, /other_rma\.replacement_order_id = o\.id/);
  assert.doesNotMatch(candidateBody, /other_rma\.status <> 'rejected'/);

  const sourceHelperStart = migration.indexOf("create or replace function private.rma_canonical_source_facts");
  const sourceHelperBody = migration.slice(sourceHelperStart, migration.indexOf("$$;", sourceHelperStart));
  assert.match(sourceHelperBody, /from public\.order_lines as ol/);
  assert.match(sourceHelperBody, /from public\.orders as o/);
  for (const conflict of [
    /v_rma\.customer_id is distinct from v_order\.customer_id/,
    /v_rma\.order_id is distinct from v_order\.id/,
    /v_rma\.order_no is distinct from v_order\.order_no/,
    /v_rma\.sku_code is distinct from v_line\.sku_code/,
  ]) {
    assert.match(sourceHelperBody, conflict);
  }

  const v3Start = migration.indexOf("create or replace function public.admin_perform_rma_action_v3");
  const v3Body = migration.slice(v3Start, migration.indexOf("$$;", v3Start));
  assert.match(v3Body, /private\.rma_canonical_source_facts\(v_before\.id\)/);
  assert.match(v3Body, /RMA canonical source facts are invalid/);

  const walletActionStart = v3Body.indexOf("elsif v_action = 'request_wallet_refund'");
  const walletActionBody = v3Body.slice(walletActionStart, v3Body.indexOf("elsif v_action = 'restock_return'", walletActionStart));
  assert.match(walletActionBody, /v_before\.refund_currency is not null[\s\S]*btrim\(v_before\.refund_currency\) <> 'EUR'/);

  const replacementActionStart = v3Body.indexOf("elsif v_action = 'mark_replacement_sent'");
  const replacementActionBody = v3Body.slice(replacementActionStart, v3Body.indexOf("elsif v_action = 'close'", replacementActionStart));
  assert.match(replacementActionBody, /wr\.request_type is distinct from 'rma_return'/);
  assert.match(replacementActionBody, /wr\.status <> 'rejected'/);
  assert.match(replacementActionBody, /e\.action = 'request_wallet_refund'[\s\S]*e\.execution_status = 'succeeded'/);
});
