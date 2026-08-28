import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repository = readFileSync(
  join(repoRoot, "src/lib/partspro-repository.ts"),
  "utf8"
);

test("legacy RMA reads accept only an owned, unambiguous order graph", () => {
  const isRmaRowWithinCustomerScope = loadRepositoryScopeHelper();
  const scope = {
    customerId: "customer-1",
    orderIds: new Set(["order-1"]),
    orderNumbers: new Set(["ORD-1"]),
    lineIds: new Set(["line-1"]),
    orderIdByNumber: new Map([
      ["ORD-1", "order-1"],
      ["ORD-foreign", "order-foreign"],
    ]),
    lineOrderIdById: new Map([
      ["line-1", "order-1"],
      ["line-foreign", "order-foreign"],
    ]),
  };

  assert.equal(
    isRmaRowWithinCustomerScope(
      { customer_id: null, order_id: "order-1" },
      scope
    ),
    true,
    "a historical row with an owned order link remains readable"
  );
  assert.equal(
    isRmaRowWithinCustomerScope(
      { customer_id: null, order_line_id: "line-1" },
      scope
    ),
    true,
    "a historical row with an owned order-line link remains readable"
  );
  assert.equal(
    isRmaRowWithinCustomerScope(
      { customer_id: null, order_id: "order-foreign" },
      scope
    ),
    false,
    "a null-customer row with a foreign order link is hidden"
  );
  assert.equal(
    isRmaRowWithinCustomerScope(
      { customer_id: null, order_line_id: "line-foreign" },
      scope
    ),
    false,
    "a null-customer row with a foreign order-line link is hidden"
  );
  assert.equal(
    isRmaRowWithinCustomerScope(
      { customer_id: "customer-2", order_id: "order-1" },
      scope
    ),
    false,
    "a non-null customer mismatch is rejected even with an owned link"
  );
  assert.equal(
    isRmaRowWithinCustomerScope(
      { customer_id: "customer-1", order_id: "order-foreign" },
      scope
    ),
    false,
    "a matching customer cannot override a foreign order link"
  );
  assert.equal(
    isRmaRowWithinCustomerScope(
      { customer_id: null, order_id: "order-1", order_line_id: "line-foreign" },
      scope
    ),
    false,
    "contradictory order and line links fail closed"
  );
  assert.equal(
    isRmaRowWithinCustomerScope({ customer_id: null }, scope),
    false,
    "a row without an owned relationship is hidden"
  );
});

test("repository keeps the scoped legacy read helper behind the strict customer path", () => {
  assert.match(repository, /function isRmaRowWithinCustomerScope/);
  assert.match(repository, /readStrictRmaCustomerId\(context\.client, context\.userId\)/);
  assert.match(repository, /isRmaRowWithinCustomerScope\(row, rmaReadScope\)/);
});

test("RMA read hydration fails closed instead of converting query errors to empty data", () => {
  assert.match(repository, /function rmaReadUnavailable\(message: string/);
  assert.match(repository, /new RepositoryWriteError\(503, "RMA_READ_UNAVAILABLE"/);
  assert.match(
    repository,
    /async function readRmaRowsForValues\([\s\S]*?if \(error \|\| !rows\) \{\s*throw rmaReadUnavailable/
  );
  assert.match(
    repository,
    /async function readRmaRowsForColumnValuesStrict\([\s\S]*?if \(error \|\| !rows\) \{\s*throw rmaReadUnavailable/
  );
  assert.match(
    repository,
    /async function readRmaWalletRefundStatusesByRequestId\([\s\S]*?if \(error \|\| !rows\) \{\s*throw rmaReadUnavailable/
  );
  assert.match(repository, /readRmaRowsForColumnValuesStrict\(\s*client,\s*"rma_request_events"/);
  assert.match(repository, /readRmaRowsForColumnValuesStrict\(client, "orders", "id", orderIds\)/);
  assert.match(repository, /if \(isSupabaseConfigured\(\)\) \{\s*throw rmaReadUnavailable/);
});

test("admin workflow queues over-fetch before applying the projection offset", () => {
  assert.match(repository, /const queueScoped = isProjectionQueueFilter\(query\.queue\)/);
  assert.match(repository, /const scanCap = Math\.min\(\s*2000/);
  assert.match(repository, /while \(true\) \{[\s\S]*?request\.range\(\s*scanOffset/);
  assert.match(repository, /projectedRequests\.slice\(offset, offset \+ limit\)/);
  assert.match(repository, /const totalIsExact = queueScoped \? scanExhausted/);
  assert.match(repository, /hasMore:/);
  assert.match(repository, /lowerBound:/);
});

function loadRepositoryScopeHelper() {
  const source = [
    extractFunction(repository, "pickString"),
    extractFunction(repository, "isRmaRowWithinCustomerScope"),
    "globalThis.result = isRmaRowWithinCustomerScope;",
  ].join("\n");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2020,
    },
  });
  const context = { globalThis: {} };
  vm.runInNewContext(compiled.outputText, context);
  return context.globalThis.result;
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} helper was not found`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  assert.fail(`${name} helper boundary was not found`);
}
