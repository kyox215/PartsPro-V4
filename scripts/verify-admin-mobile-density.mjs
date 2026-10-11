// Local-only component fixtures. No production login or business writes.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const dir = path.resolve(".codex-tmp/mobile-density");
const names = ["entry.tsx", "build.cjs", "serve.cjs", "next-navigation.tsx", "next-dynamic.tsx", "next-link.tsx", "next-image.tsx", "i18n-action.ts", "tsx-loader.cjs", "check.mjs", "modules.mjs"];
const command = process.argv[2];
if (command === "--prepare") {
  await mkdir(dir, { recursive: true });
  for (const name of names) {
    const content = await readFile(new URL(`../tests/fixtures/admin-mobile-density/${name}.fixture`, import.meta.url), "utf8");
    const target = path.join(dir, name);
    let previous;
    try { previous = await readFile(target, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (previous !== undefined && previous !== content) throw new Error(`Existing fixture changed: ${name}. Use a fresh worktree; no files were overwritten.`);
    if (previous === undefined) await writeFile(target, content, { flag: "wx" });
  }
  console.log("Local fixture prepared. Build, start :3178, then run core and modules; all APIs are mocked.");
} else {
  const entry = { "--build": "build.cjs", "--serve": "serve.cjs", "--core": "check.mjs", "--modules": "modules.mjs" }[command];
  if (!entry) throw new Error("Use --prepare, --build, --serve, --core or --modules. Browser commands require playwright or PLAYWRIGHT_MODULE.");
  const result = spawnSync(process.execPath, [path.join(dir, entry)], { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
