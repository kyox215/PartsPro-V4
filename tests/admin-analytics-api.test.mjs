import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const fixedNow = "2026-10-11T16:42:13.123Z";
class FixtureDate extends Date {
  constructor(value = fixedNow) { super(value); }
  static now() { return Date.parse(fixedNow); }
}
function loadAnalytics(fetch) {
  const source = readFileSync(new URL("../src/lib/partspro-vercel-analytics.ts", import.meta.url), "utf8").replace('import "server-only";', "");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  // Separate VM/module for every case; no real environment or shared cache.
  vm.runInNewContext(js, { exports, URL, AbortSignal, Date: FixtureDate, fetch, process: { env: {
    VERCEL_ANALYTICS_TOKEN: "synthetic-token", PARTSPRO_VERCEL_PROJECT_ID: "synthetic-project", PARTSPRO_VERCEL_TEAM_ID: "synthetic-team",
  } } });
  return exports;
}
function response(data) { return { ok: true, json: async () => ({ data }) }; }
function mockGroups(total, override) {
  return async url => {
    const by = new URL(url).searchParams.get("by");
    return response(override?.(by) ?? (by === "environment" ? total : []));
  };
}

test("period visitors use one production environment group, not the sum of daily uniques", async () => {
  const requests = [];
  const { readWebsiteAnalytics } = loadAnalytics(async url => {
    requests.push(new URL(url));
    const by = new URL(url).searchParams.get("by");
    return response(by === "environment" ? [{ environment: "production", pageviews: 100, visitors: 10 }] : by === "day" ? [
      { timestamp: "2026-10-09T00:00:00Z", pageviews: 50, visitors: 8 },
      { timestamp: "2026-10-10T00:00:00Z", pageviews: 50, visitors: 8 },
    ] : []);
  });
  const snapshot = await readWebsiteAnalytics(7);
  assert.equal(snapshot.visitors, 10);
  assert.equal(snapshot.daily.reduce((sum, row) => sum + row.visitors, 0), 16);
  assert.equal(snapshot.pageviews, 100);
  assert.equal(requests.length, 5);
  assert.deepEqual(requests.map(url => url.searchParams.get("by")).sort(), ["country", "day", "environment", "referrerHostname", "route"].sort());
  for (const url of requests) {
    assert.equal(url.pathname, "/v1/query/web-analytics/visits/aggregate");
    assert.equal(url.searchParams.get("projectId"), "synthetic-project");
    assert.equal(url.searchParams.get("teamId"), "synthetic-team");
    assert.equal(url.searchParams.get("filter"), "environment eq 'production'");
    assert.equal(url.searchParams.get("since"), "2026-10-05T00:00:00.000Z");
    assert.equal(url.searchParams.get("until"), fixedNow);
  }
  assert.equal(requests.find(url => url.searchParams.get("by") === "environment").searchParams.get("limit"), "1");
});

test("acknowledged empty groups allow zero metrics and all queries retain 30-day ISO bounds", async () => {
  const requests = [];
  const { readWebsiteAnalytics } = loadAnalytics(async url => { requests.push(new URL(url)); return response([]); });
  const snapshot = await readWebsiteAnalytics(30);
  assert.equal(snapshot.visitors, 0); assert.equal(snapshot.pageviews, 0); assert.equal(snapshot.daily.length, 0);
  for (const url of requests) {
    assert.equal(url.searchParams.get("since"), "2026-09-12T00:00:00.000Z");
    assert.equal(url.searchParams.get("until"), fixedNow);
  }
});

test("totals with non-production, missing environment or multiple rows are rejected", async () => {
  for (const total of [
    [{ environment: "preview", pageviews: 1, visitors: 1 }],
    [{ pageviews: 1, visitors: 1 }],
    [{ environment: "production", pageviews: 1, visitors: 1 }, { environment: "production", pageviews: 2, visitors: 2 }],
  ]) {
    const { readWebsiteAnalytics } = loadAnalytics(mockGroups(total));
    await assert.rejects(readWebsiteAnalytics(7), /unexpected environment/);
  }
});

test("malformed data and rows fail instead of being silently removed or converted to zeros", async () => {
  for (const data of [null, "invalid", [null], [3], [{ environment: "production", pageviews: 1, visitors: 1 }, null]]) {
    const { readWebsiteAnalytics } = loadAnalytics(async url => response(new URL(url).searchParams.get("by") === "environment" ? data : []));
    await assert.rejects(readWebsiteAnalytics(7), /invalid|malformed/);
  }
});

test("each metric must be present, non-negative and a safe integer", async () => {
  for (const field of ["pageviews", "visitors"]) {
    for (const value of [undefined, null, "1", -1, NaN, Infinity, 1.25, Number.MAX_SAFE_INTEGER + 1]) {
      const row = { environment: "production", pageviews: 1, visitors: 1, [field]: value };
      const { readWebsiteAnalytics } = loadAnalytics(mockGroups([row]));
      await assert.rejects(readWebsiteAnalytics(7), /missing or invalid/);
    }
  }
});

test("invalid metrics in a grouped report also reject the complete snapshot", async () => {
  const { readWebsiteAnalytics } = loadAnalytics(mockGroups([{ environment: "production", pageviews: 1, visitors: 1 }], by => by === "day" ? [{ timestamp: "2026-10-10", visitors: 1 }] : undefined));
  await assert.rejects(readWebsiteAnalytics(7), /missing or invalid/);
});

test("upstream failures are not cached as an empty snapshot", async () => {
  let failed = true, calls = 0;
  const { readWebsiteAnalytics } = loadAnalytics(async () => { calls++; return failed ? { ok: false, status: 400 } : response([]); });
  await assert.rejects(readWebsiteAnalytics(7), /returned 400/);
  failed = false;
  const snapshot = await readWebsiteAnalytics(7);
  assert.equal(snapshot.pageviews, 0); assert.equal(calls, 10);
});
