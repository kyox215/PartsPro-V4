import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");
const typescript = createRequire(import.meta.url)("typescript");

const notifications = read("src/lib/partspro-notifications.ts");
const submitHttp = read("src/lib/partspro-rma-http.ts");
const shippedRoute = read("src/app/api/rma/[requestId]/shipped/route.ts");
const actionsRoute = read("src/app/api/admin/rma/[requestId]/actions/route.ts");
const legacyReviewRoute = read("src/app/api/admin/rma/[requestId]/route.ts");
const walletRoute = read("src/app/api/admin/wallet-refunds/[refundId]/route.ts");
const repository = read("src/lib/partspro-repository.ts");
const rmaMigration = read("supabase/migrations/20260828092046_rma_simple_flow_expand.sql");
const finalizeMigration = read("supabase/migrations/20260828092050_rma_workflow_finalize.sql");

test("RMA notification event types stay aligned with the database contract", () => {
  for (const eventType of ["rma_submitted", "rma_status_updated", "rma_action_required"]) {
    assert.match(notifications, new RegExp(`\\| "${eventType}"`));
    assert.match(rmaMigration, new RegExp(`'${eventType}'`));
  }

  assert.match(finalizeMigration, /'review_status_change'/);
  assert.match(rmaMigration, /'wallet_refund_approved'/);
  assert.match(rmaMigration, /'customer_submit'/);
});

test("dispatcher delivers the transactional outbox event without inserting a duplicate", () => {
  const dispatcherStart = notifications.indexOf(
    "export async function deliverPendingRmaNotifications"
  );
  const dispatcherEnd = notifications.indexOf(
    "export async function notifyRmaCustomerShipped",
    dispatcherStart
  );
  const dispatcher = notifications.slice(dispatcherStart, dispatcherEnd);

  assert.notEqual(dispatcherStart, -1);
  assert.match(dispatcher, /\.eq\("rma_request_id", input\.requestId\)/);
  assert.match(dispatcher, /\.eq\("source_action", input\.sourceAction\)/);
  assert.match(dispatcher, /\.is\("push_attempted_at", null\)/);
  assert.match(dispatcher, /request\.contains\("payload", \{ status: input\.status \}\)/);
  assert.match(dispatcher, /\.update\(\{ push_attempted_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(dispatcher, /\.eq\("id", eventId\)[\s\S]*?\.is\("push_attempted_at", null\)/);
  assert.match(dispatcher, /pushNotificationEvent\(client, claimedEvent\)/);
  assert.match(dispatcher, /while \(true\)/);
  assert.match(dispatcher, /\.limit\(batchSize\)/);
  assert.doesNotMatch(dispatcher, /\.insert\(|\.upsert\(/);
});

test("dispatcher drains more than one batch instead of stranding recipient 21", async () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    id: `event-${index + 1}`,
    payload: { status: "return_in_transit" },
    push_attempted_at: null,
    rma_request_id: "request-1",
    source_action: "customer_mark_shipped",
  }));
  const batchLengths = [];
  const helpers = loadNotificationHelpers(
    ["deliverPendingRmaNotifications", "summarizePushNotificationOutcomes"],
    {
      NotificationServiceError: class NotificationServiceError extends Error {},
      getNotificationClient: () => notificationClient(rows, batchLengths),
      isRecord: (value) => typeof value === "object" && value !== null && !Array.isArray(value),
      pushNotificationEvent: async () => ({
        delivered: 0,
        failed: 0,
        outcome: "not_subscribed",
      }),
      readRequiredString: (value) => String(value),
      readRows: (value) => Array.isArray(value) ? value : [],
    }
  );

  const result = await helpers.deliverPendingRmaNotifications({
    requestId: "request-1",
    sourceAction: "customer_mark_shipped",
    status: "return_in_transit",
  });

  assert.equal(result.eventCount, 21);
  assert.equal(result.pushStatus, "not_subscribed");
  assert.deepEqual(batchLengths, [20, 1, 0]);
  assert.equal(rows.every((row) => typeof row.push_attempted_at === "string"), true);
});

test("every customer-visible RMA mutation path attempts outbox delivery non-fatally", () => {
  assert.match(submitHttp, /submitRmaRequest[\s\S]*deliverPendingRmaNotifications\(\{[\s\S]*sourceAction: "customer_submit"/);
  assert.match(actionsRoute, /performAdminRmaAction[\s\S]*deliverPendingRmaNotifications/);
  assert.match(actionsRoute, /isReviewAction[\s\S]*\? "review_status_change"[\s\S]*: parsedBody\.data\.action/);
  assert.match(legacyReviewRoute, /updateAdminRmaRequest[\s\S]*sourceAction: "review_status_change"/);
  assert.match(walletRoute, /approveAdminWalletRefundRequest[\s\S]*sourceAction: "wallet_refund_approved"[\s\S]*status: "refunded"/);

  for (const source of [submitHttp, actionsRoute, legacyReviewRoute, walletRoute]) {
    assert.match(source, /notificationWarning/);
    assert.match(source, /notification failed/);
  }
});

test("customer shipment creates one deterministic staff action event and then dispatches it", () => {
  const notificationStart = notifications.indexOf(
    "export async function notifyRmaCustomerShipped"
  );
  const notificationEnd = notifications.indexOf(
    "async function createAndPushNotifications",
    notificationStart
  );
  const shipmentNotification = notifications.slice(notificationStart, notificationEnd);

  assert.match(shippedRoute, /markRmaShipped[\s\S]*notifyRmaCustomerShipped/);
  assert.match(shippedRoute, /notificationWarning/);
  for (const permission of [
    "rma.inventory",
    "product.adjust_stock",
    "inventory.manage",
    "rma.manage",
    "orders.manage",
  ]) {
    assert.match(shipmentNotification, new RegExp(`"${permission.replace(".", "\\.")}"`));
  }
  assert.match(shipmentNotification, /deterministicNotificationUuid/);
  assert.match(shipmentNotification, /event_type: "rma_action_required"/);
  assert.match(shipmentNotification, /action: "mark_received"/);
  assert.match(shipmentNotification, /status: "return_in_transit"/);
  assert.match(shipmentNotification, /\.upsert\(rows, \{ ignoreDuplicates: true, onConflict: "id" \}\)/);
  assert.match(shipmentNotification, /deliverPendingRmaNotifications/);
});

test("staff shipment recipients include receive and RMA management permission aliases", async () => {
  let requestedPermissions = [];
  const helpers = loadNotificationHelpers(["notifyRmaCustomerShipped"], {
    listStaffRecipients: async (permissions) => {
      requestedPermissions = permissions;
      return [];
    },
  });

  const result = await helpers.notifyRmaCustomerShipped({ requestId: "request-1" });
  assert.deepEqual(
    Array.from(requestedPermissions),
    [
      "rma.inventory",
      "product.adjust_stock",
      "inventory.manage",
      "rma.manage",
      "orders.manage",
    ]
  );
  assert.equal(result.pushStatus, "not_applicable");
});

test("push outcome reports failure, no subscription and partial delivery without saying sent", () => {
  const helpers = loadNotificationHelpers([
    "pushNotificationOutcome",
    "summarizePushNotificationOutcomes",
  ]);

  assert.equal(
    helpers.pushNotificationOutcome({ delivered: 0, failed: 0, subscriptions: 0 }),
    "not_subscribed"
  );
  assert.equal(
    helpers.pushNotificationOutcome({ delivered: 0, failed: 2, subscriptions: 2 }),
    "failed"
  );
  assert.equal(
    helpers.pushNotificationOutcome({ delivered: 1, failed: 1, subscriptions: 2 }),
    "partial"
  );
  assert.equal(
    helpers.summarizePushNotificationOutcomes(["delivered", "not_subscribed"]),
    "partial"
  );
  assert.equal(
    helpers.summarizePushNotificationOutcomes(["partial", "not_subscribed"]),
    "partial"
  );

  for (const route of [submitHttp, shippedRoute, actionsRoute, legacyReviewRoute, walletRoute]) {
    assert.doesNotMatch(route, /notification:\s*notificationWarning \? "failed" : "sent"/);
    assert.match(route, /delivery\.pushStatus/);
  }
});

test("a late shipped replay does not create a stale receiving reminder after receipt", () => {
  assert.match(
    shippedRoute,
    /if \(data\.status === "approved" && data\.customerShippedAt\)[\s\S]*notifyRmaCustomerShipped/
  );
});

test("approved push copy tells the customer how to continue the return", () => {
  assert.match(
    notifications,
    /eventType === "rma_submitted" && audience === "customer"[\s\S]*Richiesta di reso inviata/
  );
  assert.match(
    notifications,
    /approved:[\s\S]*Apri Resi; se mancano indirizzo o modalità di restituzione, contatta prima l'assistenza[\s\S]*Conferma “Ho spedito il reso” solo dopo la spedizione/
  );
  assert.match(notifications, /targetPath/);
  assert.match(notifications, /rmaCopy\?\.body/);
  assert.match(notifications, /rmaCopy\?\.title/);
});

test("wallet request copy uses source action because the workflow status remains received", () => {
  assert.match(
    notifications,
    /sourceAction === "request_wallet_refund"[\s\S]*richiesta di rimborso wallet è stata creata ed è in attesa di approvazione/
  );
  assert.match(
    notifications,
    /select\("id, audience, body, created_at, event_type, payload, read_at, source_action, target_path, title"\)/
  );
  assert.match(notifications, /sourceAction: readString\(row\.source_action\)/);
});

test("wallet delivery is limited to a canonical RMA refund reference", () => {
  assert.match(walletRoute, /refund\.requestType !== "rma_return"/);
  assert.match(repository, /rmaRequestId: pickString\(row, \["rma_request_id", "rmaRequestId"\]\)/);
  assert.match(walletRoute, /safeParse\(refund\.rmaRequestId\)/);
  assert.doesNotMatch(walletRoute, /metadata\.rma_request_id/);
  assert.match(walletRoute, /let notification: RmaNotificationPushStatus = "not_applicable"/);
  assert.match(walletRoute, /if \(rmaRequestId\)[\s\S]*notification = delivery\.pushStatus/);
});

function loadNotificationHelpers(names, bindings = {}) {
  const sourceFile = typescript.createSourceFile(
    "partspro-notifications.ts",
    notifications,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TS
  );
  const declarations = new Map();
  const visit = (node) => {
    if (typescript.isFunctionDeclaration(node) && node.name) {
      declarations.set(node.name.text, node.getText(sourceFile));
    }
    typescript.forEachChild(node, visit);
  };
  visit(sourceFile);
  const source = names.map((name) => {
    assert.ok(declarations.has(name), `${name} is required`);
    return declarations.get(name);
  }).join("\n");
  const compiled = typescript.transpileModule(
    `${source}\nglobalThis.helpers = { ${names.join(", ")} };`,
    {
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2022,
      },
    }
  );
  const context = { exports: {}, module: { exports: {} }, ...bindings };
  vm.runInNewContext(compiled.outputText, context);
  return context.helpers;
}

function notificationClient(rows, batchLengths) {
  return {
    from(table) {
      assert.equal(table, "notification_events");
      return new NotificationQuery(rows, batchLengths);
    },
  };
}

class NotificationQuery {
  constructor(rows, batchLengths) {
    this.rows = rows;
    this.batchLengths = batchLengths;
    this.filters = [];
    this.containsFilter = null;
    this.limitValue = Number.POSITIVE_INFINITY;
    this.operation = "select";
    this.payload = null;
  }

  select() {
    return this;
  }

  update(payload) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  contains(column, value) {
    this.containsFilter = { column, value };
    return this;
  }

  order() {
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  maybeSingle() {
    const row = this.filteredRows()[0] ?? null;
    if (row && this.operation === "update") {
      Object.assign(row, this.payload);
    }
    return Promise.resolve({ data: row ? { ...row } : null, error: null });
  }

  then(resolve, reject) {
    const data = this.filteredRows().slice(0, this.limitValue).map((row) => ({ ...row }));
    this.batchLengths.push(data.length);
    return Promise.resolve({ data, error: null }).then(resolve, reject);
  }

  filteredRows() {
    return this.rows.filter((row) => {
      if (!this.filters.every((filter) => filter(row))) {
        return false;
      }
      if (!this.containsFilter) {
        return true;
      }
      const source = row[this.containsFilter.column];
      return Object.entries(this.containsFilter.value).every(
        ([key, value]) => source?.[key] === value
      );
    });
  }
}
