import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as ts from "typescript";

function component(path, name) {
  const ast = ts.createSourceFile(path, readFileSync(new URL(`../src/components/partspro/${path}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = ast.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
  assert.ok(node, name);
  return { ast, node };
}
function local({ ast, node }, name) {
  let found;
  function visit(item) {
    if ((ts.isVariableDeclaration(item) || ts.isFunctionDeclaration(item)) && item.name?.getText(ast) === name) found = item;
    ts.forEachChild(item, visit);
  }
  visit(node.body);
  assert.ok(found, name);
  return found;
}
function evaluate(code, globals = {}) {
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, ...globals });
  return exports;
}
const finance = component("admin-finance-panel.tsx", "FinanceEntryDialog");

test("finance server aliases point aria-describedby to visible original field errors", () => {
  const fieldErrors = { amountNet: "Net", amountGross: "Gross", notes: "Note", category: "Category", status: "Status", batchId: "Batch" };
  const { fieldProps } = evaluate(`const ${local(finance, "fieldProps").getText(finance.ast)}; export { fieldProps };`, { fieldErrors, id: "entry" });
  for (const field of ["category", "status", "batchId"]) {
    assert.equal(fieldProps(field).id, `entry-${field}`);
    assert.equal(fieldProps(field)["aria-invalid"], true);
    assert.equal(fieldProps(field)["aria-describedby"], `entry-${field}-error`);
  }
  assert.equal(fieldProps("amountNet")["aria-describedby"], "entry-amountNet-error entry-amountGross-error");
  assert.equal(fieldProps("note")["aria-describedby"], "entry-notes-error");
  assert.equal(fieldProps("vatAmount")["aria-invalid"], false);
});

test("finance error summary deduplicates aliases and never links a hidden field", () => {
  const code = ["visibleFields", "summaryMessages"].map(name => `const ${local(finance, name).getText(finance.ast)};`).join("\n") + "\nexport { summaryMessages };";
  const fieldErrors = { amountNet: "Money", amountGross: "Money", notes: "Required", note: "Required", batchId: "Batch", status: "Status" };
  const { summaryMessages } = evaluate(code, { fieldErrors, isExpense: true, editing: true });
  assert.deepEqual(JSON.parse(JSON.stringify(summaryMessages)), { amountNet: ["Money"], note: ["Required"], status: ["Status"] });
});

test("editing finance money or notes clears only related alias errors and preserves draft", () => {
  let errors = { amountNet: "Net", amountGross: "Gross", notes: "Notes", category: "Category" };
  let form = { amountNet: "10,00", vatAmount: "2,20", note: "Original", category: "Other" };
  const { updateField } = evaluate(`const ${local(finance, "updateField").getText(finance.ast)}; export { updateField };`, {
    setForm: update => { form = update(form); }, setFieldErrors: update => { errors = update(errors); },
  });
  updateField("vatAmount", "1,00");
  assert.equal(errors.amountGross, ""); assert.equal(errors.amountNet, "Net"); assert.equal(errors.category, "Category");
  updateField("note", "Corrected");
  assert.equal(errors.notes, ""); assert.equal(form.amountNet, "10,00"); assert.equal(form.note, "Corrected");
});

test("support 2xx bad detail is acknowledged once and keeps saved-warning during failed reread", async () => {
  const support = component("admin-support-panel.tsx", "AdminSupportPanel");
  let writes = 0, notice, draft = { conversation: "Reply" }, detail = { conversation: { id: "conversation" } };
  const attempts = { current: {} };
  const globals = {
    detail, selectedId: "conversation", selectedIdRef: { current: "conversation" }, isLoadingDetail: false, pendingAction: null, reply: "Reply", locale: "zh-CN",
    copy: { unavailable: "Unavailable", sendFailed: "Failed" }, supportDetailMatches: () => true,
    crypto: { randomUUID: () => "request-1" }, replyAttempts: attempts, setPendingAction() {},
    fetch: async () => { writes++; return { ok: true, json: async () => { throw new SyntaxError("bad JSON"); } }; },
    readDetail: () => { throw Error("Missing detail"); }, setDetail: value => { detail = value; }, setAssignee() {},
    setReplyDrafts: update => { draft = update(draft); }, acknowledgeConversationDraft: (current, id, sent) => ({ ...current, [id]: current[id] === sent ? "" : current[id] }),
    setNotice: value => { notice = value; }, refreshList() {}, refreshInbox() {},
    refreshDetail: async (_id, _signal, savedNotice) => { notice = savedNotice; },
  };
  const { sendReply } = evaluate(`${local(support, "sendReply").getText(support.ast)}\nexport { sendReply };`, globals);
  await sendReply({ preventDefault() {} });
  assert.equal(writes, 1); assert.equal(draft.conversation, ""); assert.equal(attempts.current.conversation, undefined);
  assert.equal(detail, null); assert.equal(notice.tone, "warning"); assert.match(notice.message, /消息已发送/);
  const refresh = local(support, "refreshDetail");
  const callback = refresh.initializer.arguments[0].getText(support.ast);
  let rereadNotice;
  const { read } = evaluate(`export const read = ${callback};`, { ...globals, detailRevision: { current: 0 }, setIsLoadingDetail() {}, setNotice: value => { rereadNotice = value; }, fetch: async () => { throw Error("Read unavailable"); } });
  await read("conversation", undefined, notice);
  assert.equal(rereadNotice, notice);
});
