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
const { Info, TriangleAlert, CircleAlert } = require("lucide-react");

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");
const panel = read("src/components/partspro/admin-rma-panel.tsx");

test("admin panel exposes three server views and separate mobile detail", () => {
  assert.match(panel, /\["review", "active", "archive"\]/);
  assert.match(panel, /String\(page \* 80\), view/);
  assert.match(panel, /role="tablist"/);
  assert.match(panel, /<div key=\{request\.id\} role="listitem">/);
  assert.match(panel, /setMobileDetail\(true\)/);
  assert.match(panel, /setMobileDetail\(false\)/);
  assert.match(panel, /hidden xl:block/);
  assert.doesNotMatch(panel, /ACTIVE_QUEUE_TABS/);
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
  const rmaActionHandler = panel.split("async function runAction(")[1]?.split("async function approveWalletRefund(")[0];
  assert.ok(rmaActionHandler);
  assert.doesNotMatch(rmaActionHandler, /method: "PATCH"/);
  const walletApprovalHandler = panel.split("async function approveWalletRefund(")[1]?.split("const showDirectReceipt")[0];
  assert.match(walletApprovalHandler, /\/api\/admin\/wallet-refunds\//);
  assert.match(walletApprovalHandler, /method: "PATCH"/);
  assert.match(walletApprovalHandler, /canApproveWalletRefund/);
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

test("graphical workflow distinguishes awaiting return, exemption and completed goods", () => {
  for (const locale of ["zh-CN", "it", "en"]) {
    const waiting = renderFlow(waitingRequest(), locale);
    assert.match(waiting, locale === "zh-CN" ? /等待客户寄回/ : locale === "it" ? /In attesa del reso/ : /Awaiting customer return/);
    const exempt = renderFlow(waitingRequest({returnWaivedAt:"now"}), locale);
    assert.match(exempt, locale === "zh-CN" ? /无需退回/ : locale === "it" ? /Reso non richiesto/ : /No return required/);
    assert.doesNotMatch(waiting + exempt, /role="alert"|waiting_customer_return/);
  }
});

test("workflow and refund blockers have stable localized labels and unknown codes fail closed", () => {
  const helpers = loadAdminHelpers(["rmaReasonLabel"]);
  for (const locale of ["it", "zh"]) {
    const copy=helpers.rmaCopy[locale];
    for (const reason of [...rmaWorkflowBlockedReasons,"missing_unit_price_snapshot","wallet_balance_exhausted","invalid_snapshot"]) {
      const label=helpers.rmaReasonLabel(reason,copy);
      assert.ok(label.length>10);
      assert.notEqual(label,copy.unknownBlocker);
      assert.ok(!label.includes(reason));
    }
    for (const reason of [null,undefined,"future_internal_code","toString","__proto__"]) assert.equal(helpers.rmaReasonLabel(reason,copy),copy.unknownBlocker);
  }
  assert.match(panel,/rmaReasonLabel\(selectedRequest.blockedReason, copy\)/);
});

test("completed workflow does not claim physical receipt for refund-only cases", () => {
 const html=renderFlow(waitingRequest({status:"closed",returnWaivedAt:"now",refundCompletedAt:"now"}),"zh-CN");
 assert.match(html,/完成/);assert.match(html,/无需退回/);assert.doesNotMatch(html,/已收货|待处置/);
});

function renderFlow(request,locale) {
 const code=typescript.transpileModule(read("src/components/partspro/admin-rma-flow.tsx"),{compilerOptions:{module:typescript.ModuleKind.CommonJS,target:typescript.ScriptTarget.ES2022,jsx:typescript.JsxEmit.ReactJSX}}).outputText;
 const loadedModule={exports:{}};
 vm.runInNewContext(code,{module:loadedModule,exports:loadedModule.exports,require:(name)=>name==="@/lib/utils"?{cn:(...x)=>x.filter(Boolean).join(" ")}:name.startsWith("@/components/ui/")?{}:require(name)});
 return renderToStaticMarkup(React.createElement(loadedModule.exports.AdminRmaFlow,{request,locale}));
}

test("physical receipt confirmation follows server authorization before or after refund", () => {
  const { canReceiveDirectly } = loadAdminHelpers(["canReceiveDirectly"]);
  assert.equal(canReceiveDirectly(waitingRequest()), true);
  for (const request of [
    null,
    waitingRequest({ availableActions: [] }),
    waitingRequest({ availableActions: ["assign"] }),
    waitingRequest({ blockedReason: "permission_denied" }),
    waitingRequest({ blockedReason: "invalid_state" }),
    waitingRequest({ status: "closed" }),
    waitingRequest({ returnWaivedAt: "now" }),
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
    [waitingRequest({ status: "closed" }), request, false],
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
  assert.match(panel, /aria-haspopup="dialog"/);
  assert.match(panel, /<DialogTitle>\{copy\.confirmReceived\}<\/DialogTitle>/);
  assert.match(panel, /<DialogDescription>\{copy\.directReceiptConfirmation\}<\/DialogDescription>/);
  assert.match(panel, /onClick=\{confirmDirectReceipt\}/);
  assert.match(panel, /disabled=\{!canConfirmDirectReceipt\(selectedRequest, directReceiptRequest\) \|\| isDetailLoading \|\| Boolean\(pendingAction\)\}/);
  assert.doesNotMatch(panel, /window\.confirm/);
});

function waitingRequest(overrides = {}) {
  return {
    status: "approved", id: "request-1", rmaNo: "RMA-TEST-001", productName: "Test replacement screen", quantity: 2,
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
  const feedbackSource = typescript.createSourceFile("admin-feedback.tsx", read("src/components/partspro/admin-feedback.tsx"), typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TSX);
  const noticeSource = feedbackSource.statements.find(node => typescript.isFunctionDeclaration(node) && node.name?.text === "AdminNotice").getText(feedbackSource);
  const compiled = typescript.transpileModule(`${noticeSource}\n${copySource}\n${helperSource}\nglobalThis.helpers = { rmaCopy, ${names.join(", ")} };`, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022, jsx: typescript.JsxEmit.React },
  });
  const context = { exports: {}, setLocation() {}, setActionReason() {}, setCustomerConfirmation() {}, setActionQuantity() {}, setReturnTracking() {}, setReturnCarrier() {}, setReplacementOrderNumber() {}, React, Clock3, CheckCircle2, ShieldAlert, noticeIcons: { info: Info, success: CheckCircle2, warning: TriangleAlert, error: CircleAlert }, cn: (...classes) => classes.filter(Boolean).join(" "), ...bindings };
  vm.runInNewContext(compiled.outputText, context);
  return context.helpers;
}


test("failed network actions reuse the same idempotency key and successful new actions receive a new key", async () => {
  const request = waitingRequest({availableActions:["split_request"]});
  const sent=[]; let fail=true; let next=0;
  const {runAction}=loadAdminHelpers(["runAction"], {
    selectedRequest:request,selectedDetail:null,selectedId:request.id,
    pendingActionRef:{current:null},actionRetryKeysRef:{current:new Map()},
    setPendingAction(){},setRequests(){},setSelectedDetail(){},setNotice(){},setActionDialog(){},
    requiresCompleteQuantity:()=>false,createClientId:()=>`test-key-${++next}`,
    copy:{updated:'Error',actionDone:'Done'}, refresh:async()=>{},loadDetail:async()=>true,
    fetch:async(_url, options)=>{sent.push(JSON.parse(options.body));if(fail)throw Error('Response lost');return {ok:true,json:async()=>({data:request})};},
  });
  await runAction('split_request',{quantity:1,reason:'Partial receipt'});
  fail=false;
  await runAction('split_request',{quantity:1,reason:'Partial receipt'});
  assert.equal(sent[0].idempotencyKey,sent[1].idempotencyKey);
  await runAction('split_request',{quantity:1,reason:'Partial receipt'});
  assert.notEqual(sent[1].idempotencyKey,sent[2].idempotencyKey);
});
