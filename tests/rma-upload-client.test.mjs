import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildRmaSubmitPayload,
  inferRmaImageContentType,
  isRmaImageFile,
  isRmaImageSizeAllowed,
  prepareRmaImage,
  rmaAttachmentContentTypes,
  rmaMaxAttachmentBytes,
  rmaMaxAttachments,
  selectRmaImageFiles,
  sha256Hex,
  submitRmaWithAttachments,
} from "../src/lib/partspro-rma-upload-client.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");
const imageFile = (name, type = "image/jpeg", content = "image") =>
  new File([content], name, { type, lastModified: 1 });

test("RMA image selection enforces shared MIME, count and HEIC size policy", () => {
  assert.deepEqual(rmaAttachmentContentTypes, [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);
  assert.equal(rmaMaxAttachments, 6);
  assert.equal(rmaMaxAttachmentBytes, 4 * 1024 * 1024);
  assert.equal(inferRmaImageContentType("", "phone.HEIC"), "image/heic");
  assert.equal(inferRmaImageContentType("video/mp4", "phone.jpg"), null);
  assert.equal(isRmaImageFile(imageFile("phone.webp", "image/webp")), true);
  assert.equal(isRmaImageFile(imageFile("phone.mp4", "video/mp4")), false);
  assert.equal(isRmaImageSizeAllowed(4 * 1024 * 1024), true);
  assert.equal(isRmaImageSizeAllowed(4 * 1024 * 1024 + 1), false);

  const firstSix = Array.from({ length: 6 }, (_, index) => imageFile(`photo-${index}.jpg`));
  const selected = selectRmaImageFiles([], [...firstSix, imageFile("photo-6.jpg")]);
  assert.equal(selected.accepted.length, 6);
  assert.equal(selected.remainingSlots, 0);
  assert.equal(selected.rejected.at(-1)?.reason, "max_images");

  const rejected = selectRmaImageFiles([], [
    imageFile("clip.mp4", "video/mp4"),
    imageFile("large.heic", "image/heic", "x".repeat(rmaMaxAttachmentBytes + 1)),
  ]);
  assert.deepEqual(rejected.rejected.map(({ reason }) => reason), [
    "unsupported_image_type",
    "heic_image_over_4mb",
  ]);
});

test("RMA image preparation preserves supported small HEIC and reports uncompressible oversized files", async () => {
  const heic = imageFile("device.heic", "image/heic", "small-heic");
  const prepared = await prepareRmaImage(heic);
  assert.equal(prepared.name, "device.heic");
  assert.equal(prepared.type, "image/heic");
  assert.equal(prepared.size, heic.size);

  const oversizedJpeg = imageFile(
    "large.jpg",
    "image/jpeg",
    "x".repeat(rmaMaxAttachmentBytes + 1)
  );
  await assert.rejects(
    prepareRmaImage(oversizedJpeg),
    (error) => error?.code === "IMAGE_COMPRESSION_UNAVAILABLE"
  );
});

test("SHA-256 covers the actual upload Blob", async () => {
  assert.equal(
    await sha256Hex(new Blob(["partspro-rma"])),
    "70db77e06eb4678850d6d5f2d56115ebdc665d47305cdb75f1992804fdfe55ec"
  );
});

test("new protocol uses signed PUT, complete SHA, one retry and ticket DELETE compensation", async () => {
  const calls = [];
  let uploadAttempt = 0;
  let ticketAttempt = 0;
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });

    if (url === "/api/rma/drafts" && init.method === "POST") {
      return new Response(JSON.stringify({ data: { id: "draft-1" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }

    if (url === "/api/rma/drafts/draft-1/uploads" && init.method === "POST") {
      ticketAttempt += 1;
      return new Response(
        JSON.stringify({ data: { attachmentId: `attachment-${ticketAttempt}`, uploadUrl: `https://storage.test/${ticketAttempt}` } }),
        { status: 201, headers: { "content-type": "application/json" } }
      );
    }

    if (url.startsWith("https://storage.test/") && init.method === "PUT") {
      uploadAttempt += 1;
      if (uploadAttempt === 1) {
        return new Response("temporary upload failure", { status: 503 });
      }
      return new Response(null, { status: 200 });
    }

    if (url === "/api/rma/drafts/draft-1/attachments/attachment-1/complete" && init.method === "DELETE") {
      return new Response(JSON.stringify({ data: true }), { status: 200 });
    }

    if (url === "/api/rma/drafts/draft-1/attachments/attachment-2/complete" && init.method === "POST") {
      assert.deepEqual(JSON.parse(init.body), {
        sha256: "de7030234493a8bea844dbe1d8676e68a2c1a4b014c721f0425a22b6df66faec",
      });
      return new Response(JSON.stringify({ data: { attachmentId: "attachment-2", status: "verified" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url === "/api/rma/submit" && init.method === "POST") {
      return new Response(JSON.stringify({ data: { id: "rma-1", rmaNo: "RMA-0001" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected request: ${init.method} ${url}`);
  };

  const result = await submitRmaWithAttachments({
    orderLineId: "line-1",
    quantity: 1,
    reasonCode: "quality_defect",
    requestedResolution: "wallet_credit",
    note: "test note",
    files: [imageFile("screen.jpg", "image/jpeg", "image bytes")],
    idempotencyKey: "rma-submit-key",
    fetchImpl,
    prepareImage: async (file) => file,
  });

  assert.deepEqual(result.attachmentIds, ["attachment-2"]);
  assert.equal(calls.filter(({ init }) => init.method === "PUT").length, 2);
  assert.equal(calls.filter(({ init }) => init.method === "DELETE").length, 1);
  assert.equal(calls.filter(({ url }) => url === "/api/rma/submit").length, 1);

  const putCall = calls.find(({ init }) => init.method === "PUT" && init.body instanceof FormData);
  assert.ok(putCall);
  assert.equal(putCall.init.headers["x-upsert"], "false");
  assert.deepEqual([...putCall.init.body.keys()], ["cacheControl", ""]);
  assert.equal(putCall.init.body.get("cacheControl"), "3600");

  assert.deepEqual(Object.keys(result.payload).sort(), [
    "attachmentIds",
    "draftId",
    "idempotencyKey",
    "note",
    "orderLineId",
    "quantity",
    "reasonCode",
    "requestedResolution",
  ]);
  for (const forbidden of ["bucket", "path", "signedUrl", "url", "sku", "orderId"]) {
    assert.equal(Object.hasOwn(result.payload, forbidden), false, forbidden);
  }
});

test("submit payload helper is explicit and the client never references legacy evidence or video", () => {
  const payload = buildRmaSubmitPayload({
    draftId: "draft-1",
    orderLineId: "line-1",
    quantity: 1,
    reasonCode: "wrong_item",
    requestedResolution: "replacement",
    attachmentIds: ["attachment-1"],
    idempotencyKey: "submit-key",
  });
  assert.deepEqual(payload, {
    draftId: "draft-1",
    orderLineId: "line-1",
    quantity: 1,
    reasonCode: "wrong_item",
    requestedResolution: "replacement",
    attachmentIds: ["attachment-1"],
    idempotencyKey: "submit-key",
  });

  const source = read("src/lib/partspro-rma-upload-client.mjs");
  assert.doesNotMatch(source, /\/api\/rma\/evidence/);
  assert.doesNotMatch(source, /video\//i);
});
