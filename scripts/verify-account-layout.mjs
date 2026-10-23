// Actual storefront components with synthetic data; all business requests are local fixtures.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const temporary = mkdtempSync(path.join(tmpdir(), "partspro-account-layout-"));
try {
  cpSync("tests/fixtures/account-layout", temporary, { recursive: true });
  for (const name of readdirSync(temporary)) {
    if (name.endsWith(".fixture")) renameSync(path.join(temporary, name), path.join(temporary, name.slice(0, -8)));
  }
  execFileSync(process.execPath, [path.join(temporary, "build.cjs")], { stdio: "inherit" });
  execFileSync(process.execPath, [path.join(temporary, "run.cjs"), ...process.argv.slice(2)], { stdio: "inherit", timeout: 300_000 });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
