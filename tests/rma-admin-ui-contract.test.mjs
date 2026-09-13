import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import { rmaWorkflowBlockedReasons } from "../src/lib/partspro-rma-workflow-rules.mjs";

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { Clock3, CheckCircle2, ShieldAlert } = require("lucide-react");

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
  assert.match(panel, /<div key=\{request\.id\} role="listitem">/);
  assert.match(panel, /<button[\s\S]*aria-current=\{selectedId === request\.id/);
  assert.doesNotMatch(panel, /<button[^>]*role="listitem"/);
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
  assert.match(panel, /Dialog open=\{actionDialog === "receive"\}/);
  assert.match(panel, /Dialog open=\{actionDialog === "reject"\}/);
  assert.match(panel, /Dialog open=\{actionDialog === "qc"\}/);
  assert.match(panel, /Dialog open=\{actionDialog === "refund"\}/);
  assert.match(panel, /Dialog open=\{actionDialog === "replacement"\}/);
  assert.match(panel, /Dialog open=\{actionDialog === "inventory"\}/);
  assert.match(panel, /action !== "assign"/);
  assert.match(panel, /selectedRequest\.availableActions\.includes\("assign"\)/);
  assert.match(panel, /recommendedAction === "choose_inventory_disposition"/);
});

test("waiting for the customer return is a localized normal status, with or without receiving permission", () => {
  const helpers = loadAdminHelpers(["workflowNoticeFor", "rmaReasonLabel", "WorkflowNotice"]);
  for (const locale of ["it", "zh"]) {
    const copy = helpers.rmaCopy[locale];
    for (const availableActions of [[], ["assign"], ["mark_received", "assign"]]) {
      const notice = helpers.workflowNoticeFor(waitingRequest({ availableActions }), copy);
      assert.equal(notice.tone, "waiting");
      assert.equal(notice.title, copy.waitingCustomerReturn);
      assert.equal(notice.message, copy.reasons.waiting_customer_return);
      const html = renderToStaticMarkup(React.createElement(helpers.WorkflowNotice, { notice }));
      assert.match(html, /role="status"/);
      assert.match(html, /aria-live="polite"/);
      assert.match(html, /lucide-clock/);
      assert.doesNotMatch(html, /Bloccato|已阻塞|waiting_customer_return|role="alert"/);
      assert.match(html, locale === "zh" ? /等待客户寄回[\s\S]*确认已寄出/ : /In attesa del reso del cliente[\s\S]*confermi di averla spedita/);
    }
  }
});

test("workflow and refund blockers have stable bilingual labels and unknown codes fail closed", () => {
  const helpers = loadAdminHelpers(["workflowNoticeFor", "rmaReasonLabel", "WorkflowNotice"]);
  for (const locale of ["it", "zh"]) {
    const copy = helpers.rmaCopy[locale];
    for (const reason of [...rmaWorkflowBlockedReasons, "missing_unit_price_snapshot", "wallet_balance_exhausted", "invalid_snapshot"]) {
      const label = helpers.rmaReasonLabel(reason, copy);
      assert.equal(typeof label, "string");
      assert.ok(label.length > 10, `${locale} must explain ${reason}`);
      assert.notEqual(label, copy.unknownBlocker, `${locale} must explicitly translate ${reason}`);
      assert.ok(!label.includes(reason));
    }
    for (const reason of [null, undefined, "future_internal_code", "toString", "__proto__"]) {
      assert.equal(helpers.rmaReasonLabel(reason, copy), copy.unknownBlocker);
    }
    for (const blockedReason of ["permission_denied", "partial_received_quantity", "invalid_state", "future_internal_code"]) {
      const notice = helpers.workflowNoticeFor(waitingRequest({ blockedReason }), copy);
      assert.equal(notice.tone, "blocked", "queue alone must not hide an actual blocker");
      assert.equal(notice.title, copy.blocked);
      const html = renderToStaticMarkup(React.createElement(helpers.WorkflowNotice, { notice }));
      assert.match(html, /role="alert"/);
      assert.ok(!html.includes(blockedReason));
    }
    assert.match(copy.reasons.permission_denied, locale === "zh" ? /权限.*负责人/ : /permesso.*responsabile/);
  }
  assert.match(panel, /rmaReasonLabel\(refundPreview\?\.blockedReason, copy\)/);
  assert.match(panel, /rmaReasonLabel\(selectedRequest\?\.blockedReason, copy\)/);
  assert.doesNotMatch(panel, /\{(?:selectedRequest|refundPreview)\??\.blockedReason\s*(?:\?\?|\})/);
});

test("other normal waits and completed archive requests are not mislabeled as blocked", () => {
  const helpers = loadAdminHelpers(["workflowNoticeFor", "rmaReasonLabel"]);
  for (const copy of Object.values(helpers.rmaCopy)) {
    for (const blockedReason of ["waiting_wallet_approval", "waiting_qc"]) {
      assert.equal(helpers.workflowNoticeFor(waitingRequest({ blockedReason }), copy).tone, "waiting");
    }
    assert.equal(helpers.workflowNoticeFor({ workflowQueue: "archive", blockedReason: null }, copy).tone, "complete");
    assert.equal(helpers.workflowNoticeFor({ workflowQueue: "archive", blockedReason: "permission_denied" }, copy).tone, "blocked");
    assert.equal(helpers.workflowNoticeFor({ workflowQueue: "review", blockedReason: null }, copy).tone, "blocked");
  }
});

test("direct receiving is only offered for the server-authorized customer-return wait", () => {
  const { canReceiveDirectly } = loadAdminHelpers(["canReceiveDirectly"]);
  assert.equal(canReceiveDirectly(waitingRequest()), true);
  for (const request of [
    null,
    waitingRequest({ availableActions: [] }),
    waitingRequest({ availableActions: ["assign"] }),
    waitingRequest({ blockedReason: "permission_denied" }),
    waitingRequest({ blockedReason: "invalid_state" }),
    waitingRequest({ workflowQueue: "receiving", recommendedAction: "mark_received", blockedReason: null }),
  ]) {
    assert.equal(canReceiveDirectly(request), false);
  }
  assert.match(panel, /const showDirectReceipt = canReceiveDirectly\(selectedRequest\)/);
  assert.match(panel, /!\(showDirectReceipt && action === "mark_received"\)/, "the same action should not also appear as an unconfirmed secondary action");
});

test("direct receiving requires a second confirmation bound to the same request and quantity", () => {
  const request = waitingRequest();
  const dialogs = [];
  const submitted = [];
  const helpers = loadAdminHelpers([
    "canReceiveDirectly", "canConfirmDirectReceipt", "completeQuantity", "triggerAction", "confirmDirectReceipt",
  ], {
    selectedRequest: request,
    directReceiptRequest: { ...request },
    isDetailLoading: false,
    openActionDialog: (dialog) => dialogs.push(dialog),
    runAction: (action) => submitted.push(action),
  });
  helpers.triggerAction("mark_received");
  assert.deepEqual(dialogs, ["receive"]);
  assert.deepEqual(submitted, [], "opening the confirmation must not mutate the RMA");
  assert.equal(helpers.canConfirmDirectReceipt(request, { ...request }), true);
  helpers.confirmDirectReceipt();
  assert.deepEqual(submitted, ["mark_received"], "confirmation uses the existing guarded action");

  for (const [selectedRequest, directReceiptRequest, isDetailLoading] of [
    [request, null, false],
    [null, request, false],
    [waitingRequest({ id: "different-request" }), request, false],
    [waitingRequest({ quantity: 3 }), request, false],
    [waitingRequest({ availableActions: [] }), request, false],
    [waitingRequest({ blockedReason: "permission_denied" }), request, false],
    [waitingRequest({ workflowQueue: "receiving", recommendedAction: "mark_received", blockedReason: null }), request, false],
    [request, request, true],
  ]) {
    const calls = [];
    const blocked = loadAdminHelpers(["canReceiveDirectly", "canConfirmDirectReceipt", "completeQuantity", "confirmDirectReceipt"], {
      selectedRequest, directReceiptRequest, isDetailLoading,
      runAction: (action) => calls.push(action),
    });
    blocked.confirmDirectReceipt();
    assert.deepEqual(calls, [], "stale, revoked, changed or loading selections cannot be confirmed");
  }
  assert.match(panel, /!request\.availableActions\.includes\(action\)/);
  assert.match(panel, /pendingActionRef\.current/);
  assert.match(panel, /body\.quantity = completeQuantity\(request\)/);
});

test("opening direct receipt captures a fixed confirmation summary and refuses revoked or loading actions", () => {
  const request = waitingRequest();
  const dialogs = [];
  let confirmation;
  const { openActionDialog } = loadAdminHelpers(["openActionDialog", "canReceiveDirectly"], {
    selectedRequest: request, selectedDetail: null, selectedId: request.id, isDetailLoading: false,
    setDirectReceiptRequest: (value) => { confirmation = value; },
    setActionDialog: (value) => dialogs.push(value),
  });
  openActionDialog("receive");
  assert.deepEqual(dialogs, ["receive"]);
  assert.equal(confirmation.id, request.id);
  assert.equal(confirmation.quantity, 2);
  request.quantity = 3;
  assert.equal(confirmation.quantity, 2, "the dialog must not silently confirm a changed quantity");
  for (const [selectedRequest, isDetailLoading] of [[waitingRequest({ availableActions: [] }), false], [waitingRequest(), true]]) {
    const opened = [];
    const helpers = loadAdminHelpers(["openActionDialog", "canReceiveDirectly"], {
      selectedRequest, isDetailLoading,
      setDirectReceiptRequest: () => opened.push("snapshot"),
      setActionDialog: (value) => opened.push(value),
    });
    helpers.openActionDialog("receive");
    assert.deepEqual(opened, []);
  }
});

test("direct receipt copy and controls are responsive, descriptive and explicit about physical receipt", () => {
  const { rmaCopy } = loadAdminHelpers([]);
  assert.match(rmaCopy.zh.directReceiptDescription, /全部商品已实际到达.*仍在运输中/);
  assert.match(rmaCopy.it.directReceiptDescription, /tutta la merce.*già arrivata.*ancora in viaggio/);
  assert.match(rmaCopy.zh.directReceiptConfirmation, /不会自动通过质检.*不会回补库存/);
  assert.match(rmaCopy.it.directReceiptConfirmation, /non approva il controllo qualità.*non rimette la merce a stock/);
  assert.match(panel, /aria-describedby="rma-direct-receipt-hint"/);
  assert.match(panel, /aria-haspopup="dialog"/);
  assert.match(panel, /h-auto min-h-11 w-full whitespace-normal py-2 sm:w-auto/);
  assert.match(panel, /<DialogTitle>\{copy\.confirmReceived\}<\/DialogTitle>/);
  assert.match(panel, /<DialogDescription>\{copy\.directReceiptConfirmation\}<\/DialogDescription>/);
  assert.match(panel, /onClick=\{confirmDirectReceipt\}/);
  assert.match(panel, /disabled=\{!canConfirmDirectReceipt\(selectedRequest, directReceiptRequest\) \|\| isDetailLoading \|\| Boolean\(pendingAction\)\}/);
  assert.doesNotMatch(panel, /window\.confirm/);
});

function waitingRequest(overrides = {}) {
  return {
    id: "request-1", rmaNo: "RMA-TEST-001", productName: "Test replacement screen", quantity: 2,
    workflowQueue: "awaiting_return", recommendedAction: null, blockedReason: "waiting_customer_return",
    availableActions: ["mark_received", "assign"], ...overrides,
  };
}

function loadAdminHelpers(names, bindings = {}) {
  const sourceFile = typescript.createSourceFile("admin-rma-panel.tsx", panel, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TSX);
  const declarations = new Map();
  let copySource;
  const visit = (node) => {
    if (typescript.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node);
    if (typescript.isVariableDeclaration(node) && node.name.getText(sourceFile) === "rmaCopy") copySource = `const ${node.getText(sourceFile)};`;
    typescript.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(copySource, "bilingual RMA copy is required");
  const helperSource = names.map((name) => {
    assert.ok(declarations.has(name), `${name} is required`);
    return declarations.get(name).getText(sourceFile);
  }).join("\n");
  const compiled = typescript.transpileModule(`${copySource}\n${helperSource}\nglobalThis.helpers = { rmaCopy, ${names.join(", ")} };`, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022, jsx: typescript.JsxEmit.React },
  });
  const context = { React, Clock3, CheckCircle2, ShieldAlert, cn: (...classes) => classes.filter(Boolean).join(" "), ...bindings };
  vm.runInNewContext(compiled.outputText, context);
  return context.helpers;
}
