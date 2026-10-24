import test from "node:test";
import assert from "node:assert/strict";
import { packingSlipPreview, waitForPackingSlipImages } from "../src/lib/admin-order-print.mjs";

const document = id => `<html><head><style>@page { size: A4; } * {box-sizing:border-box} body {color:black} th, td {padding:6px} @media print { body { print-color-adjust:exact; } }</style></head><body><main class="sheet">${id} &lt;escaped&gt;</main></body></html>`;

test("single and batch previews retain complete sheets while scoping screen and nested print styles", () => {
  const preview = packingSlipPreview(Array.from({length: 5}, (_, index) => document(`ORDER-${index}`)));
  assert.equal((preview.body.match(/class="order-print-page"/g) ?? []).length, 5);
  for (let index = 0; index < 5; index++) assert.ok(preview.body.includes(`ORDER-${index}`));
  assert.match(preview.body, /&lt;escaped&gt;/);
  assert.doesNotMatch(preview.body, /<html|<body|<head|<style/);
  assert.match(preview.styles, /\.order-print-document th, \.order-print-document td/);
  assert.match(preview.styles, /@media print\s*\{\s*\.order-print-document\s*\{/);
  assert.doesNotMatch(preview.styles, /\bbody\s*\{/);
});

test("empty, invalid or over-limit print requests fail before rendering partial documents", () => {
  for (const documents of [[], ["<html>invalid</html>"], [document("valid"), "invalid"], Array.from({length:51}, () => document("x"))]) {
    assert.throws(() => packingSlipPreview(documents));
  }
});

class Image extends EventTarget {
  complete = false;
  handlers = new Set();
  addEventListener(type, handler, options) { this.handlers.add(handler); super.addEventListener(type, handler, options); }
  removeEventListener(type, handler, options) { super.removeEventListener(type, handler, options); this.handlers.delete(handler); }
}

test("image load, failed load and cached image all allow manual print preparation to finish", async () => {
  const first = new Image(), failed = new Image(), cached = new Image(); cached.complete = true;
  const controller = new AbortController();
  const waiting = waitForPackingSlipImages([first, failed, cached], controller.signal);
  first.dispatchEvent(new Event("load")); failed.dispatchEvent(new Event("error"));
  await waiting;
  assert.equal(first.handlers.size, 0); assert.equal(failed.handlers.size, 0);
});

test("closing during image loading aborts waiting; slow images time out without trapping navigation", async () => {
  const image = new Image(), controller = new AbortController();
  const waiting = waitForPackingSlipImages([image], controller.signal, 10000);
  controller.abort(); await waiting; assert.equal(image.handlers.size, 0);
  const start = Date.now();
  await waitForPackingSlipImages([new Image()], new AbortController().signal, 10);
  assert.ok(Date.now() - start < 1000);
});
