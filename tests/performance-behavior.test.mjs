import assert from "node:assert/strict";
import { test } from "node:test";
import { createLatestRequest } from "../src/lib/latest-request.mjs";
import { canOptimizeImage, productImageRemotePatterns } from "../src/lib/partspro-image-policy.mjs";

test("slow pagination cannot append to a newer catalog filter, even after network completion", () => {
  const requests = createLatestRequest();
  const more = requests.begin();
  const selection = requests.begin();
  assert.equal(more.signal.aborted, true);
  assert.equal(more.isCurrent(), false);
  assert.equal(selection.isCurrent(), true);
});

test("cached selections and unmount cancel old responses and errors", () => {
  const requests = createLatestRequest();
  const old = requests.begin();
  requests.begin(); // The latest selection may be served from cache.
  assert.equal(old.isCurrent(), false);
  const current = requests.begin();
  requests.cancel();
  assert.equal(current.isCurrent(), false);
  assert.equal(current.signal.aborted, true);
});

test("image optimization is restricted to configured public sources", () => {
  const base = "https://project.supabase.co";
  for (const url of ["/home/poster.jpg", `${base}/storage/v1/object/public/product-images/a.jpg`, "https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/123?size=bg"]) {
    assert.equal(canOptimizeImage(url, base), true, url);
  }
  for (const url of ["https://supplier.example/a.jpg", "blob:abc", "data:image/png;base64,abc", "//supplier.example/a.jpg", `${base}/storage/v1/object/sign/product-images/a.jpg`, "https://project.supabase.co.evil.example/storage/v1/object/public/product-images/a.jpg", "http://project.supabase.co/storage/v1/object/public/product-images/a.jpg"]) {
    assert.equal(canOptimizeImage(url, base), false, url);
  }
  assert.equal(productImageRemotePatterns(base).length, 2);
});
