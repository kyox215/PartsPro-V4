import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import * as ts from "typescript";
import { z } from "zod";
import { projectRmaV4Workflow } from "../src/lib/partspro-rma-v4-rules.mjs";
import * as rules from "../src/lib/partspro-rma-rules.mjs";
import * as upload from "../src/lib/partspro-rma-upload-client.mjs";

function compile(source, require, globals = {}) {
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require, ...globals });
  return loadedModule.exports;
}
function functions(file, names, globals = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const body = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join("\n");
  return compile(body + "\nexport { " + names.join(", ") + " };", () => { throw Error("Unexpected import"); }, globals);
}
const authFns = functions("../src/lib/partspro-admin-auth.ts", ["hasAdminPermission", "hasExactAdminPermission", "permissionAliases"]);
const auth = permissions => ({ allowed: true, userId: "employee", role: "sales", permissions });
const dto = compile(readFileSync(new URL("../src/lib/partspro-rma-admin-dto.ts", import.meta.url), "utf8"), name => {
  if (name.endsWith("partspro-admin-auth")) return authFns;
  if (name.endsWith("partspro-rma-workflow-rules")) return { projectAdminRmaWorkflow: projectRmaV4Workflow };
  throw Error(name);
});
const received = { id: "11111111-1111-4111-8111-111111111111", orderId: "TEST-ORDER", quantity: 1, receivedQuantity: 1,
  receivedAt: "2026-10-04T10:00:00Z", status: "received", qcStatus: "failed", inventoryDisposition: "quarantine",
  requestedResolution: "wallet_credit", refundPricingVerified: true, attachments: [], events: [] };

test("RMA approval is distinct from refund request and exact QC permissions", () => {
  const pending = { ...received, walletRefundRequestId: "refund", walletRefundStatus: "pending", walletRequestedAmount: 13 };
  assert.equal(dto.toAdminRmaDto(pending, dto.getAdminRmaCapabilities(auth(["rma.read", "wallet_refunds.approve"]))).canApproveWalletRefund, true);
  assert.equal(dto.toAdminRmaDto(pending, dto.getAdminRmaCapabilities(auth(["rma.read", "rma.refund"]))).canApproveWalletRefund, false);
  assert.equal(dto.toAdminRmaDto({ ...pending, walletRequestedAmount: null }, dto.getAdminRmaCapabilities(auth(["wallet_refunds.approve"]))).canApproveWalletRefund, false);
  for (const permission of ["orders.manage", "product.adjust_stock", "inventory.manage"]) {
    const state = dto.toAdminRmaDto({ ...received, qcStatus: "pending" }, dto.getAdminRmaCapabilities(auth([permission])));
    assert.equal(state.availableActions.includes("record_qc"), false, permission);
    assert.notEqual(state.recommendedAction, "record_qc", permission);
  }
  for (const permission of ["rma.manage", "rma.inventory"]) {
    assert.equal(dto.toAdminRmaDto({ ...received, qcStatus: "pending" }, dto.getAdminRmaCapabilities(auth([permission]))).availableActions.includes("record_qc"), true);
  }
});

test("canonical requested status and linked ledger amounts are mapped without inventing credit", async () => {
  let row = { id: "refund", status: "requested", currency: "EUR", requested_amount: "13.00", approved_amount: null, wallet_transaction_id: null };
  const filters = [];
  const client = { from: () => ({ select: () => ({ eq: function (key, value) { filters.push([key, value]); return this; }, maybeSingle: async () => ({ data: row, error: null }) }) }) };
  const repo = functions("../src/lib/partspro-repository.ts",
    ["normalizeRmaWalletRefundStatus", "readAdminRmaWalletAmounts", "isDbRow", "pickString", "pickNumber"],
    { rmaReadUnavailable: message => new Error(message), supabaseErrorDetails: () => ({}) });
  const request = { ...received, walletRefundRequestId: "refund" };
  const pending = await repo.readAdminRmaWalletAmounts(request, client);
  assert.equal(pending.walletRefundStatus, "pending");
  assert.equal(pending.walletRequestedAmount, 13);
  assert.equal(pending.walletCreditedAmount, null);
  assert.ok(filters.some(([key, value]) => key === "rma_request_id" && value === received.id));
  assert.ok(filters.some(([key, value]) => key === "request_type" && value === "rma_return"));
  row = { ...row, status: "approved", approved_amount: "12.50", wallet_transaction_id: "ledger" };
  assert.equal((await repo.readAdminRmaWalletAmounts(request, client)).walletCreditedAmount, 12.5);
  row = { ...row, currency: "USD" };
  await assert.rejects(repo.readAdminRmaWalletAmounts(request, client), /could not be verified/);
});

test("server-only admin reads require the same authenticated staff identity and read permission", async () => {
  let current = auth(["rma.read"]);
  const repo = functions("../src/lib/partspro-repository.ts", ["requireAdminRmaReadPermission"],
    { getAdminAuthState: async () => current, RepositoryWriteError: class extends Error { constructor(status, code, message) { super(message); this.status = status; } } });
  await repo.requireAdminRmaReadPermission({ userId: "employee" });
  for (const change of [{ allowed: false }, { userId: "different" }, { permissions: ["wallet_refunds.approve"] }]) {
    current = { ...auth(["rma.read"]), ...change };
    await assert.rejects(repo.requireAdminRmaReadPermission({ userId: "employee" }), error => error.status === 403);
  }
});

function actionRoute(permissions) {
  const writes = [];
  const contract = compile(readFileSync(new URL("../src/lib/partspro-rma-contract.ts", import.meta.url), "utf8"), name => {
    if (name === "zod") return { z };
    if (name.endsWith("partspro-rma-rules.mjs")) return rules;
    if (name.endsWith("partspro-rma-upload-client.mjs")) return upload;
    throw Error(name);
  });
  const error = (status, code, message) => ({ status, body: { error: { code, message } } });
  const route = compile(readFileSync(new URL("../src/app/api/admin/rma/[requestId]/actions/route.ts", import.meta.url), "utf8"), name => {
    if (name === "zod") return { z };
    if (name === "next/server") return { NextResponse: { json: body => ({ status: 200, body }) } };
    if (name.endsWith("partspro-admin-auth")) return authFns;
    if (name.endsWith("partspro-rma-contract")) return contract;
    if (name.endsWith("partspro-rma-admin-dto")) return dto;
    if (name.endsWith("partspro-api")) return { apiError: error, formatZodIssues: e => e.issues, readJsonBody: async req => ({ ok: true, data: await req.json() }) };
    if (name.endsWith("partspro-repository")) return { performAdminRmaAction: async input => { writes.push(input); return { data: received, source: "supabase" }; } };
    if (name.endsWith("partspro-rma-evidence")) return { RmaEvidenceReadError: class extends Error {}, signSingleRmaRequestAttachments: async row => row, hydrateCustomerRmaAttachments: async rows => rows };
    if (name.endsWith("partspro-notifications")) return { deliverPendingRmaNotifications: async () => ({ pushStatus: "not_applicable" }) };
    if (name.endsWith("_shared")) return { requireAdminApi: async () => ({ ok: true, authState: auth(permissions) }), repositoryErrorResponse: () => error(500, "FAIL", "Unexpected failure") };
    throw Error(name);
  });
  return { writes, post: data => route.POST({ json: async () => data }, { params: Promise.resolve({ requestId: received.id }) }) };
}
test("actual API blocks QC aliases and unconfirmed or fractional-cent refunds", async () => {
  for (const permission of ["orders.manage", "product.adjust_stock", "inventory.manage"]) {
    const route = actionRoute(["rma.read", permission]);
    assert.equal((await route.post({ action: "record_qc", qcStatus: "failed", qcNote: "Broken screen", idempotencyKey: "fixture-qc-key" })).status, 403);
    assert.equal(route.writes.length, 0);
  }
  const qc = actionRoute(["rma.read", "rma.inventory"]);
  assert.equal((await qc.post({ action: "record_qc", qcStatus: "failed", qcNote: "Broken screen", idempotencyKey: "fixture-qc-key" })).status, 200);
  const refund = actionRoute(["rma.read", "wallet_refunds.request"]);
  for (const extra of [{}, { refundAmount: 13.001 }]) {
    assert.equal((await refund.post({ action: "request_wallet_refund", idempotencyKey: "fixture-refund-key", ...extra })).status, 400);
  }
  assert.equal(refund.writes.length, 0);
  assert.equal((await refund.post({ action: "request_wallet_refund", refundAmount: 13, idempotencyKey: "fixture-refund-key" })).status, 200);
  assert.equal(refund.writes[0].refundAmount, 13);
  assert.equal(refund.writes[0].idempotencyKey, "fixture-refund-key");
});

test("preparing a legacy return requires exact management, request and approval grants", async () => {
  const payload = { action: "prepare_wallet_refund", reason: "Manager directed wallet refund", idempotencyKey: "fixture-prepare-key" };
  for (const permissions of [
    ["rma.read", "rma.manage", "rma.refund"],
    ["rma.read", "wallet_refunds.approve", "wallet_refunds.request"],
    ["rma.read", "rma.manage", "wallet_refunds.approve"],
    ["rma.read", "orders.manage", "wallet_refunds.approve", "rma.refund"],
  ]) {
    const route = actionRoute(permissions);
    assert.equal((await route.post(payload)).status, 403);
    assert.equal(route.writes.length, 0);
  }
  const route = actionRoute(["rma.read", "rma.manage", "wallet_refunds.request", "wallet_refunds.approve"]);
  for (const extra of [{ reason: "" }, { idempotencyKey: undefined }, { refundAmount: 10 }, { customerConfirmation: "Fabricated agreement" }]) {
    assert.equal((await route.post({ ...payload, ...extra })).status, 400);
  }
  assert.equal(route.writes.length, 0);
  assert.equal((await route.post(payload)).status, 200);
  assert.equal(route.writes[0].action, "prepare_wallet_refund");
  assert.equal(route.writes[0].idempotencyKey, payload.idempotencyKey);
});

test("already disposed legacy replacement exposes a safe preparation path without reopening stock", () => {
  const permissions = ["rma.read", "rma.manage", "rma.refund", "wallet_refunds.approve"];
  for (const disposition of ["restock", "scrap"]) {
    const row = { ...received, requestedResolution: "replacement", refundPricingVerified: false,
      unitPriceSnapshot: null, inventoryDisposition: disposition, inventoryDispositionQuantity: 1 };
    const state = dto.toAdminRmaDto(row, dto.getAdminRmaCapabilities(auth(permissions)));
    assert.equal(state.availableActions.includes("prepare_wallet_refund"), true);
    assert.equal(state.availableActions.includes("verify_refund_snapshot"), false);
    assert.equal(state.availableActions.includes("restock_return"), false);
    assert.equal(state.canApproveWalletRefund, false);
    const reader = dto.toAdminRmaDto(row, dto.getAdminRmaCapabilities(auth(["rma.read"])));
    assert.equal(reader.availableActions.includes("prepare_wallet_refund"), false);
  }
});
