import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  projectAdminRmaWorkflow,
  rmaWorkflowActionCodes,
  rmaWorkflowQueueCodes,
} from "../src/lib/partspro-rma-workflow-rules.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const manage = { manage: true };
const inventory = { inventory: true };
const inventoryAndAdjust = { inventory: true, adjustStock: true };
const refund = { refund: true };
const allCapabilities = {
  manage: true,
  inventory: true,
  refund: true,
  adjustStock: true,
};

const received = {
  status: "received",
  quantity: 2,
  receivedQuantity: 2,
  receivedAt: "2026-08-28T10:00:00.000Z",
  qcStatus: "passed",
};

const refunded = {
  ...received,
  status: "refunded",
  resolutionQuantity: 2,
  resolutionAction: "refund_wallet",
  walletRequestStatus: "approved",
};

test("exports the frozen queue and action contract", () => {
  assert.deepEqual(rmaWorkflowQueueCodes, [
    "review",
    "awaiting_return",
    "receiving",
    "qc",
    "resolution",
    "inventory_close",
    "archive",
  ]);
  assert.deepEqual(rmaWorkflowActionCodes, [
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
  ]);
  assert.equal(Object.isFrozen(rmaWorkflowQueueCodes), true);
  assert.equal(Object.isFrozen(rmaWorkflowActionCodes), true);
});

test("submitted RMAs enter review and recommend start_review", () => {
  const result = projectAdminRmaWorkflow(
    { status: "submitted", quantity: 1 },
    manage
  );

  assert.equal(result.workflowQueue, "review");
  assert.deepEqual(result.availableActions, ["start_review", "assign"]);
  assert.equal(result.recommendedAction, "start_review");
  assert.equal(result.blockedReason, null);
});

test("under_review exposes approve and reject while preferring approve", () => {
  const result = projectAdminRmaWorkflow(
    { status: "under_review", quantity: 1 },
    manage
  );

  assert.equal(result.workflowQueue, "review");
  assert.equal(result.availableActions.includes("approve"), true);
  assert.equal(result.availableActions.includes("reject"), true);
  assert.equal(result.availableActions.includes("assign"), true);
  assert.equal(result.recommendedAction, "approve");
});

test("review actions are permission filtered and fail closed", () => {
  for (const status of ["submitted", "under_review"]) {
    const result = projectAdminRmaWorkflow({ status, quantity: 1 }, {});
    assert.equal(result.workflowQueue, "review");
    assert.deepEqual(result.availableActions, []);
    assert.equal(result.recommendedAction, null);
    assert.equal(result.blockedReason, "permission_denied");
  }
});

test("approved without shipment waits for the customer return", () => {
  const result = projectAdminRmaWorkflow(
    { status: "approved", quantity: 1 },
    inventory
  );

  assert.equal(result.workflowQueue, "awaiting_return");
  // Store inventory staff may use the direct-receive fallback, but it is a
  // secondary action while the customer shipment declaration is missing.
  assert.deepEqual(result.availableActions, ["mark_received"]);
  assert.equal(result.recommendedAction, null);
  assert.equal(result.blockedReason, "waiting_customer_return");
});

test("approved with customer shipment enters receiving and inventory may mark it received", () => {
  const result = projectAdminRmaWorkflow(
    {
      status: "approved",
      quantity: 1,
      customerShippedAt: "2026-08-28T09:00:00.000Z",
    },
    inventory
  );

  assert.equal(result.workflowQueue, "receiving");
  assert.deepEqual(result.availableActions, ["mark_received"]);
  assert.equal(result.recommendedAction, "mark_received");
  assert.equal(result.blockedReason, null);
});

test("receiving is blocked for an operator without inventory permission", () => {
  const result = projectAdminRmaWorkflow(
    {
      status: "approved",
      quantity: 1,
      customerShippedAt: "2026-08-28T09:00:00.000Z",
    },
    manage
  );

  assert.equal(result.workflowQueue, "receiving");
  assert.deepEqual(result.availableActions, ["assign"]);
  assert.equal(result.recommendedAction, null);
  assert.equal(result.blockedReason, "permission_denied");
});

test("received with pending QC enters qc and manage or inventory may record it", () => {
  const input = { ...received, qcStatus: "pending" };
  const manageResult = projectAdminRmaWorkflow(input, manage);
  const inventoryResult = projectAdminRmaWorkflow(input, inventory);

  for (const result of [manageResult, inventoryResult]) {
    assert.equal(result.workflowQueue, "qc");
    assert.equal(result.availableActions.includes("record_qc"), true);
    assert.equal(result.recommendedAction, "record_qc");
    assert.equal(result.blockedReason, null);
  }
});

test("QC completion moves a received RMA to resolution and refund permission exposes wallet action", () => {
  const result = projectAdminRmaWorkflow(
    { ...received, requestedResolution: "wallet_credit" },
    refund
  );

  assert.equal(result.workflowQueue, "resolution");
  assert.deepEqual(result.availableActions, ["request_wallet_refund"]);
  assert.equal(result.recommendedAction, "request_wallet_refund");
  assert.equal(result.blockedReason, null);
});

test("replacement resolution requires manage and recommends mark_replacement_sent", () => {
  const result = projectAdminRmaWorkflow(
    { ...received, requestedResolution: "replacement" },
    manage
  );

  assert.equal(result.workflowQueue, "resolution");
  assert.deepEqual(result.availableActions, ["assign", "mark_replacement_sent"]);
  assert.equal(result.recommendedAction, "mark_replacement_sent");
});

test("wallet pending blocks both commercial outcomes and never recommends one", () => {
  const result = projectAdminRmaWorkflow(
    {
      ...received,
      requestedResolution: "wallet_credit",
      walletRequestStatus: "pending",
    },
    allCapabilities
  );

  assert.equal(result.workflowQueue, "resolution");
  assert.equal(result.availableActions.includes("request_wallet_refund"), false);
  assert.equal(result.availableActions.includes("mark_replacement_sent"), false);
  assert.equal(result.recommendedAction, null);
  assert.equal(result.blockedReason, "waiting_wallet_approval");
});

test("a rejected wallet attempt returns to resolution and can be retried", () => {
  const result = projectAdminRmaWorkflow(
    {
      ...received,
      requestedResolution: "wallet_credit",
      resolutionAction: "refund_wallet",
      walletRequestStatus: "rejected",
    },
    refund
  );

  assert.equal(result.workflowQueue, "resolution");
  assert.deepEqual(result.availableActions, ["request_wallet_refund"]);
  assert.equal(result.recommendedAction, "request_wallet_refund");
  assert.equal(result.blockedReason, null);
});

test("inventory_close offers the three quarantine dispositions with separate permissions", () => {
  const quarantine = { ...refunded, inventoryDisposition: "quarantine" };
  const inventoryResult = projectAdminRmaWorkflow(quarantine, inventory);
  const adjustResult = projectAdminRmaWorkflow(quarantine, inventoryAndAdjust);

  assert.equal(inventoryResult.workflowQueue, "inventory_close");
  assert.deepEqual(inventoryResult.availableActions, [
    "mark_scrapped",
    "supplier_return",
  ]);
  assert.equal(inventoryResult.recommendedAction, "choose_inventory_disposition");
  assert.deepEqual(adjustResult.availableActions, [
    "restock_return",
    "mark_scrapped",
    "supplier_return",
  ]);
  assert.equal(adjustResult.recommendedAction, "choose_inventory_disposition");
});

test("an undisposed commercial RMA recommends disposition without inventing a stock action", () => {
  const result = projectAdminRmaWorkflow(refunded, inventory);

  assert.equal(result.workflowQueue, "inventory_close");
  assert.deepEqual(result.availableActions, []);
  assert.equal(result.recommendedAction, "choose_inventory_disposition");
  assert.equal(result.blockedReason, null);
});

test("terminal inventory disposition allows manage-only close through the shared guard", () => {
  const result = projectAdminRmaWorkflow(
    { ...refunded, inventoryDisposition: "restock", inventoryDispositionQuantity: 2 },
    manage
  );

  assert.equal(result.workflowQueue, "inventory_close");
  assert.deepEqual(result.availableActions, ["assign", "close"]);
  assert.equal(result.recommendedAction, "close");
  assert.equal(result.blockedReason, null);
});

test("replacement_sent is also an inventory_close commercial terminal", () => {
  const result = projectAdminRmaWorkflow(
    {
      ...received,
      status: "replacement_sent",
      resolutionQuantity: 2,
      resolutionAction: "replacement",
      replacementOrderId: "replacement-order-1",
      inventoryDisposition: "quarantine",
    },
    inventory
  );

  assert.equal(result.workflowQueue, "inventory_close");
  assert.deepEqual(result.availableActions, ["mark_scrapped", "supplier_return"]);
  assert.equal(result.recommendedAction, "choose_inventory_disposition");
});

test("legacy replaced is the same replacement terminal for QC repair and close", () => {
  const legacyReplaced = {
    ...received,
    status: "replaced",
    qcStatus: "pending",
    resolutionQuantity: 2,
    resolutionAction: "replacement",
    replacementOrderId: "replacement-order-1",
  };
  const pendingQc = projectAdminRmaWorkflow(
    legacyReplaced,
    inventory
  );
  assert.equal(pendingQc.workflowQueue, "qc");
  assert.deepEqual(pendingQc.availableActions, ["record_qc"]);

  const settled = projectAdminRmaWorkflow(
    {
      ...legacyReplaced,
      qcStatus: "passed",
      inventoryDisposition: "restock",
      inventoryDispositionQuantity: 2,
    },
    allCapabilities
  );
  assert.equal(settled.workflowQueue, "inventory_close");
  assert.equal(settled.availableActions.includes("close"), true);
});

test("inventory and adjustment permissions are independent", () => {
  const quarantine = { ...refunded, inventoryDisposition: "quarantine" };
  const noInventory = projectAdminRmaWorkflow(quarantine, { adjustStock: true });
  const noAdjustment = projectAdminRmaWorkflow(quarantine, inventory);

  assert.deepEqual(noInventory.availableActions, []);
  assert.equal(noInventory.recommendedAction, null);
  assert.equal(noInventory.blockedReason, "permission_denied");
  assert.equal(noAdjustment.availableActions.includes("restock_return"), false);
  assert.equal(noAdjustment.availableActions.includes("mark_scrapped"), true);
  assert.equal(noAdjustment.availableActions.includes("supplier_return"), true);
});

test("closed and rejected RMAs archive; only manage may close an unreached rejected RMA", () => {
  const closed = projectAdminRmaWorkflow({ status: "closed" }, allCapabilities);
  const rejected = projectAdminRmaWorkflow({ status: "rejected" }, manage);
  const rejectedNoManage = projectAdminRmaWorkflow({ status: "rejected" }, {});

  assert.equal(closed.workflowQueue, "archive");
  assert.deepEqual(closed.availableActions, []);
  assert.equal(closed.recommendedAction, null);
  assert.equal(closed.blockedReason, null);

  assert.equal(rejected.workflowQueue, "archive");
  assert.deepEqual(rejected.availableActions, ["close"]);
  assert.equal(rejected.recommendedAction, "close");
  assert.equal(rejectedNoManage.workflowQueue, "archive");
  assert.deepEqual(rejectedNoManage.availableActions, []);
  assert.equal(rejectedNoManage.blockedReason, "permission_denied");
});

test("assign is optional, only for unassigned non-terminal RMAs, and never recommended", () => {
  const unassigned = projectAdminRmaWorkflow(
    { status: "under_review", quantity: 1 },
    manage
  );
  const assigned = projectAdminRmaWorkflow(
    { status: "under_review", quantity: 1, assignedTo: "staff-1" },
    manage
  );
  const rejected = projectAdminRmaWorkflow({ status: "rejected" }, manage);

  assert.equal(unassigned.availableActions.includes("assign"), true);
  assert.notEqual(unassigned.recommendedAction, "assign");
  assert.equal(assigned.availableActions.includes("assign"), false);
  assert.equal(rejected.availableActions.includes("assign"), false);
});

test("missing receivedAt routes received history to review and hides all actions", () => {
  const result = projectAdminRmaWorkflow(
    {
      status: "received",
      quantity: 2,
      receivedQuantity: 2,
      qcStatus: "pending",
    },
    allCapabilities
  );

  assert.equal(result.workflowQueue, "review");
  assert.deepEqual(result.availableActions, []);
  assert.equal(result.recommendedAction, null);
  assert.equal(result.blockedReason, "missing_received_at");
});

test("partial received quantity routes history to review and prevents QC or commercial actions", () => {
  const result = projectAdminRmaWorkflow(
    {
      ...received,
      receivedQuantity: 1,
      requestedResolution: "wallet_credit",
    },
    allCapabilities
  );

  assert.equal(result.workflowQueue, "review");
  assert.deepEqual(result.availableActions, []);
  assert.equal(result.recommendedAction, null);
  assert.equal(result.blockedReason, "partial_received_quantity");
});

test("missing QC status is routed to the QC repair queue and can invoke the guarded repair", () => {
  const result = projectAdminRmaWorkflow(
    { ...received, qcStatus: undefined },
    allCapabilities
  );

  assert.equal(result.workflowQueue, "qc");
  assert.deepEqual(result.availableActions, ["assign", "record_qc"]);
  assert.equal(result.recommendedAction, "record_qc");
  assert.equal(result.blockedReason, null);
});

test("invalid and incomplete terminal settlement states fail closed", () => {
  const missingResolution = projectAdminRmaWorkflow(
    {
      ...received,
      status: "refunded",
      resolutionAction: "refund_wallet",
      walletRequestStatus: "approved",
      inventoryDisposition: "quarantine",
    },
    allCapabilities
  );
  const partialInventory = projectAdminRmaWorkflow(
    {
      ...refunded,
      inventoryDisposition: "restock",
      inventoryDispositionQuantity: 1,
    },
    allCapabilities
  );

  assert.equal(missingResolution.workflowQueue, "review");
  assert.deepEqual(missingResolution.availableActions, []);
  assert.equal(missingResolution.blockedReason, "missing_resolution_quantity");
  assert.equal(partialInventory.workflowQueue, "review");
  assert.deepEqual(partialInventory.availableActions, []);
  assert.equal(partialInventory.blockedReason, "partial_inventory_disposition_quantity");
});

test("snake-case DTO aliases are normalized without widening capability permissions", () => {
  const result = projectAdminRmaWorkflow(
    {
      status: "received",
      quantity: 1,
      received_quantity: 1,
      received_at: "2026-08-28T10:00:00.000Z",
      qc_status: "passed",
      requested_resolution: "refund",
    },
    { canRefund: true }
  );

  assert.equal(result.workflowQueue, "resolution");
  assert.deepEqual(result.availableActions, ["request_wallet_refund"]);
  assert.equal(result.recommendedAction, "request_wallet_refund");
});

test("server workbench routes expose only the canonical queues and server projection", () => {
  const adminListRoute = read("src/app/api/admin/rma/route.ts");
  const adminDetailRoute = read("src/app/api/admin/rma/[requestId]/route.ts");
  const adminActionRoute = read("src/app/api/admin/rma/[requestId]/actions/route.ts");
  const adminDto = read("src/lib/partspro-rma-admin-dto.ts");

  for (const queue of [
    "review",
    "awaiting_return",
    "receiving",
    "qc",
    "resolution",
    "inventory_close",
    "archive",
  ]) {
    assert.match(adminListRoute, new RegExp(`\\"${queue}\\"`));
  }
  assert.match(adminListRoute, /queueCounts/);
  assert.match(adminListRoute, /countsComplete/);
  assert.match(adminListRoute, /listAdminRmaRequests\(\{[\s\S]*limit: 200[\s\S]*offset: 0[\s\S]*q: query\.data\.q[\s\S]*status: query\.data\.status/);
  assert.match(adminListRoute, /queueCounts: countAdminRmaQueues\(countResult\.data\.requests/);
  assert.doesNotMatch(adminListRoute, /queueCounts: countAdminRmaQueues\(hydratedRequests/);
  assert.match(adminListRoute, /getAdminRmaCapabilities/);
  assert.match(adminListRoute, /toAdminRmaDto/);
  const repository = read("src/lib/partspro-repository.ts");
  assert.match(repository, /ADMIN_RMA_REFUND_PREVIEW_FAILED/);
  assert.match(repository, /ADMIN_RMA_REPLACEMENT_CANDIDATES_FAILED/);
  assert.match(repository, /throw new RepositoryWriteError\([\s\S]*supabaseRpcStatus\(error\)/);
  assert.doesNotMatch(repository, /admin_rma_refund_preview[\s\S]*if \(error\) \{\s*return null/);
  assert.doesNotMatch(repository, /admin_rma_replacement_candidates[\s\S]*if \(error \|\| !Array\.isArray\(data\)\) \{\s*return \[\]/);
  assert.match(repository, /data: await readAdminRmaRequestById\(context, requestId, options\)/);
  assert.match(repository, /data: await readAdminRmaRefundPreview\(context\.client, requestId\)/);
  assert.match(repository, /projectAdminRmaWorkflow\(requestRow, allRmaCapabilities\)/);
  assert.match(repository, /totalIsExact:[\s\S]*!queueScoped/);
  assert.match(adminDetailRoute, /export async function GET/);
  assert.match(adminDetailRoute, /replacementCandidates/);
  assert.match(adminDetailRoute, /refundPreview/);
  assert.match(adminActionRoute, /admin_perform_rma_review_action/);
  assert.match(adminActionRoute, /start_review/);
  assert.match(adminDto, /projectAdminRmaWorkflow/);
  assert.match(adminDto, /hasAdminPermission\(authState, "rma\.manage"\)/);
  assert.match(adminDto, /hasAdminPermission\(authState, "rma\.inventory"\)/);
  assert.match(adminDto, /hasAdminPermission\(authState, "rma\.refund"\)/);
  assert.match(adminDto, /hasExactAdminPermission\(authState, "product\.adjust_stock"\)/);

  const attachmentMapper = adminDto.slice(
    adminDto.indexOf("function toAdminAttachmentDto"),
    adminDto.indexOf("function toAdminEventDto")
  );
  assert.doesNotMatch(attachmentMapper, /path|ownerUserId|bucket/);
});

test("queue counts stay global when the page is filtered to review", () => {
  const scopedRows = [
    { status: "submitted", quantity: 1 },
    { status: "approved", quantity: 1 },
    { status: "approved", quantity: 1, customerShippedAt: "2026-08-28T09:00:00.000Z" },
  ];
  const counts = Object.fromEntries(rmaWorkflowQueueCodes.map((queue) => [queue, 0]));

  for (const row of scopedRows) {
    counts[projectAdminRmaWorkflow(row, inventory).workflowQueue] += 1;
  }

  assert.equal(counts.review, 1);
  assert.equal(counts.awaiting_return, 1);
  assert.equal(counts.receiving, 1);
});

test("customer shipped contract is one-click, idempotent and safe for the DTO", () => {
  const shippedRoute = read("src/app/api/rma/[requestId]/shipped/route.ts");
  const helper = read("src/lib/partspro-rma-simple-flow.ts");
  const customerDto = read("src/lib/partspro-rma-customer-dto.ts");
  const contract = read("src/lib/partspro-rma-contract.ts");

  assert.match(shippedRoute, /rmaCustomerShippedSchema/);
  assert.match(shippedRoute, /markRmaShipped/);
  assert.match(shippedRoute, /let payload: unknown = \{\}/);
  assert.match(shippedRoute, /request\.text\(\)/);
  assert.match(helper, /rma_mark_customer_shipped/);
  assert.match(helper, /p_return_carrier/);
  assert.match(helper, /p_return_tracking_code/);
  assert.match(contract, /rmaCustomerShippedSchema/);
  assert.match(customerDto, /customerShippedAt/);
  assert.match(customerDto, /canMarkShipped/);
  assert.match(customerDto, /request\.status === "approved"[\s\S]*return_in_transit/);
  assert.match(helper, /status === "approved" && customerShippedAt[\s\S]*return_in_transit/);
  assert.match(customerDto, /return_in_transit/);
});

test("Migration B contains the guarded review, shipped, preview, candidate and revoke contracts", () => {
  const migration = read("supabase/migrations/20260828092050_rma_workflow_finalize.sql");

  assert.match(migration, /file_size_limit,[\s\S]*4194304/);
  for (const mime of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
    assert.match(migration, new RegExp(`'${mime}'`));
  }
  assert.match(migration, /revoke select, insert, update on public\.rma_requests/);
  assert.match(migration, /revoke select, insert on public\.rma_request_events/);
  assert.match(migration, /drop policy if exists "partspro_rma_self_submit"/);
  assert.match(migration, /drop policy if exists "partspro_rma_self_or_staff_read"/);
  assert.match(migration, /drop policy if exists "partspro_rma_events_read"/);
  assert.match(migration, /drop policy if exists "partspro_rma_events_staff_insert"/);
  assert.match(migration, /auto_claim_rma_first_action/);
  assert.match(migration, /notify_rma_review_status_change/);
  assert.match(migration, /admin_perform_rma_review_action/);
  assert.match(migration, /partspro_has_permission\('rma\.manage'\)[\s\S]*partspro_has_permission\('orders\.manage'\)/);
  assert.match(migration, /partspro_has_permission\('rma\.read'\)[\s\S]*partspro_has_permission\('orders\.read'\)/);
  assert.match(migration, /partspro_has_permission\('rma\.refund'\)[\s\S]*partspro_has_permission\('wallet_refunds\.request'\)/);
  assert.match(migration, /rma_mark_customer_shipped/);
  assert.match(migration, /for update/);
  assert.match(migration, /customer_shipped_at/);
  assert.match(migration, /admin_rma_refund_preview/);
  assert.match(migration, /unit_price_snapshot/);
  assert.match(migration, /tax_and_shipping_included boolean/);
  assert.match(migration, /admin_rma_replacement_candidates/);
  assert.match(migration, /o\.status = 'shipped'/);
  assert.match(migration, /o\.id is distinct from v_original_order_id/);
  assert.match(migration, /other_rma\.replacement_order_id = o\.id/);
  assert.match(migration, /other_rma\.id <> v_rma\.id/);
  assert.doesNotMatch(migration, /other_rma\.status <> 'rejected'/);
  assert.match(migration, /set search_path = pg_catalog, public, private, pg_temp/);
  assert.match(migration, /RMA_CLIENT_UPGRADE_REQUIRED/);
});
