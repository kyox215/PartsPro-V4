import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  financeExpenseCreateSchema, financeExpensePatchSchema, financeGross, financeMoneySchema,
  financeEditableId, parseFinanceMoney, supplierPaymentCreateSchema, supplierPaymentPatchSchema,
} from "../src/lib/admin-finance-input.mjs";

const batchId = "11111111-1111-4111-8111-111111111111";
const version = "2026-10-10T10:32:19.123456+00:00";

test("Italian and dot decimal entries resolve to the same cents without coercing empty input", () => {
  for (const value of ["12,50", "12.50", " 12,50 "]) assert.deepEqual(parseFinanceMoney(value), { ok: true, value: 12.5, cents: 1250 });
  for (const value of ["", " ", "abc", "-1", "1.234", "1,234", "1.000,50", "1e3", "Infinity", null, undefined, 12.5]) assert.equal(parseFinanceMoney(value).ok, false, String(value));
  assert.deepEqual(parseFinanceMoney("0"), { ok: true, value: 0, cents: 0 });
  assert.equal(financeGross(12.5, 2.75), 15.25);
  assert.equal(financeGross(0.1, 0.2), 0.3);
});

test("JSON money schema rejects null, text, booleans, nonfinite and fractional cents", () => {
  for (const value of [null, "", " ", "12.50", false, true, NaN, Infinity, -1, 0.001, 0.0000000001, 1_000_000_001]) assert.equal(financeMoneySchema.safeParse(value).success, false, String(value));
  for (const value of [0, 0.29, 12.5, 100.01, 1_000_000_000]) assert.equal(financeMoneySchema.safeParse(value).success, true, String(value));
  for (const schema of [financeExpenseCreateSchema, supplierPaymentCreateSchema]) {
    const base = schema === financeExpenseCreateSchema ? { category: "rent", description: "Rent" } : { batchId };
    assert.equal(schema.safeParse({ ...base, amountNet: null }).success, false);
    assert.equal(schema.safeParse({ ...base, amountNet: 12.5, vatAmount: null }).success, false);
    assert.equal(schema.parse({ ...base, amountNet: 12.5 }).vatAmount, 0);
  }
});

test("corrections require a reason and exact original version without inserting defaults", () => {
  for (const schema of [financeExpensePatchSchema, supplierPaymentPatchSchema]) {
    assert.equal(schema.safeParse({ amountNet: 12.5 }).success, false);
    assert.equal(schema.safeParse({ amountNet: 12.5, correctionReason: " ", expectedUpdatedAt: version }).success, false);
    assert.equal(schema.safeParse({ correctionReason: "Fix", expectedUpdatedAt: version }).success, false);
    const parsed = schema.parse({ amountNet: 12.5, correctionReason: "Fix", expectedUpdatedAt: version });
    assert.equal(parsed.expectedUpdatedAt, version);
    assert.equal("vatAmount" in parsed, false);
    assert.equal("status" in parsed, false);
  }
});

test("supplier gross is checked against net plus VAT", () => {
  assert.equal(supplierPaymentCreateSchema.safeParse({ batchId, amountNet: 12.5, vatAmount: 2.75, amountGross: 15.25 }).success, true);
  assert.equal(supplierPaymentCreateSchema.safeParse({ batchId, amountNet: 12.5, vatAmount: 2.75, amountGross: 12.5 }).success, false);
});

test("editable IDs only accept the precise ledger type and original UUID", () => {
  assert.equal(financeEditableId("expense", `expense:${batchId}`), batchId);
  assert.equal(financeEditableId("supplier_payment", `supplier_payment:${batchId}`), batchId);
  for (const [type, id] of [["expense", `supplier_payment:${batchId}`], ["supplier_payment", `purchase:${batchId}`], ["expense", batchId], ["sale", `sale:${batchId}`], ["expense", "expense:wrong"]]) assert.equal(financeEditableId(type, id), null);
});

test("Europe/Rome summer, winter and midnight preserve the local wall time and date", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { localFinanceDate, localFinanceDateTime, financeLocalDateTimeToIso, isFinanceDate } from './src/lib/admin-finance-input.mjs';
    const instants = ['2026-07-15T10:34:00Z', '2026-01-15T11:34:00Z', '2026-07-15T22:30:00Z'];
    const rows = instants.map((iso) => { const date = new Date(iso); const local = localFinanceDateTime(date); return [localFinanceDate(date), local, financeLocalDateTimeToIso(local)]; });
    console.log(JSON.stringify({rows, gap: financeLocalDateTimeToIso('2026-03-29T02:30'), invalid: isFinanceDate('2026-02-30'), leap: isFinanceDate('2028-02-29')}));
  `], { cwd: new URL("..", import.meta.url), env: { ...process.env, TZ: "Europe/Rome" }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { rows: [
    ["2026-07-15", "2026-07-15T12:34", "2026-07-15T10:34:00.000Z"],
    ["2026-01-15", "2026-01-15T12:34", "2026-01-15T11:34:00.000Z"],
    ["2026-07-16", "2026-07-16T00:30", "2026-07-15T22:30:00.000Z"],
  ], gap: null, invalid: false, leap: true });
});
