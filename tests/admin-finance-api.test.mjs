import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import * as ts from "typescript";
import { z } from "zod";
import * as inputs from "../src/lib/admin-finance-input.mjs";

function compile(file, imports) {
  const loadedModule = { exports: {} };
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports: loadedModule.exports, module: loadedModule, require: (name) => {
    if (name in imports) return imports[name]; throw Error(`Unexpected import ${name}`);
  }, Request, Response, Date });
  return loadedModule.exports;
}
const api = {
  apiError: (status, code, message, details) => Response.json({ error: { code, message, details } }, { status }),
  formatZodIssues: (error) => error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code, message: issue.message })),
  readJsonBody: async (request) => { try { return { ok: true, data: await request.json() }; } catch { return { ok: false }; } },
};
const shared = compile("src/app/api/admin/finance/_shared.ts", { zod: { z }, "@/lib/partspro-api": api, "@/lib/admin-finance-input.mjs": inputs });
const id = "11111111-1111-4111-8111-111111111111";
const version = "2026-10-10T10:32:19.123456+00:00";
function route(path, repository, auth = async () => ({ ok: true })) {
  const adminShared = {
    requireAdminApi: auth,
    repositoryErrorResponse: (error) => api.apiError(error.status ?? 502, error.code ?? "ERROR", error.message),
    parseAdminQuery: (search, schema) => { const parsed = schema.safeParse(Object.fromEntries(search)); return parsed.success ? { ok: true, data: parsed.data } : { ok: false, response: api.apiError(400, "INVALID_QUERY", "Invalid query") }; },
  };
  return compile(path, {
    "next/server": { NextResponse: Response }, zod: { z }, "@/lib/partspro-api": api, "@/lib/admin-finance-input.mjs": inputs,
    "@/lib/partspro-repository": repository, "../_shared": shared, "../../_shared": path.endsWith("supplier-batch-options/route.ts") || path.endsWith("expenses/route.ts") || path.endsWith("supplier-payments/route.ts") ? adminShared : shared,
    "../../../_shared": adminShared, "../../../../_shared": adminShared,
  });
}
const request = (body) => new Request("https://example.test", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

test("expense POST rejects null amount before any booked write and reports the field", async () => {
  let writes = 0;
  const post = route("src/app/api/admin/finance/expenses/route.ts", { createAdminFinanceExpense: async () => { writes += 1; } });
  const response = await post.POST(request({ amountNet: null, category: "rent", description: "Rent" }));
  assert.equal(response.status, 400); assert.equal(writes, 0);
  assert.equal((await response.json()).error.details.issues[0].path, "amountNet");
});

test("expense correction passes the same exact ID and raw version while retaining audit metadata", async () => {
  let saved;
  const patch = route("src/app/api/admin/finance/expenses/[expenseId]/route.ts", {
    readAdminFinanceEditableEntry: async (type, recordId) => { assert.equal(type, "expense"); assert.equal(recordId, id); return { data: { metadata: { prior: "kept" }, version } }; },
    updateAdminFinanceExpense: async (...args) => { saved = args; return { data: { id }, source: "supabase" }; },
  });
  const response = await patch.PATCH(request({ description: "Corrected rent", correctionReason: "Typo", expectedUpdatedAt: version }), { params: Promise.resolve({ expenseId: id }) });
  assert.equal(response.status, 200); assert.equal(saved[0], id); assert.equal(saved[2], version);
  assert.equal(saved[1].metadata.prior, "kept"); assert.equal(saved[1].metadata.correctionReason, "Typo");
  assert.equal("correctionReason" in saved[1], false); assert.equal("amountNet" in saved[1], false);
});

test("stale correction refuses to write and preserves the original version", async () => {
  let writes = 0;
  const patch = route("src/app/api/admin/finance/expenses/[expenseId]/route.ts", {
    readAdminFinanceEditableEntry: async () => ({ data: { metadata: {}, version } }),
    updateAdminFinanceExpense: async () => { writes += 1; },
  });
  const response = await patch.PATCH(request({ description: "Changed", correctionReason: "Fix", expectedUpdatedAt: "older" }), { params: Promise.resolve({ expenseId: id }) });
  assert.equal(response.status, 409); assert.equal(writes, 0);
});

test("partial payment amount correction preserves original VAT and recomputes gross", async () => {
  let saved;
  const patch = route("src/app/api/admin/finance/supplier-payments/[paymentId]/route.ts", {
    readAdminFinanceEditableEntry: async () => ({ data: { amountNet: 12.5, vatAmount: 2.75, metadata: {}, version } }),
    updateAdminSupplierBatchPayment: async (...args) => { saved = args; return { data: { id }, source: "supabase" }; },
  });
  const response = await patch.PATCH(request({ amountNet: 17, correctionReason: "Invoice correction", expectedUpdatedAt: version }), { params: Promise.resolve({ paymentId: id }) });
  assert.equal(response.status, 200); assert.equal(saved[0], id); assert.equal(saved[2], version);
  assert.equal(saved[1].amountNet, 17); assert.equal(saved[1].vatAmount, 2.75); assert.equal(saved[1].amountGross, 19.75);
});

test("batch options require finance.read and return only selection/balance DTOs", async () => {
  const scopes = [];
  const options = route("src/app/api/admin/finance/supplier-batch-options/route.ts", {
    readAdminFinanceSupplierBatchOptions: async (query) => { assert.equal(query.q, "OLD"); assert.equal(query.offset, 20); return { data: { batches: [{ id, batchCode: "OLD-001", supplierName: "Supplier", currency: "EUR", paidNet: 5, outstandingNet: 20, latestPaidAt: null, costBasis: "confirmed_net" }], total: 52 } }; },
  }, async (scope) => { scopes.push(scope); return { ok: true }; });
  const response = await options.GET({ nextUrl: new URL("https://example.test?limit=20&offset=20&q=OLD") });
  const payload = await response.json(); assert.equal(scopes[0], "finance.read"); assert.equal(payload.meta.total, 52); assert.equal(payload.meta.offset, 20);
  assert.equal(payload.data[0].outstandingNet, 20); assert.equal("metadata" in payload.data[0], false); assert.equal("sourceFileName" in payload.data[0], false);
});

test("permission refusal stops read and write routes before repository access", async () => {
  const forbidden = async () => ({ ok: false, response: api.apiError(403, "DENIED", "Denied") });
  const repo = new Proxy({}, { get: () => () => { throw Error("Repository must not be called"); } });
  assert.equal((await route("src/app/api/admin/finance/expenses/route.ts", repo, forbidden).POST(request({}))).status, 403);
  assert.equal((await route("src/app/api/admin/finance/supplier-batch-options/route.ts", repo, forbidden).GET({ nextUrl: new URL("https://example.test") })).status, 403);
});

test("impossible calendar dates are refused instead of displaying a false empty result", () => {
  assert.equal(shared.financeQuerySchema.safeParse({ dateFrom: "2026-02-30" }).success, false);
  assert.equal(shared.financeQuerySchema.safeParse({ dateFrom: "2026-02-28", ledgerView: "expenses", offset: "50" }).success, true);
});

test("payment gross-only correction cannot discard existing VAT", async () => {
  let writes = 0;
  const patch = route("src/app/api/admin/finance/supplier-payments/[paymentId]/route.ts", {
    readAdminFinanceEditableEntry: async () => ({ data: { amountNet: 12.5, vatAmount: 2.75, metadata: {}, version } }),
    updateAdminSupplierBatchPayment: async () => { writes += 1; },
  });
  const response = await patch.PATCH(request({ amountGross: 12.5, correctionReason: "Wrong total", expectedUpdatedAt: version }), { params: Promise.resolve({ paymentId: id }) });
  assert.equal(response.status, 400); assert.equal(writes, 0);
  assert.equal((await response.json()).error.details.issues[0].path, "amountGross");
});
