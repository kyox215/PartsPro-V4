import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");
const panel = read("src/components/partspro/admin-rma-panel.tsx");

test("admin panel exposes six active server queues and a secondary archive entry", () => {
  for (const queue of [
    "review",
    "awaiting_return",
    "receiving",
    "qc",
    "resolution",
    "inventory_close",
    "archive",
  ]) {
    assert.match(panel, new RegExp(`"${queue}"`));
  }
  assert.match(panel, /ACTIVE_QUEUE_TABS/);
  assert.match(panel, /role="tablist"/);
  assert.match(panel, /queueCounts/);
  assert.match(panel, /countsComplete/);
  assert.match(panel, /`≥\$\{/);
  assert.match(panel, /setQueue\("archive"\)/);
  assert.doesNotMatch(panel, /type StatusFilter/);
  assert.doesNotMatch(panel, /queueFilters/);
});

test("admin detail renders server workflow actions and uses one guarded action endpoint", () => {
  for (const action of [
    "start_review",
    "approve",
    "reject",
    "assign",
    "mark_received",
    "record_qc",
    "request_wallet_refund",
    "mark_replacement_sent",
    "restock_return",
    "mark_scrapped",
    "supplier_return",
    "close",
  ]) {
    assert.match(panel, new RegExp(`"${action}"`));
  }
  for (const projection of ["workflowQueue", "availableActions", "recommendedAction", "blockedReason"]) {
    assert.match(panel, new RegExp(projection));
  }
  assert.match(panel, /\/api\/admin\/rma\/\$\{encodeURIComponent\(requestId\)\}/);
  assert.match(panel, /\/actions/);
  assert.match(panel, /method: "POST"/);
  assert.match(panel, /pendingActionRef/);
  assert.match(panel, /idempotencyKey/);
  assert.doesNotMatch(panel, /method: "PATCH"/);
  assert.doesNotMatch(panel, /isRmaActionAvailable/);
});

test("admin refund preview, replacement candidates and inventory forms stay fail-closed and opaque", () => {
  assert.match(panel, /maxRefundAmount/);
  assert.match(panel, /taxAndShippingIncluded/);
  assert.match(panel, /refundPreview\?\.available/);
  assert.match(panel, /replacementCandidates/);
  assert.match(panel, /candidate\.orderNumber/);
  assert.match(panel, /noCandidate/);
  assert.doesNotMatch(panel, /shortId\(candidate\.id\)/);
  assert.match(panel, /INVENTORY_ACTIONS/);
  assert.match(panel, /restock_return/);
  assert.match(panel, /mark_scrapped/);
  assert.match(panel, /supplier_return/);
  assert.match(panel, /batchCode/);
  assert.match(panel, /setLocation\("Milano"\)/);
  assert.match(panel, /completeQuantity\(request\)/);
  assert.match(panel, /body\.quantity = completeQuantity\(request\)/);
  assert.match(panel, /signedUrl/);
  assert.match(panel, /<Image/);
  assert.match(panel, /photoAttachment/);
});

test("admin uses focused dialogs and hides assign from the recommendation", () => {
  assert.match(panel, /Dialog open=\{actionDialog === "reject"\}/);
  assert.match(panel, /Dialog open=\{actionDialog === "qc"\}/);
  assert.match(panel, /Dialog open=\{actionDialog === "refund"\}/);
  assert.match(panel, /Dialog open=\{actionDialog === "replacement"\}/);
  assert.match(panel, /Dialog open=\{actionDialog === "inventory"\}/);
  assert.match(panel, /action !== "assign"/);
  assert.match(panel, /selectedRequest\.availableActions\.includes\("assign"\)/);
  assert.match(panel, /recommendedAction === "choose_inventory_disposition"/);
});
