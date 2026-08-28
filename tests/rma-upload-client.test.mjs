import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildRmaSubmitPayload,
  cancelRmaUploadCheckpoint,
  inferRmaImageContentType,
  isRmaImageFile,
  isRmaImageSizeAllowed,
  prepareRmaImage,
  rmaImageIdentity,
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

test("final submit checkpoint retries only the opaque submit after a lost response", async () => {
  const calls = [];
  const checkpoints = [];
  const file = imageFile("lost-response.jpg", "image/jpeg", "lost-response");
  const input = {
    orderLineId: "line-lost",
    quantity: 1,
    reasonCode: "quality_defect",
    requestedResolution: "replacement",
    note: "",
    files: [file],
  };
  let submitAttempts = 0;

  const fetchImpl = async (inputValue, init = {}) => {
    const url = String(inputValue);
    calls.push({ url, init });

    if (url === "/api/rma/drafts" && init.method === "POST") {
      return new Response(JSON.stringify({ data: { id: "draft-lost" } }), { status: 201 });
    }
    if (url === "/api/rma/drafts/draft-lost/uploads" && init.method === "POST") {
      return new Response(JSON.stringify({ data: { attachmentId: "attachment-lost", uploadUrl: "https://storage.test/lost" } }), { status: 201 });
    }
    if (url === "https://storage.test/lost" && init.method === "PUT") {
      return new Response(null, { status: 200 });
    }
    if (url === "/api/rma/drafts/draft-lost/attachments/attachment-lost/complete" && init.method === "POST") {
      return new Response(JSON.stringify({ data: { attachmentId: "attachment-lost", status: "verified" } }), { status: 200 });
    }
    if (url === "/api/rma/submit" && init.method === "POST") {
      submitAttempts += 1;
      if (submitAttempts === 1) {
        throw new TypeError("connection reset after server commit");
      }
      return new Response(JSON.stringify({ data: { id: "rma-lost" } }), { status: 201 });
    }
    throw new Error(`Unexpected request: ${init.method} ${url}`);
  };

  let firstError;
  await assert.rejects(
    submitRmaWithAttachments({
      ...input,
      idempotencyKey: "submit-lost",
      fetchImpl,
      prepareImage: async (selected) => selected,
      onCheckpoint: (checkpoint) => checkpoints.push(checkpoint),
    }),
    (error) => {
      firstError = error;
      return error?.payload?.draftId === "draft-lost" && error?.checkpoint?.payload?.draftId === "draft-lost";
    }
  );

  const checkpoint = checkpoints.at(-1);
  assert.equal(checkpoint.draftId, "draft-lost");
  assert.deepEqual(checkpoint.verifiedAttachmentIds, {
    [rmaImageIdentity(file)]: "attachment-lost",
  });
  assert.deepEqual(checkpoint.pendingCancellationIds, []);
  assert.equal(checkpoint.payload.draftId, "draft-lost");
  assert.equal(firstError.payload.attachmentIds[0], "attachment-lost");

  const resumeCalls = [];
  const resumed = await submitRmaWithAttachments({
    ...input,
    idempotencyKey: "submit-lost",
    checkpoint,
    fetchImpl: async (inputValue, init = {}) => {
      resumeCalls.push({ url: String(inputValue), init });
      return fetchImpl(inputValue, init);
    },
    onCheckpoint: (next) => checkpoints.push(next),
  });

  assert.equal(resumed.data.id, "rma-lost");
  assert.equal(resumeCalls.length, 1);
  assert.equal(resumeCalls[0].url, "/api/rma/submit");
  assert.equal(resumeCalls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(resumeCalls[0].init.body), checkpoint.payload);
  assert.equal(checkpoints.at(-1), null);
  assert.equal(calls.filter(({ url }) => url === "/api/rma/drafts").length, 1);
  assert.equal(calls.filter(({ url }) => url.includes("/uploads")).length, 1);
  assert.equal(calls.filter(({ url, init }) => url.endsWith("/complete") && init.method === "POST").length, 1);

  await assert.rejects(
    submitRmaWithAttachments({
      ...input,
      note: "changed after upload",
      idempotencyKey: "submit-lost",
      checkpoint,
      fetchImpl: async () => {
        throw new Error("checkpoint mismatch must stop before network");
      },
    }),
    (error) => error?.code === "CHECKPOINT_INPUT_MISMATCH"
  );
});

test("resume retains five verified images, settles a failed ticket, and uploads only the missing sixth", async () => {
  const files = Array.from({ length: 6 }, (_, index) => imageFile(`resume-${index}.jpg`, "image/jpeg", `resume-${index}`));
  const calls = [];
  const checkpoints = [];
  let phase = "first";
  let ticketCount = 0;
  let failedTicketId = null;

  const fetchImpl = async (inputValue, init = {}) => {
    const url = String(inputValue);
    calls.push({ phase, url, init });

    if (url === "/api/rma/drafts" && init.method === "POST") {
      return new Response(JSON.stringify({ data: { id: "draft-resume" } }), { status: 201 });
    }
    if (url === "/api/rma/drafts/draft-resume/uploads" && init.method === "POST") {
      ticketCount += 1;
      const attachmentId = `attachment-${ticketCount}`;
      if (ticketCount === 6) {
        failedTicketId = attachmentId;
      }
      return new Response(JSON.stringify({ data: { attachmentId, uploadUrl: `https://storage.test/${attachmentId}` } }), { status: 201 });
    }
    if (url.startsWith("https://storage.test/") && init.method === "PUT") {
      if (phase === "first" && url.endsWith(failedTicketId || "never")) {
        return new Response("temporary failure", { status: 503 });
      }
      return new Response(null, { status: 200 });
    }
    if (url.endsWith("/complete") && init.method === "DELETE") {
      if (phase === "first") {
        return new Response("cleanup unavailable", { status: 500 });
      }
      return new Response(null, { status: 204 });
    }
    if (url.includes("/attachments/") && url.endsWith("/complete") && init.method === "POST") {
      return new Response(JSON.stringify({ data: { status: "verified" } }), { status: 200 });
    }
    if (url === "/api/rma/submit" && init.method === "POST") {
      return new Response(JSON.stringify({ data: { id: "rma-resume" } }), { status: 201 });
    }
    throw new Error(`Unexpected request: ${init.method} ${url}`);
  };

  await assert.rejects(
    submitRmaWithAttachments({
      orderLineId: "line-resume",
      quantity: 1,
      reasonCode: "wrong_item",
      requestedResolution: "replacement",
      files,
      idempotencyKey: "submit-resume",
      fetchImpl,
      prepareImage: async (file) => file,
      onCheckpoint: (checkpoint) => checkpoints.push(checkpoint),
    }),
    (error) => error?.code === "RMA_ATTACHMENT_CANCEL_FAILED"
  );

  const failedCheckpoint = checkpoints.at(-1);
  assert.equal(Object.keys(failedCheckpoint.verifiedAttachmentIds).length, 5);
  assert.deepEqual(failedCheckpoint.pendingCancellationIds, [failedTicketId]);
  assert.equal(ticketCount, 6, "the failed cancellation must prevent the automatic second ticket");

  phase = "resume";
  const callsBeforeResume = calls.length;
  const result = await submitRmaWithAttachments({
    orderLineId: "line-resume",
    quantity: 1,
    reasonCode: "wrong_item",
    requestedResolution: "replacement",
    files,
    idempotencyKey: "submit-resume",
    checkpoint: failedCheckpoint,
    fetchImpl,
    prepareImage: async (file) => file,
    onCheckpoint: (checkpoint) => checkpoints.push(checkpoint),
  });

  assert.equal(result.data.id, "rma-resume");
  const resumedCalls = calls.slice(callsBeforeResume);
  assert.equal(resumedCalls.filter(({ url, init }) => url.endsWith("/complete") && init.method === "DELETE").length, 1);
  assert.equal(resumedCalls.filter(({ url, init }) => url.includes("/uploads") && init.method === "POST").length, 1);
  assert.equal(resumedCalls.filter(({ url, init }) => url.endsWith("/complete") && init.method === "POST").length, 1);
  assert.equal(resumedCalls.filter(({ url }) => url === "/api/rma/drafts").length, 0);
  assert.equal(resumedCalls.filter(({ url }) => url === "/api/rma/submit").length, 1);
  assert.equal(checkpoints.at(-1), null);
});

test("explicit checkpoint restart cancels every opaque attachment before clearing state", async () => {
  const calls = [];
  const checkpoint = {
    version: 1,
    draftId: "draft-restart",
    verifiedAttachmentIds: { first: "attachment-first", second: "attachment-second" },
    pendingCancellationIds: ["attachment-pending"],
    inputFingerprint: "fingerprint",
    payload: null,
  };
  const cleared = [];
  const result = await cancelRmaUploadCheckpoint({
    checkpoint,
    fetchImpl: async (input, init = {}) => {
      calls.push({ url: String(input), init });
      return new Response(null, { status: 204 });
    },
    onCheckpoint: (next) => cleared.push(next),
  });

  assert.equal(result, null);
  assert.equal(calls.length, 3);
  assert.equal(calls.every(({ init }) => init.method === "DELETE"), true);
  assert.equal(cleared.at(-1), null);
});

test("checkpoint restart preserves only unresolved cancellations after a non-2xx response", async () => {
  const checkpoint = {
    version: 1,
    draftId: "draft-restart-partial",
    verifiedAttachmentIds: { first: "attachment-first", second: "attachment-second" },
    pendingCancellationIds: [],
    inputFingerprint: "fingerprint",
    payload: null,
  };
  let attempt = 0;
  const checkpoints = [];

  await assert.rejects(
    cancelRmaUploadCheckpoint({
      checkpoint,
      fetchImpl: async (input, init = {}) => {
        assert.equal(init.method, "DELETE");
        attempt += 1;
        return new Response(null, { status: attempt === 2 ? 500 : 204 });
      },
      onCheckpoint: (next) => checkpoints.push(next),
    }),
    (error) => error?.code === "RMA_ATTACHMENT_CANCEL_FAILED"
  );

  const unresolved = checkpoints.at(-1);
  assert.deepEqual(unresolved.pendingCancellationIds, ["attachment-second"]);
  assert.deepEqual(unresolved.verifiedAttachmentIds, { second: "attachment-second" });

  await cancelRmaUploadCheckpoint({
    checkpoint: unresolved,
    fetchImpl: async () => new Response(null, { status: 204 }),
    onCheckpoint: (next) => checkpoints.push(next),
  });
  assert.equal(checkpoints.at(-1), null);
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
  assert.match(source, /verifiedAttachmentIds/);
  assert.match(source, /pendingCancellationIds/);
  assert.match(source, /onCheckpoint/);
  assert.match(source, /return response\.ok/);
});
