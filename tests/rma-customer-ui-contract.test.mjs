import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");
const page = read("src/app/rma/page.tsx");
const component = read("src/components/partspro/rma-page.tsx");
const uploadClient = read("src/lib/partspro-rma-upload-client.mjs");
const customerContract = read("src/lib/partspro-rma-contract.ts");
const customerDto = read("src/lib/partspro-rma-customer-dto.ts");
const simpleFlow = read("src/lib/partspro-rma-simple-flow.ts");

test("customer RMA page passes order, line and request query selections through the server page", () => {
  assert.match(page, /params\.order/);
  assert.match(page, /params\.line/);
  assert.match(page, /params\.requestId/);
  assert.match(page, /initialOrderLineId/);
  assert.match(page, /initialRequestId/);
  assert.match(component, /initialOrderLineId/);
  assert.match(component, /initialRequestId/);
  assert.match(component, /scrollIntoView/);
});

test("customer UI is a responsive three-block photo-first flow", () => {
  assert.equal((component.match(/<RmaStep\b/g) ?? []).length, 3);
  for (const number of ["1", "2", "3"]) {
    assert.match(component, new RegExp(`number="${number}"`));
  }
  assert.match(component, /rmaReasonCodes/);
  for (const reason of [
    "quality_defect",
    "shipping_damage",
    "not_as_described",
    "wrong_item",
    "missing_or_quantity_error",
    "withdrawal_no_longer_needed",
  ]) {
    assert.match(component, new RegExp(reason));
  }
  assert.match(component, /rmaResolutionCodes/);
  assert.match(component, /wallet_credit/);
  assert.match(component, /rmaMaxAttachments/);
  assert.match(component, /remainingQuantity/);
  assert.match(component, /value=\{form\.quantity\}/);
  assert.doesNotMatch(component, /noteRequired/);
  assert.doesNotMatch(component, /storefront\.rma\.note\.required/);
  assert.match(component, /canSubmit = Boolean\(selectedLine && quantityIsValid && images\.length > 0\)/);
});

test("camera and gallery controls expose only supported image inputs", () => {
  assert.match(component, /id="rma-camera"/);
  assert.match(component, /accept="image\/\*"[\s\S]*capture="environment"/);
  assert.match(component, /id="rma-gallery"/);
  assert.match(component, /id="rma-gallery"[\s\S]*accept="image\/\*"[\s\S]*multiple/);
  assert.match(component, /selectRmaImageFiles/);
  assert.match(component, /URL\.createObjectURL/);
  assert.match(component, /URL\.revokeObjectURL/);
  assert.match(component, /onProgress/);
  assert.match(component, /submittingRef/);
  assert.match(component, /if \(submittingRef\.current\)/);
  assert.match(component, /areRmaControlsLocked/);
  assert.match(component, /controlsLocked/);
  assert.match(component, /disabled=\{controlsLocked/);
  assert.equal((component.match(/submitRmaWithAttachments\(/g) ?? []).length, 1);
  assert.doesNotMatch(component, /\/api\/rma\/evidence/);
  assert.doesNotMatch(component, /<video|video\//i);
  assert.doesNotMatch(component, /evidenceChecklist|technical|problemCategories/);
});

test("customer submit uses the new upload orchestrator and safe DTO history", () => {
  assert.match(component, /submitRmaWithAttachments/);
  assert.match(component, /CustomerRmaDto/);
  assert.match(component, /draftIdempotencyKey/);
  assert.match(component, /submitIdempotencyKey/);
  assert.match(component, /cancelRmaUploadCheckpoint/);
  assert.match(component, /onCheckpoint: handleUploadCheckpoint/);
  assert.match(component, /checkpoint: uploadCheckpointRef\.current/);
  assert.match(component, /isAbandoningCheckpoint/);
  assert.match(component, /storefront\.rma\.upload\.confirmSubmit/);
  assert.match(component, /storefront\.rma\.upload\.abandonRestart/);
  assert.match(component, /storefront\.rma\.upload\.cleanupHint/);
  assert.match(component, /rmaNo \?\? savedRequest\.id/);
  assert.match(component, /request\.orderNumber/);
  assert.doesNotMatch(component, /request\.orderId/);
  assert.match(component, /customerStage/);
  assert.match(component, /rmaCustomerStageLabel/);
  assert.match(component, /request\.attachments/);
  assert.doesNotMatch(component, /type RmaRequest\b|import[^;]*RmaRequest/);
  assert.doesNotMatch(component, /request\.status/);
  assert.match(uploadClient, /\/api\/rma\/drafts/);
  assert.match(uploadClient, /\/api\/rma\/submit/);
  assert.match(uploadClient, /method: "PUT"/);
  assert.match(uploadClient, /cacheControl/);
  assert.match(uploadClient, /sha256Hex/);
  assert.match(uploadClient, /\/complete/);
  assert.match(uploadClient, /method: "DELETE"/);
  assert.match(uploadClient, /phase === "abandoning"/);
  assert.match(uploadClient, /RMA_UPLOAD_ABANDONED/);
});

test("customer UI has no confirmation modal and final request remains opaque", () => {
  assert.doesNotMatch(component, /Dialog|window\.confirm|confirm\(/);
  const submitStart = uploadClient.indexOf("export function buildRmaSubmitPayload");
  const submitEnd = uploadClient.indexOf("export async function submitRmaWithAttachments");
  const payloadHelper = uploadClient.slice(submitStart, submitEnd);
  for (const forbidden of ["bucket", "path", "signedUrl", "uploadUrl", "orderId", "sku"]) {
    assert.doesNotMatch(payloadHelper, new RegExp(`\\b${forbidden}\\b`));
  }
});

test("customer can mark an approved request shipped in one tap with optional logistics", () => {
  assert.match(component, /shippingPendingRef/);
  assert.match(component, /shippingPendingRef\.current\.has\(request\.id\)/);
  assert.match(component, /method: "POST"/);
  assert.match(component, /\/api\/rma\/\$\{encodeURIComponent\(request\.id\)\}\/shipped/);
  assert.match(component, /Object\.keys\(shippingDetails\)\.length > 0 \? JSON\.stringify\(shippingDetails\) : "\{\}"/);
  assert.match(component, /canMarkShipped/);
  assert.match(component, /storefront\.rma\.shipped\.button/);
  assert.match(component, /storefront\.rma\.shipped\.details/);
  assert.match(component, /storefront\.rma\.shipped\.carrier/);
  assert.match(component, /storefront\.rma\.shipped\.tracking/);
  assert.match(component, /setRecentRequests\(\(current\) =>[\s\S]*current\.map\(\(item\) => \(item\.id === savedRequest\.id \? savedRequest : item\)\)/);
  assert.match(component, /customerShippedAt/);
  assert.match(component, /shippingNotice\.tone === "error"/);
  assert.match(component, /const EMPTY_SHIPPING_DRAFT: Readonly<ShippingDraft>/);
  assert.match(component, /shippingDrafts\[request\.id\] \?\? EMPTY_SHIPPING_DRAFT/);
  assert.doesNotMatch(component, /Dialog|window\.confirm|confirm\(/);
});

test("customer DTO exposes a safe order number and the canonical flow resolves it by customer-owned order", () => {
  assert.match(customerContract, /orderNumber: string \| null/);
  assert.match(customerDto, /orderNumber: request\.orderNumber \?\? request\.orderId \?\? null/);
  assert.match(simpleFlow, /select\("id,rma_no,order_id,order_no,customer_id/);
  assert.match(simpleFlow, /\.from\("orders"\)[\s\S]*\.select\("id,order_no"\)[\s\S]*\.eq\("id", orderId\)[\s\S]*\.eq\("customer_id", customerId\)/);
  assert.match(simpleFlow, /orderNumber,/);
});
