import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as ts from "typescript";
import vm from "node:vm";
import { accountProfilePatchSchema, profileChangedValues, rolePermissionDifference, canCloseAccountDraft } from "../src/lib/admin-account-operation.mjs";
import { accountText, accountTemplate } from "../src/lib/admin-account-copy.mjs";

test("a phone correction on an incomplete customer does not require unrelated address fields", () => {
  const original = { companyName: "Customer", phone: "11111", shippingAddress: "", billingAddress: "", fiscalCode: "", contactName: "", pec: "" };
  const changed = profileChangedValues({ ...original, phone: "22222" }, original);
  assert.deepEqual(changed, { phone: "22222" });
  assert.equal(accountProfilePatchSchema.safeParse({ ...changed, mode: "correction", reason: "Phone corrected" }).success, true);
  assert.equal(accountProfilePatchSchema.safeParse({ ...changed, mode: "complete", reason: "Phone corrected" }).success, false);
  assert.equal(accountProfilePatchSchema.safeParse({ ...changed, reason: "Phone corrected" }).success, false);
});

test("correction requires a real changed field and a reason and never accepts identity fields", () => {
  for (const input of [{ mode: "correction", reason: "Only reason" }, { mode: "correction", phone: "22222", reason: " " }, { mode: "correction", phone: null, reason: "Fix phone" }, { mode: "correction", phone: "22222", reason: "Fix", email: "other@example.test" }, { mode: "correction", phone: "22222", reason: "Fix", customerType: "wholesale" }]) assert.equal(accountProfilePatchSchema.safeParse(input).success, false);
  const parsed = accountProfilePatchSchema.parse({ mode: "correction", pec: "", reason: "Clear PEC" });
  assert.equal(parsed.pec, ""); assert.equal("phone" in parsed, false); assert.equal("billingAddress" in parsed, false);
});

test("submitting blocks all close paths; dirty drafts can remain open or be deliberately discarded", () => {
  let prompts = 0;
  assert.equal(canCloseAccountDraft(true, true, () => { prompts += 1; return true; }), false); assert.equal(prompts, 0);
  assert.equal(canCloseAccountDraft(false, false, () => { prompts += 1; return false; }), true); assert.equal(prompts, 0);
  assert.equal(canCloseAccountDraft(false, true, () => false), false);
  assert.equal(canCloseAccountDraft(false, true, () => true), true);
});

test("role preview exposes added and removed permissions including sensitive changes", () => {
  assert.deepEqual(rolePermissionDifference(["orders.read", "orders.manage", "finance.read"], ["orders.read", "employees.manage_permissions", "finance.manage"]), { added: ["employees.manage_permissions", "finance.manage"], removed: ["finance.read", "orders.manage"] });
});

test("Italian templates preserve customer names and user-entered text verbatim", () => {
  assert.equal(accountTemplate(["搜索：", ""], ["客户 王先生"], "it-IT"), "Ricerca: 客户 王先生");
  assert.equal(accountText("客户 王先生", "it-IT"), "客户 王先生");
  assert.equal(accountText("放弃未保存的修改？", "it-IT"), "Abbandonare le modifiche non salvate?");
});

test("every account UI copy literal and template part resolves without Chinese in Italian", () => {
  const source = readFileSync(new URL("../src/components/partspro/admin-accounts-panel.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("accounts.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let checked = 0;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const parts = node.expression.text === "accountText" && ts.isStringLiteral(node.arguments[0]) ? [node.arguments[0]] : node.expression.text === "accountTemplate" && ts.isArrayLiteralExpression(node.arguments[0]) ? node.arguments[0].elements : [];
      for (const part of parts) if (ts.isStringLiteral(part) && /\p{Script=Han}/u.test(part.text)) { assert.equal(/\p{Script=Han}/u.test(accountText(part.text, "it-IT")), false, part.text); checked += 1; }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(checked > 200);
});


test("history links enter the real order panel with exact customer and return-account scope", () => {
  const source = readFileSync(new URL("../src/components/partspro/admin-accounts-panel.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("accounts.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "accountOrdersHref");
  const code = ts.transpileModule(fn.getText(ast) + "\nexport { accountOrdersHref };", { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {}; vm.runInNewContext(code, { exports, URLSearchParams });
  const all = new URL(exports.accountOrdersHref("customer", "account"), "https://example.test");
  assert.equal(all.searchParams.get("panel"), "orders"); assert.equal(all.searchParams.get("customerId"), "customer"); assert.equal(all.searchParams.get("returnAccountId"), "account"); assert.equal(all.searchParams.has("orderId"), false);
  const one = new URL(exports.accountOrdersHref("customer", "account", "order"), "https://example.test"); assert.equal(one.searchParams.get("orderId"), "order");
});
