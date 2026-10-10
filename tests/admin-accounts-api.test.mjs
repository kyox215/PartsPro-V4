import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as ts from "typescript";
import { z } from "zod";
import { accountProfilePatchSchema } from "../src/lib/admin-account-operation.mjs";

function compile(file, imports) {
  const loadedModule = { exports: {} };
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports: loadedModule.exports, module: loadedModule, require: name => {
    if (name in imports) return imports[name]; throw Error(`Unexpected import ${name}`);
  }, Request, Response });
  return loadedModule.exports;
}
const api = {
  apiError: (status, code, message, details) => Response.json({ error: { code, message, details } }, { status }),
  formatZodIssues: error => error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })),
  readJsonBody: async request => { try { return { ok: true, data: await request.json() }; } catch { return { ok: false }; } },
};
const saved = compile("src/app/api/admin/accounts/_saved-account-response.ts", { "next/server": { NextResponse: Response } });
const id = "11111111-1111-4111-8111-111111111111";
const request = body => new Request("https://example.test", { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
function profileRoute({ allow = true, profile = { id: "customer", email: null }, failRefresh = false } = {}) {
  let writes = [], ensured = 0;
  const route = compile("src/app/api/admin/accounts/[userId]/customer-profile/route.ts", {
    "next/server": { NextResponse: Response }, zod: { z }, "@/lib/partspro-api": api,
    "@/lib/admin-account-operation.mjs": { accountProfilePatchSchema }, "../../_saved-account-response": saved,
    "@/lib/partspro-admin-auth": { hasAdminPermission: (_state, permission) => allow && permission === "customers.classify" },
    "@/lib/partspro-repository": { updateAdminCustomerProfile: async (...args) => { writes.push(args); return { data: {} }; }, ensureAdminCustomerProfile: async () => { ensured += 1; }, ensureAdminEmployeeSelfCustomer: async () => { ensured += 1; } },
    "@/lib/supabase/server": { createClient: async () => ({}) },
    "../../../_shared": { requireAdminApi: async () => ({ ok: true, authState: {} }), repositoryErrorResponse: error => api.apiError(502, "FAILED", error.message) },
    "../../_account-data": { readEditableAdminAccountProfileCustomerByUserId: async () => ({ account: { accountType: "customer", email: null }, profileCustomer: profile }), readAdminAccountDetail: async () => { if (failRefresh) throw Error("Read failed"); return { account: { userId: id } }; } },
  });
  return { route, writes, get ensured() { return ensured; } };
}

test("authorized phone correction on an incomplete profile writes only known changes without creating another profile", async () => {
  const fixture = profileRoute();
  const response = await fixture.route.PATCH(request({ mode: "correction", phone: "22222", reason: "Phone corrected" }), { params: Promise.resolve({ userId: id }) });
  assert.equal(response.status, 200); assert.equal(fixture.writes.length, 1); assert.equal(fixture.ensured, 0);
  const [customerId, body] = fixture.writes[0]; assert.equal(customerId, "customer"); assert.equal(body.phone, "22222"); assert.equal(body.reason, "Phone corrected");
  assert.equal(body.billingAddress, undefined); assert.equal(body.shippingAddress, undefined); assert.equal("email" in body, false);
});

test("profile classification permission remains mandatory for partial correction", async () => {
  const fixture = profileRoute({ allow: false });
  const response = await fixture.route.PATCH(request({ mode: "correction", phone: "22222", reason: "Phone corrected" }), { params: Promise.resolve({ userId: id }) });
  assert.equal(response.status, 403); assert.equal(fixture.writes.length, 0); assert.equal(fixture.ensured, 0);
});

test("correction cannot initialize a missing profile or bypass complete-profile validation", async () => {
  const missing = profileRoute({ profile: null });
  assert.equal((await missing.route.PATCH(request({ mode: "correction", phone: "22222", reason: "Phone corrected" }), { params: Promise.resolve({ userId: id }) })).status, 409);
  assert.equal(missing.ensured, 0); assert.equal(missing.writes.length, 0);
  const incomplete = profileRoute();
  assert.equal((await incomplete.route.PATCH(request({ mode: "complete", phone: "22222", reason: "Phone corrected" }), { params: Promise.resolve({ userId: id }) })).status, 400);
  assert.equal(incomplete.writes.length, 0);
});

test("successful profile write plus failed detail read reports saved and never replays the write", async () => {
  const fixture = profileRoute({ failRefresh: true });
  const response = await fixture.route.PATCH(request({ mode: "correction", phone: "22222", reason: "Phone corrected" }), { params: Promise.resolve({ userId: id }) });
  const payload = await response.json();
  assert.equal(response.status, 200); assert.equal(payload.meta.saved, true); assert.equal(payload.meta.readError, "ACCOUNT_SAVED_REFRESH_UNAVAILABLE"); assert.equal(payload.data, null);
  assert.equal(fixture.writes.length, 1);
});
