import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const contract = read("src/lib/partspro-rma-contract.ts");
const http = read("src/lib/partspro-rma-http.ts");
const helper = read("src/lib/partspro-rma-simple-flow.ts");
const evidence = read("src/lib/partspro-rma-evidence.ts");
const customerRoute = read("src/app/api/rma/route.ts");
const legacyEvidenceRoute = read("src/app/api/rma/evidence/route.ts");
const completeRoute = read("src/app/api/rma/drafts/[draftId]/attachments/[attachmentId]/complete/route.ts");
const migration = read("supabase/migrations/20260827210026_rma_simple_flow_expand.sql");

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
});

test("server upload/complete/submit path is opaque, direct-upload and fail-closed", () => {
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
  assert.match(http, /normalizeLegacyRmaAttachments/);
  assert.match(http, /Cache-Control/);
  assert.match(customerRoute, /handleRmaSubmit/);
  assert.match(customerRoute, /customerStageForRmaStatus/);
  assert.doesNotMatch(customerRoute, /data:\s*customerRequests[\s\S]*internalNote/);
  assert.match(legacyEvidenceRoute, /maxEvidenceBytes = 20 \* 1024 \* 1024/);
  assert.match(legacyEvidenceRoute, /rma\/\$\{account\.userId\}\/legacy/);
  assert.match(legacyEvidenceRoute, /video\/mp4/);
  assert.match(legacyEvidenceRoute, /createSignedUrl/);
  assert.match(evidence, /isRmaEvidencePathOwnedByUser/);
  assert.match(evidence, /stripSignedUrl/);
  assert.match(evidence, /storage_path/);
  assert.match(completeRoute, /export async function DELETE/);
  assert.match(completeRoute, /cancelRmaAttachment/);
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
});

test("statutory withdrawal and pure safety helpers remain separate from defect evidence", () => {
  assert.match(contract, /policyScope === "statutory_b2c_withdrawal"/);
  assert.match(contract, /export function isRmaActionAvailable/);
  assert.match(contract, /export function calculateRmaLineRefundCap/);
  assert.match(migration, /reason is required unless the draft is a statutory B2C withdrawal/);
  assert.match(migration, /v_policy_scope = 'statutory_b2c_withdrawal'/);
  assert.match(migration, /unit_price_snapshot/);
});
