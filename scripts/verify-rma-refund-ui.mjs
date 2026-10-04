// Real RMA React controls with isolated fixture APIs. No production access.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = mkdtempSync(path.join(tmpdir(), "partspro-rma-ui-"));
const output = path.resolve(root, process.argv[2] || "outputs/rma/2026-10-04");
try {
  const build = readFileSync(path.join(root, "tests/fixtures/rma-refund-ui/build.cjs.fixture"), "utf8");
  writeFileSync(path.join(temporary, "build.cjs"), build.replaceAll("__HARNESS_DIR__", JSON.stringify(temporary)));
  for (const name of ["entry.tsx", "run.cjs"]) {
    const source = readFileSync(path.join(root, "tests/fixtures/rma-refund-ui", `${name}.fixture`), "utf8");
    writeFileSync(path.join(temporary, name), source.replaceAll("__HARNESS_DIR__", JSON.stringify(temporary)));
  }
  execFileSync(process.execPath, [path.join(temporary, "build.cjs")], { cwd: root, stdio: "inherit" });
  execFileSync(process.execPath, [path.join(temporary, "run.cjs")], {
    cwd: root, stdio: "inherit", timeout: 90_000, env: { ...process.env, RMA_UI_OUTPUT_DIR: output },
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
