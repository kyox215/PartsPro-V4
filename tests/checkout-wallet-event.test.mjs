import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the real JSX callback with a deferred dispatcher. React may replay
// state updaters after it has cleared SyntheticEvent.currentTarget.
const source = readFileSync(new URL("../src/components/partspro/checkout-client.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("checkout.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === "input") {
    const attribute = node.attributes.properties.find((item) =>
      ts.isJsxAttribute(item) && item.name.getText(file) === "onChange"
    );
    const expression = attribute?.initializer;
    if (expression && ts.isJsxExpression(expression) && expression.expression?.getText(file).includes("useWallet")) {
      callback = expression.expression.getText(file);
    }
  }
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(callback, "wallet checkbox callback exists");

for (const checked of [true, false]) {
  test(`wallet ${checked ? "selection" : "deselection"} survives deferred and replayed state updates`, () => {
    const updates = [];
    const compiled = ts.transpileModule(`(${callback})`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const handler = vm.runInNewContext(compiled, { onChange: (update) => updates.push(update) });
    const event = { currentTarget: { checked } };
    handler(event);
    event.currentTarget = null;
    const previous = { useWallet: !checked, notes: "Keep customer note", deliveryMethod: "pickup", paymentMethod: "cash" };
    assert.equal(updates.length, 1);
    for (let replay = 0; replay < 2; replay++) {
      const result = updates[0](previous);
      assert.equal(result.useWallet, checked);
      assert.equal(result.notes, previous.notes);
      assert.equal(result.deliveryMethod, previous.deliveryMethod);
      assert.equal(result.paymentMethod, previous.paymentMethod);
      assert.equal(previous.useWallet, !checked, "does not mutate the previous state");
    }
  });
}

function readFunctions(relativePath, names) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const file = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  return file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
    .map(node => node.getText(file).replace(/^export /, "")).join("\n");
}
const quoteFunctions = readFunctions("../src/lib/partspro-api.ts", ["money", "toCents"])
  + readFunctions("../src/app/api/orders/preview/route.ts", ["calculateWalletSummary", "walletSummaryDto"]);
const quoteWallet = vm.runInNewContext(ts.transpileModule(`(()=>{${quoteFunctions};return (total,balance,use)=>walletSummaryDto(calculateWalletSummary(total,balance,use))})()`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText);

for (const [label, total, balance, use, applied, payable] of [
  ["wallet not selected", 1150, 11.5, false, 0, 1150],
  ["full balance matches pickup order", 1150, 11.5, true, 1150, 0],
  ["partial balance", 1150, 5, true, 500, 650],
  ["shipping remains payable", 1800, 11.5, true, 1150, 650],
  ["balance exceeds order", 1150, 20, true, 1150, 0],
  ["empty balance", 1150, 0, true, 0, 1150],
  ["negative balance cannot debit", 1150, -5, true, 0, 1150],
]) {
  test(`real order preview arithmetic: ${label}`, () => {
    const result = quoteWallet(total, balance, use);
    assert.equal(result.appliedAmount.cents, applied);
    assert.equal(result.payableAmount.cents, payable);
    assert.equal(result.appliedAmount.cents + result.payableAmount.cents, total);
    assert.equal(result.appliedAmount.amount, (applied / 100).toFixed(2));
    assert.equal(result.payableAmount.currency, "EUR");
  });
}
