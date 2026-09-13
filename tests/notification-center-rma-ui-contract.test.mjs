import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const component = readFileSync(join(repoRoot, "src/components/partspro/notification-center.tsx"), "utf8");
const typescript = createRequire(import.meta.url)("typescript");
const helpers = loadNotificationHelpers();

test("notification reader preserves RMA audience, event type, payload and target without inventing a customer audience", () => {
  for (const audience of ["customer", "staff"]) {
    const source = notification({ audience, sourceAction: "review_status_change", payload: { status: "approved", rma_no: "RMA-TEST-001", action: "mark_received" } });
    const data = helpers.readNotificationPayload({ data: { notifications: [source], unreadCount: 1 } });
    const item = data.notifications[0];
    assert.equal(data.unreadCount, 1);
    assert.equal(item.audience, audience);
    assert.equal(item.eventType, "rma_status_updated");
    assert.equal(item.payload, source.payload);
    assert.equal(item.sourceAction, "review_status_change");
    assert.equal(item.targetPath, source.targetPath);
  }
  for (const audience of [undefined, "unknown", null]) {
    assert.equal(helpers.readNotification(notification({ audience })).audience, null);
  }
  for (const payload of [null, [], "status=approved"]) {
    assert.equal(Object.keys(helpers.readNotification(notification({ payload })).payload).length, 0);
  }
  assert.equal(helpers.readNotification(notification({ sourceAction: 123 })).sourceAction, null);
  assert.equal(helpers.readNotification(null), null);
  assert.equal(helpers.readNotification({}), null);
});

test("submitted RMA notifications have distinct bilingual customer and staff instructions", () => {
  for (const locale of ["zh-CN", "it-IT"]) {
    const customer = content({ eventType: "rma_submitted", payload: { rma_no: "RMA-TEST-001" } }, locale);
    assert.equal(customer.isRma, true);
    assert.match(customer.body, /RMA-TEST-001/);
    assert.match(customer.title, locale === "zh-CN" ? /已提交/ : /inviata/);
    assert.match(customer.body, locale === "zh-CN" ? /等待审核/ : /attesa di verifica/);
    const staff = content({ audience: "staff", eventType: "rma_submitted", payload: { rmaNo: "RMA-TEST-002" } }, locale);
    assert.match(staff.body, /RMA-TEST-002/);
    assert.match(staff.title, locale === "zh-CN" ? /新的售后申请/ : /Nuova richiesta/);
    assert.match(staff.body, locale === "zh-CN" ? /后台售后审核/ : /amministrazione/);
  }
});

test("approved customer notifications require confirming return instructions before shipping and declaring shipment afterward", () => {
  const chinese = content({ payload: { status: "approved" } }, "zh-CN");
  assert.equal(chinese.isRma, true);
  assert.match(chinese.title, /售后/);
  assert.match(chinese.body, /已批准.*\/rma.*寄回方式或地址.*先联系客服确认.*实际寄出后.*我已寄回/);
  const italian = content({ payload: { status: "approved" } }, "it-IT");
  assert.match(italian.title, /reso/);
  assert.match(italian.body, /approvata.*\/rma.*modalità e indirizzo.*contatta prima l'assistenza.*Dopo aver spedito.*conferma.*Ho spedito il reso/);
  for (const locale of ["zh-CN", "it-IT"]) {
    const staff = content({ audience: "staff", payload: { status: "approved" } }, locale);
    assert.match(staff.body, locale === "zh-CN" ? /等待客户寄回/ : /Attendi che il cliente/);
    assert.doesNotMatch(staff.body, /点击“我已寄回”|poi conferma “Ho spedito/);
  }
});

test("wallet refund creation takes priority over the unchanged received status and never claims a completed credit", () => {
  const input = { sourceAction: "request_wallet_refund", payload: { status: "received", rma_no: "RMA-TEST-REFUND" } };
  const chinese = content(input, "zh-CN");
  assert.equal(chinese.isRma, true);
  assert.match(chinese.body, /退款申请已创建，等待审核/);
  assert.doesNotMatch(chinese.body, /商品已收到|退款已批准|已到账/);
  const italian = content(input, "it-IT");
  assert.match(italian.body, /richiesta di rimborso.*creata.*in attesa di approvazione/);
  assert.doesNotMatch(italian.body, /merce restituita è stata ricevuta|rimborso.*è stato approvato/);
  const unknownAction = content({ sourceAction: "future_action", payload: { status: "future_status" } }, "zh-CN");
  assert.equal(unknownAction.body, notification().body);
  assert.equal(unknownAction.isRma, false);
});

test("known RMA statuses translate both title and body without changing notification state or navigation", () => {
  for (const locale of ["zh-CN", "it-IT"]) {
    for (const status of ["submitted", "requested", "under_review", "approved", "rejected", "return_in_transit", "received", "refunded", "replacement_sent", "replaced", "closed"]) {
      const item = notification({ payload: { status } });
      const before = JSON.stringify(item);
      const result = helpers.notificationContent(helpers.readNotification(item), locale);
      assert.equal(result.isRma, true, status);
      assert.notEqual(result.title, item.title);
      assert.notEqual(result.body, item.body);
      assert.match(result.body, locale === "zh-CN" ? /\p{Script=Han}/u : /[a-zA-Z]/);
      assert.equal(JSON.stringify(item), before, "localization must not mark as read or change the target");
    }
  }
});

test("staff receiving reminders distinguish a customer's shipment declaration from physical receipt", () => {
  const input = {
    audience: "staff", eventType: "rma_action_required", targetPath: "/admin?panel=rma",
    payload: { action: "mark_received", status: "return_in_transit", rmaNo: "RMA-TEST-003" },
  };
  const chinese = content(input, "zh-CN");
  assert.equal(chinese.isRma, true);
  assert.match(chinese.title, /客户已确认寄回/);
  assert.match(chinese.body, /客户已确认寄出.*等待实物到达.*收到完整商品后.*登记收货/);
  const italian = content(input, "it-IT");
  assert.match(italian.title, /cliente ha confermato la spedizione/);
  assert.match(italian.body, /confermato di aver spedito.*Attendi l'arrivo.*solo dopo aver ricevuto l'intera quantità/);
  assert.doesNotMatch(chinese.body, /商品已收到/);
  assert.doesNotMatch(italian.body, /merce è stata ricevuta/);
});

test("unknown status, action, audience and non-RMA events preserve the original safe text", () => {
  for (const locale of ["zh-CN", "it-IT"]) {
    for (const overrides of [
      { payload: { status: "future_rma_status" } },
      { payload: { status: "__proto__" } },
      { payload: { status: "toString" } },
      { payload: {} },
      { audience: "unknown", payload: { status: "approved" } },
      { eventType: "rma_action_required", audience: "staff", payload: { action: "future_action" } },
      { eventType: "rma_action_required", audience: "customer", payload: { action: "mark_received" } },
      { eventType: "support_staff_reply", payload: { status: "approved" } },
    ]) {
      const item = notification(overrides);
      const result = content(overrides, locale);
      assert.equal(result.isRma, false);
      assert.equal(result.title, item.title);
      assert.equal(result.body, item.body);
    }
    const order = content({ eventType: "new_order" }, locale);
    assert.equal(order.title, locale === "zh-CN" ? "新订单" : "Nuovo ordine");
    assert.equal(order.body, notification().body);
  }
});

test("RMA instructions remain readable in the narrow popover and use the existing notification action", () => {
  assert.match(component, /const content = notificationContent\(item, locale\)/);
  assert.match(component, /\{content\.title\}/);
  assert.match(component, /\{content\.body\}/);
  assert.match(component, /!content\.isRma && "line-clamp-2"/);
  assert.match(component, /break-words/);
  assert.match(component, /focus-visible:ring-3/);
  assert.match(component, /max-h-\[320px\] overflow-y-auto/);
  assert.match(component, /void openNotification\(item\)/);
  assert.match(component, /router\.push\(item\.targetPath\)/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
});

function notification(overrides = {}) {
  return {
    id: "notification-1", audience: "customer", body: "Original server body", title: "Original server title",
    createdAt: "2026-09-13T18:00:00.000Z", eventType: "rma_status_updated", payload: { status: "approved" },
    readAt: null, sourceAction: null, targetPath: "/rma?requestId=request-1", ...overrides,
  };
}

function content(overrides, locale) {
  return helpers.notificationContent(helpers.readNotification(notification(overrides)), locale);
}

function loadNotificationHelpers() {
  const names = ["readNotificationPayload", "readNotification", "notificationContent", "rmaNotificationCopy", "isRecord"];
  const sourceFile = typescript.createSourceFile("notification-center.tsx", component, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TSX);
  const declarations = new Map();
  const visit = (node) => {
    if (typescript.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node);
    typescript.forEachChild(node, visit);
  };
  visit(sourceFile);
  const source = names.map((name) => {
    assert.ok(declarations.has(name), `${name} is required`);
    return declarations.get(name).getText(sourceFile);
  }).join("\n");
  const compiled = typescript.transpileModule(`${source}\nglobalThis.helpers = { ${names.join(", ")} };`, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  });
  const context = {};
  vm.runInNewContext(compiled.outputText, context);
  return context.helpers;
}
