import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as ts from "typescript";

function source(path, kind = ts.ScriptKind.TSX) {
  return ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, kind);
}
function evaluate(code, globals = {}) {
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, Object, ...globals });
  return exports;
}
function functions(ast, names, globals) {
  const code = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join("\n");
  return evaluate(`${code}\nexport { ${names.join(",")} };`, globals);
}

test("REMAX progress and inventory effects translate without translating batch identifiers or quantities", () => {
  const { remaxText } = evaluate(readFileSync(new URL("../src/lib/admin-remax-copy.ts", import.meta.url), "utf8"));
  const imported = "Lotto {batchCode} importato. Le quantità sono ancora “in arrivo”, non stock fisico.";
  const values = { batchCode: "REMAX-IT-{received}" };
  assert.equal(remaxText(imported, "zh-CN", values), "批次 REMAX-IT-{received} 已导入。数量仍为“在途”，尚未增加真实库存。");
  assert.equal(remaxText(imported, "it", values), "Lotto REMAX-IT-{received} importato. Le quantità sono ancora “in arrivo”, non stock fisico.");
  assert.equal(remaxText("Arrivo registrato: {received} pezzi, {allocated} assegnati ai preordini.", "zh-CN", { received: 12, allocated: 9 }), "到货已登记：共 12 件，其中 9 件已分配给预购订单。");
  assert.equal(remaxText("Ci sono {count} righe da correggere.", "zh-CN", { count: 4 }), "有 4 行需要修正。");
  assert.equal(remaxText("Il file supera il limite di 500 righe.", "zh-CN"), "文件超过 500 行的上限。");
  assert.equal(remaxText("qty_ordered deve essere un intero tra 1 e 500", "zh-CN"), "qty_ordered 须为 1 至 500 的整数");
  assert.equal(remaxText("REMAX arrival could not be registered.", "it"), "Registrazione arrivo REMAX non riuscita.");
});

test("audit object links require destination panel and read permissions and never turn customer IDs into account IDs", () => {
  const ast = source("src/components/partspro/admin-activity-timeline.tsx");
  const { activityTarget } = functions(ast, ["activityTarget"], { encodeURIComponent });
  const id = "00000000-0000-4000-8000-000000000001";
  const activity = { type: "order-status", entityType: "order", entityId: id };
  assert.equal(activityTarget(activity, ["orders.read"]), null);
  assert.equal(activityTarget(activity, ["panel.orders"]), null);
  assert.equal(activityTarget(activity, ["panel.orders", "orders.read"]).href, `/admin?panel=orders&orderId=${id}`);
  assert.equal(activityTarget({ ...activity, entityId: "invalid" }, ["panel.orders", "orders.read"]), null);
  const customer = { ...activity, entityType: "customer" };
  assert.equal(activityTarget(customer, ["customers.read", "panel.accounts"]), null);
  assert.equal(activityTarget(customer, ["customers.read", "panel.orders", "orders.read"]).href, `/admin?panel=orders&customerId=${id}`);
  assert.equal(activityTarget({ ...activity, entityType: "finance_expense" }, ["panel.orders", "orders.read"]), null);
  assert.equal(activityTarget({ ...activity, entityType: "finance_expense" }, ["panel.finance", "finance.read"]).href, "/admin?panel=finance");
  assert.equal(activityTarget({ ...activity, entityType: "product", sku: "ABC A&B" }, ["panel.catalog", "product.read_admin"]).href, "/admin?panel=catalog&sku=ABC%20A%26B");
  assert.equal(activityTarget({ ...activity, entityType: "rma" }, ["orders.read"]), null);
  assert.equal(activityTarget({ ...activity, entityType: "rma" }, ["rma.read"]).href, "/admin?panel=rma");
  assert.equal(activityTarget({ ...activity, type: "note" }, ["panel.orders", "orders.read"]), null);
  assert.equal(activityTarget({ ...activity, entityType: "unknown" }, ["panel.orders", "orders.read"]), null);
});

test("shortage operational states remain distinct in Chinese and Italian", () => {
  const ast = source("src/components/partspro/admin-orders-panel.tsx");
  const { orderLineOperationalLabel } = functions(ast, ["orderLineOperationalLabel"]);
  for (const [line, zh, it] of [
    [{ quantity: 5, cancelledQty: 5, pickedQty: 0 }, "缺货核销", "Annullato per mancanza"],
    [{ quantity: 5, cancelledQty: 1, pickedQty: 4 }, "部分缺货", "Mancanza parziale"],
    [{ quantity: 5, cancelledQty: 0, pickedQty: 5 }, "已确认", "Confermato"],
    [{ quantity: 5, cancelledQty: 0, pickedQty: 0 }, "默认全给", "Consegna completa prevista"],
  ]) {
    assert.equal(orderLineOperationalLabel(line, "zh-CN"), zh);
    assert.equal(orderLineOperationalLabel(line, "it"), it);
  }
});

test("order identifiers and search survive module remounts in memory without browser storage", () => {
  const workspace = { userId: "staff", queries: new Map() };
  let storageCalls = 0;
  const React = { useContext: () => workspace, useState: init => [typeof init === "function" ? init() : init, () => {}], useEffect: effect => effect(), useCallback: value => value };
  const ast = source("src/components/partspro/admin-workspace-state.tsx");
  const { useAdminMemoryValue } = functions(ast, ["restoreShape", "usePersistentAdminQuery", "useAdminMemoryQuery", "useAdminMemoryValue"], { React, Context: {}, window: {}, sessionStorage: { getItem() { storageCalls++; }, setItem() { storageCalls++; } } });
  workspace.queries.set("orders.selectedOrderId", { value: "order-3" });
  workspace.queries.set("orders.query", { value: "customer question" });
  assert.equal(useAdminMemoryValue("orders.selectedOrderId", "")[0], "order-3");
  assert.equal(useAdminMemoryValue("orders.query", "")[0], "customer question");
  assert.equal(storageCalls, 0);
});
