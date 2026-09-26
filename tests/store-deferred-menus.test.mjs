import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadModule(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (name) => dependencies[name] ?? require(name),
  });
  return exports;
}

const loaderExports = loadModule("../src/components/partspro/store-menu-loader.ts");
const { createMenuLoader } = loaderExports;

test("menus do not import until requested and coalesce hover, focus and click requests", async () => {
  let imports = 0;
  let resolveImport;
  const Menu = () => null;
  const loader = createMenuLoader(() => {
    imports += 1;
    return new Promise((resolve) => { resolveImport = resolve; });
  });
  assert.equal(imports, 0);
  assert.equal(loader.getSnapshot().status, "idle");

  const hover = loader.load();
  assert.equal(loader.load(), hover);
  assert.equal(loader.load(), hover);
  assert.equal(loader.getSnapshot().status, "loading");
  await Promise.resolve();
  assert.equal(imports, 1);
  resolveImport(Menu);
  await hover;
  assert.equal(loader.getSnapshot().Component, Menu);
  assert.equal(loader.getSnapshot().status, "ready");
  await loader.load();
  assert.equal(imports, 1, "successful imports are reused across resize/navigation");
});

test("a failed chunk stays retryable and the next activation publishes a ready menu", async () => {
  let imports = 0;
  const Menu = () => null;
  const loader = createMenuLoader(async () => {
    imports += 1;
    if (imports === 1) throw new Error("Network offline");
    return Menu;
  });
  const states = [];
  loader.subscribe(() => states.push(loader.getSnapshot().status));

  await loader.load();
  assert.equal(loader.getSnapshot().status, "error");
  assert.equal(loader.getSnapshot().Component, null);
  await loader.load();
  assert.equal(loader.getSnapshot().Component, Menu);
  assert.deepEqual(states, ["loading", "error", "loading", "ready"]);
});

test("unmounting unsubscribes pending imports and hydration always starts with a plain trigger", async () => {
  let resolveImport;
  const loader = createMenuLoader(() => new Promise((resolve) => { resolveImport = resolve; }));
  let notifications = 0;
  const unsubscribe = loader.subscribe(() => { notifications += 1; });
  const pending = loader.load();
  unsubscribe();
  await Promise.resolve();
  resolveImport(() => null);
  await pending;

  assert.equal(notifications, 1, "a desktop resize/unmount receives no late update");
  assert.equal(loader.getSnapshot().status, "ready");
  assert.equal(loader.getServerSnapshot().status, "idle");
  assert.equal(loader.getServerSnapshot().Component, null);
});

test("server-rendered account and mobile shells remain accessible without importing either menu", () => {
  const shells = loadModule("../src/components/partspro/store-deferred-menus.tsx", {
    "./store-menu-loader": loaderExports,
    "@/components/ui/button": {
      Button: (props) => {
        const nativeProps = { ...props };
        delete nativeProps.variant;
        delete nativeProps.size;
        return React.createElement("button", nativeProps);
      },
    },
    "./i18n-provider": { useT: () => (key) => ({ "storefront.header.openMenu": "打开菜单" })[key] },
    "@/i18n/dictionaries/storefront": { tx: (t, key, fallback) => t(key) ?? fallback },
    // If either dynamic import runs during initial rendering, fail this test.
    "./store-account-dropdown": { get StoreAccountDropdown() { throw new Error("account imported eagerly"); } },
    "./store-mobile-menu": { get StoreMobileMenu() { throw new Error("mobile imported eagerly"); } },
  });
  const account = renderToStaticMarkup(React.createElement(shells.StoreDeferredAccountMenu, {
    access: { authenticated: false },
    label: "账户",
    triggerLabel: "打开个人中心",
    accountLabel: "个人中心",
    adminLabel: "管理后台",
    logoutLabel: "退出",
    menuLabel: "账户菜单",
    staffLabel: "员工",
  }));
  assert.equal((account.match(/<button/g) ?? []).length, 1);
  assert.match(account, /aria-label="打开个人中心"/);
  assert.match(account, /aria-haspopup="menu"/);
  assert.match(account, /aria-expanded="false"/);
  assert.doesNotMatch(account, /disabled|role="menu"/);

  const mobile = renderToStaticMarkup(React.createElement(shells.StoreDeferredMobileMenu));
  assert.match(mobile, /aria-label="打开菜单"/);
  assert.match(mobile, /lg:hidden/);
  assert.doesNotMatch(mobile, /disabled|role="dialog"/);
});
