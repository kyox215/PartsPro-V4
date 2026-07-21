import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cartSyncSourcePath = new URL(
  "../src/components/partspro/cart-sync-bridge.tsx",
  import.meta.url
);
const checkoutSourcePath = new URL(
  "../src/components/partspro/checkout-client.tsx",
  import.meta.url
);

test("remote cart restore and requests have bounded deadlines", async () => {
  const source = await readFile(cartSyncSourcePath, "utf8");

  assert.match(source, /const remoteCartRequestTimeoutMs = 10_000;/);
  assert.match(source, /const sessionRestoreDeadlineMs = 15_000;/);
  assert.match(source, /fetchWithTimeout\("\/api\/cart"/);
  assert.match(source, /enterRestoringMode\(restoreDeadlineAt\)/);
  assert.match(
    source,
    /restoreDeadlineTimeout = window\.setTimeout\(\(\) => \{[\s\S]*?enterRemoteErrorMode\("Unable to restore remote cart session"/
  );
});

test("order preview waits for cart readiness and has a timeout", async () => {
  const source = await readFile(checkoutSourcePath, "utf8");

  assert.match(source, /const previewRequestTimeoutMs = 15_000;/);
  assert.match(
    source,
    /const isRemoteCartReadyForPreview =[\s\S]*?remoteStatus === "ready"[\s\S]*?remoteStatus === "local";/
  );
  assert.match(
    source,
    /const shouldLoadPreview =[\s\S]*?isRemoteCartReadyForPreview;/
  );
  assert.match(
    source,
    /requestTimeout = window\.setTimeout\(\(\) => \{[\s\S]*?controller\.abort\(\);[\s\S]*?previewRequestTimeoutMs/
  );
});

test("checkout status prioritizes remote cart before catalog and preview", async () => {
  const source = await readFile(checkoutSourcePath, "utf8");
  const syncStateStart = source.indexOf("function buildCheckoutSyncState");
  const syncStateEnd = source.indexOf("function buildCheckoutBlockers", syncStateStart);
  const syncStateSource = source.slice(syncStateStart, syncStateEnd);
  const remoteCartIndex = syncStateSource.indexOf("if (remoteCartLoading)");
  const catalogIndex = syncStateSource.indexOf("if (catalogResolutionPending)");
  const previewIndex = syncStateSource.indexOf(
    'if (previewQueued || preview.status === "loading")'
  );

  assert.ok(remoteCartIndex >= 0, "remote cart loading branch must exist");
  assert.ok(catalogIndex > remoteCartIndex, "catalog must follow remote cart loading");
  assert.ok(previewIndex > catalogIndex, "preview must follow catalog resolution");
});
