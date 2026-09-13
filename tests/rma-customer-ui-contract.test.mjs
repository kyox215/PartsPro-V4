import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import { toCustomerRmaPrivacySafeFields } from "../src/lib/partspro-rma-customer-order.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");
const page = read("src/app/rma/page.tsx");
const component = read("src/components/partspro/rma-page.tsx");
const uploadClient = read("src/lib/partspro-rma-upload-client.mjs");
const customerContract = read("src/lib/partspro-rma-contract.ts");
const customerDto = read("src/lib/partspro-rma-customer-dto.ts");
const simpleFlow = read("src/lib/partspro-rma-simple-flow.ts");
const typescript = createRequire(import.meta.url)("typescript");

test("customer RMA page passes order, line and request query selections through the server page", () => {
  assert.match(page, /params\.order/);
  assert.match(page, /params\.line/);
  assert.match(page, /params\.requestId/);
  assert.match(page, /initialOrderLineId/);
  assert.match(page, /initialRequestId/);
  assert.match(component, /initialOrderLineId/);
  assert.match(component, /initialRequestId/);
  assert.match(component, /scrollIntoView/);
});

test("customer UI is a responsive three-block photo-first flow", () => {
  assert.equal((component.match(/<RmaStep\b/g) ?? []).length, 3);
  for (const number of ["1", "2", "3"]) {
    assert.match(component, new RegExp(`number="${number}"`));
  }
  assert.match(component, /rmaReasonCodes/);
  for (const reason of [
    "quality_defect",
    "shipping_damage",
    "not_as_described",
    "wrong_item",
    "missing_or_quantity_error",
    "withdrawal_no_longer_needed",
  ]) {
    assert.match(component, new RegExp(reason));
  }
  assert.match(component, /rmaResolutionCodes/);
  assert.match(component, /wallet_credit/);
  assert.match(component, /rmaMaxAttachments/);
  assert.match(component, /remainingQuantity/);
  assert.match(component, /value=\{form\.quantity\}/);
  assert.doesNotMatch(component, /noteRequired/);
  assert.doesNotMatch(component, /storefront\.rma\.note\.required/);
  assert.match(component, /canSubmit = Boolean\(selectedLine && quantityIsValid && images\.length > 0\)/);
});

test("camera and gallery controls expose only supported image inputs", () => {
  assert.match(component, /id="rma-camera"/);
  assert.match(component, /accept="image\/\*"[\s\S]*capture="environment"/);
  assert.match(component, /id="rma-gallery"/);
  assert.match(component, /id="rma-gallery"[\s\S]*accept="image\/\*"[\s\S]*multiple/);
  assert.match(component, /selectRmaImageFiles/);
  assert.match(component, /URL\.createObjectURL/);
  assert.match(component, /URL\.revokeObjectURL/);
  assert.match(component, /onProgress/);
  assert.match(component, /submittingRef/);
  assert.match(component, /if \(submittingRef\.current\)/);
  assert.match(component, /areRmaControlsLocked/);
  assert.match(component, /controlsLocked/);
  assert.match(component, /disabled=\{controlsLocked/);
  assert.equal((component.match(/submitRmaWithAttachments\(/g) ?? []).length, 1);
  assert.doesNotMatch(component, /\/api\/rma\/evidence/);
  assert.doesNotMatch(component, /<video|video\//i);
  assert.doesNotMatch(component, /evidenceChecklist|technical|problemCategories/);
});

test("customer submit uses the new upload orchestrator and safe DTO history", () => {
  assert.match(component, /submitRmaWithAttachments/);
  assert.match(component, /CustomerRmaDto/);
  assert.match(component, /draftIdempotencyKey/);
  assert.match(component, /submitIdempotencyKey/);
  assert.match(component, /cancelRmaUploadCheckpoint/);
  assert.match(component, /onCheckpoint: handleUploadCheckpoint/);
  assert.match(component, /checkpoint: uploadCheckpointRef\.current/);
  assert.match(component, /isAbandoningCheckpoint/);
  assert.match(component, /storefront\.rma\.upload\.confirmSubmit/);
  assert.match(component, /storefront\.rma\.upload\.abandonRestart/);
  assert.match(component, /storefront\.rma\.upload\.cleanupHint/);
  assert.match(component, /rmaNo \?\? savedRequest\.id/);
  assert.match(component, /request\.orderNumber/);
  assert.match(component, /customerStage/);
  assert.match(component, /rmaCustomerStageLabel/);
  assert.match(component, /request\.attachments/);
  assert.doesNotMatch(component, /type RmaRequest\b|import[^;]*RmaRequest/);
  assert.doesNotMatch(component, /request\.status/);
  assert.match(uploadClient, /\/api\/rma\/drafts/);
  assert.match(uploadClient, /\/api\/rma\/submit/);
  assert.match(uploadClient, /method: "PUT"/);
  assert.match(uploadClient, /cacheControl/);
  assert.match(uploadClient, /sha256Hex/);
  assert.match(uploadClient, /\/complete/);
  assert.match(uploadClient, /method: "DELETE"/);
  assert.match(uploadClient, /phase === "abandoning"/);
  assert.match(uploadClient, /RMA_UPLOAD_ABANDONED/);
});

test("customer UI has no confirmation modal and final request remains opaque", () => {
  assert.doesNotMatch(component, /Dialog|window\.confirm|confirm\(/);
  const submitStart = uploadClient.indexOf("export function buildRmaSubmitPayload");
  const submitEnd = uploadClient.indexOf("export async function submitRmaWithAttachments");
  const payloadHelper = uploadClient.slice(submitStart, submitEnd);
  for (const forbidden of ["bucket", "path", "signedUrl", "uploadUrl", "orderId", "sku"]) {
    assert.doesNotMatch(payloadHelper, new RegExp(`\\b${forbidden}\\b`));
  }
});

test("customer upload errors use locale-aware tx copy without exposing server messages", () => {
  const messageFor = loadRmaUploadErrorMessage();
  const untranslated = (key) => key;
  const internalMessage = "The image upload ticket could not be created. Internal storage diagnostics.";

  for (const error of [
    { code: "RMA_UPLOAD_TICKET_FAILED", message: internalMessage, status: 503 },
    { code: "HTTP_502", message: internalMessage, status: 502 },
  ]) {
    assert.equal(messageFor(error, untranslated, "zh-CN"), "售后上传服务暂时不可用，请稍后在本页重试。");
    assert.equal(messageFor(error, untranslated, "it-IT"), "Il servizio di caricamento resi non è disponibile al momento. Riprova tra poco da questa pagina.");
  }

  const cleanupError = { code: "RMA_DRAFT_CLEANUP_PENDING", status: 503, message: internalMessage };
  assert.equal(messageFor(cleanupError, untranslated, "zh-CN", "abandon"), "无法清理上传状态，请重试。");
  assert.equal(messageFor(cleanupError, untranslated, "it-IT", "abandon"), "Impossibile pulire lo stato del caricamento. Riprova.");
  const submittedError = { code: "RMA_DRAFT_ALREADY_SUBMITTED", status: 409, message: internalMessage };
  assert.equal(messageFor(submittedError, untranslated, "zh-CN", "abandon"), "申请已提交，请查看最近申请，无需重新上传。");
  assert.equal(messageFor(submittedError, untranslated, "it-IT", "abandon"), "La richiesta è già stata inviata. Controlla le richieste recenti: non occorre caricare di nuovo le foto.");
  assert.match(messageFor({ code: "RMA_IDEMPOTENCY_CONFLICT", status: 409 }, untranslated, "zh-CN", "abandon"), /申请状态已变化/);
  assert.equal(messageFor({ code: "LOGIN_REQUIRED", status: 401 }, untranslated, "zh-CN"), "登录已失效，请重新登录后重试。");
  assert.match(messageFor({ code: "LOGIN_REQUIRED", status: 401 }, untranslated, "it-IT"), /Accedi di nuovo/);
  assert.match(messageFor({ code: "RMA_ATTACHMENT_CANCEL_FAILED" }, untranslated, "zh-CN"), /重新开始上传/);
  assert.match(messageFor({ code: "RMA_ATTACHMENT_CANCEL_FAILED" }, untranslated, "it-IT"), /Ricomincia upload/);
  assert.match(messageFor({ code: "IMAGE_TOO_LARGE" }, untranslated, "zh-CN"), /4 MB/);
  assert.match(messageFor({ code: "IMAGE_TOO_LARGE" }, untranslated, "it-IT"), /4 MB/);

  for (const error of [null, new Error(internalMessage), { code: "UNKNOWN_SERVER_ERROR", message: internalMessage }]) {
    assert.equal(messageFor(error, untranslated, "zh-CN"), "暂时无法完成售后申请，请重试；如仍失败，请联系客服。");
    assert.equal(messageFor(error, untranslated, "it-IT"), "Non è stato possibile completare la richiesta di reso. Riprova; se il problema persiste, contatta l'assistenza.");
  }

  assert.equal(messageFor(
    { code: "RMA_UPLOAD_TICKET_FAILED", status: 503 },
    (key) => key === "storefront.rma.upload.serviceError" ? "来自现有字典的提示" : key,
    "zh-CN"
  ), "来自现有字典的提示");

  assert.match(component, /const \{ t, locale \} = useI18n\(\)/);
  assert.match(component, /rmaUploadErrorMessage\(error, t, locale, "abandon"\)/);
  assert.match(component, /rmaUploadErrorMessage\(error, t, locale\)/);
  const uploadActions = component.slice(component.indexOf("async function restartRmaUpload("), component.indexOf("async function markRequestShipped("));
  assert.doesNotMatch(uploadActions, /error\.message/);
});

test("already-submitted recovery clears local upload state and reloads recent requests and refundable quantities", async () => {
  const revokedPreviews = [];
  const requests = [];
  const state = {
    images: [{ previewUrl: "blob:first" }, { previewUrl: "blob:second" }],
    imageError: "old upload error",
    uploadProgress: "verifying",
    orderOptions: [{ id: "order-1", lines: [{ id: "line-1", remainingQuantity: 2 }] }],
    recentRequests: [],
    form: { orderId: "order-1", orderLineId: "line-1", quantity: "2" },
    dataLoading: false,
    dataError: null,
    revision: 0,
    submitState: { status: "error", message: "response lost" },
  };
  const uploadCheckpointRef = { current: { phase: "abandoning", payload: null } };
  const imagesRef = { current: state.images };
  const imageIndexRef = { current: 1 };
  const draftIdempotencyKeyRef = { current: "old-draft-key" };
  const submitIdempotencyKeyRef = { current: "old-submit-key" };
  const set = (key) => (next) => { state[key] = typeof next === "function" ? next(state[key]) : next; };
  const helpers = loadRmaPageHelpers([
    "recoverAlreadySubmittedRma", "loadRmaData", "rmaUploadErrorMessage", "isRecord", "readApiError",
    "sanitizeFormSelection", "createQuantityOptions", "applyInitialOrderSelection",
  ], {
    active: true,
    initialOrderId: undefined,
    initialOrderLineId: undefined,
    initialSelectionAppliedRef: { current: true },
    uploadCheckpointRef,
    imagesRef,
    imageIndexRef,
    draftIdempotencyKeyRef,
    submitIdempotencyKeyRef,
    t: (key) => key,
    locale: "zh-CN",
    URL: { revokeObjectURL: (preview) => revokedPreviews.push(preview) },
    handleUploadCheckpoint: (next) => { uploadCheckpointRef.current = next; },
    setImages: set("images"),
    setImageError: set("imageError"),
    setUploadProgress: set("uploadProgress"),
    setOrderOptions: set("orderOptions"),
    setRecentRequests: set("recentRequests"),
    setForm: set("form"),
    setDataLoading: set("dataLoading"),
    setDataError: set("dataError"),
    setRmaDataRevision: set("revision"),
    setSubmitState: set("submitState"),
    fetch: async (url, init) => {
      requests.push({ url, init });
      assert.equal(url, "/api/rma");
      assert.equal(init.cache, "no-store");
      assert.equal(init.credentials, "same-origin");
      assert.equal(uploadCheckpointRef.current, null);
      assert.equal(state.images.length, 0);
      assert.equal(state.orderOptions.length, 0, "stale quantities must be hidden before refresh");
      return Response.json({
        data: [{ id: "rma-already-submitted", rmaNo: "RMA-001" }],
        meta: { orderOptions: [{ id: "order-1", lines: [{ id: "line-1", remainingQuantity: 1 }] }] },
      });
    },
  });

  assert.equal(helpers.recoverAlreadySubmittedRma({ code: "RMA_IDEMPOTENCY_CONFLICT", status: 409 }), false);
  assert.equal(state.revision, 0);
  assert.equal(state.images.length, 2);
  assert.notEqual(uploadCheckpointRef.current, null);

  assert.equal(helpers.recoverAlreadySubmittedRma({ code: "RMA_DRAFT_ALREADY_SUBMITTED", status: 409 }), true);
  assert.equal(uploadCheckpointRef.current, null);
  assert.deepEqual(revokedPreviews, ["blob:first", "blob:second"]);
  assert.equal(state.images.length, 0);
  assert.equal(imagesRef.current.length, 0);
  assert.equal(state.imageError, null);
  assert.equal(state.uploadProgress, null);
  assert.equal(imageIndexRef.current, null);
  assert.equal(draftIdempotencyKeyRef.current, null);
  assert.equal(submitIdempotencyKeyRef.current, null);
  assert.equal(state.revision, 1);
  assert.equal(state.dataLoading, true);
  assert.equal(state.submitState.status, "submitted");
  assert.equal(state.submitState.message, "申请已提交，请查看最近申请，无需重新上传。");

  await helpers.loadRmaData();
  assert.equal(requests.length, 1);
  assert.equal(state.recentRequests[0].id, "rma-already-submitted");
  assert.equal(state.orderOptions[0].lines[0].remainingQuantity, 1);
  assert.equal(state.form.quantity, "1");
  assert.equal(state.dataLoading, false);
  assert.equal(state.dataError, null);

  assert.match(component, /\[initialOrderId, initialOrderLineId, rmaDataRevision\]/);
  assert.equal((component.match(/if \(recoverAlreadySubmittedRma\(error\)\)/g) ?? []).length, 2);
  assert.match(component, /const isSuccess = state\.status === "success" \|\| state\.status === "submitted"/);
});

test("customer can mark an approved request shipped in one tap with optional logistics", () => {
  assert.match(component, /shippingPendingRef/);
  assert.match(component, /shippingPendingRef\.current\.has\(request\.id\)/);
  assert.match(component, /method: "POST"/);
  assert.match(component, /\/api\/rma\/\$\{encodeURIComponent\(request\.id\)\}\/shipped/);
  assert.match(component, /Object\.keys\(shippingDetails\)\.length > 0 \? JSON\.stringify\(shippingDetails\) : "\{\}"/);
  assert.match(component, /canMarkShipped/);
  assert.match(component, /storefront\.rma\.shipped\.button/);
  assert.match(component, /storefront\.rma\.shipped\.details/);
  assert.match(component, /storefront\.rma\.shipped\.carrier/);
  assert.match(component, /storefront\.rma\.shipped\.tracking/);
  assert.match(component, /setRecentRequests\(\(current\) =>[\s\S]*current\.map\(\(item\) => \(item\.id === savedRequest\.id \? savedRequest : item\)\)/);
  assert.match(component, /customerShippedAt/);
  assert.match(component, /shippingNotice\.tone === "error"/);
  assert.match(component, /const EMPTY_SHIPPING_DRAFT: Readonly<ShippingDraft>/);
  assert.match(component, /shippingDrafts\[request\.id\] \?\? EMPTY_SHIPPING_DRAFT/);
  assert.doesNotMatch(component, /Dialog|window\.confirm|confirm\(/);
});

test("customer DTO exposes a safe order number and the canonical flow resolves it by customer-owned order", () => {
  assert.match(customerContract, /orderNumber: string \| null/);
  assert.match(customerDto, /orderId: privacySafeFields\.orderId/);
  assert.match(customerDto, /orderNumber: privacySafeFields\.orderNumber/);
  assert.match(simpleFlow, /select\("id,rma_no,order_id,order_no,customer_id/);
  assert.match(simpleFlow, /\.from\("orders"\)[\s\S]*\.select\("id,order_no"\)[\s\S]*\.eq\("id", orderId\)[\s\S]*\.eq\("customer_id", customerId\)/);
  assert.match(simpleFlow, /orderNumber,/);

  const safe = toCustomerRmaPrivacySafeFields({
    orderNumber: "ORD-2026-0010",
    orderId: "11111111-1111-4111-8111-111111111111",
    requestedResolution: "replacement",
    labResult: "internal-only",
    resolutionNote: "internal-only",
    refundAmount: 99,
  });

  assert.deepEqual(safe.orderId, "ORD-2026-0010");
  assert.deepEqual(safe.orderNumber, "ORD-2026-0010");
  assert.deepEqual(safe.requestedResolution, "replacement");
  assert.equal(Object.hasOwn(safe, "labResult"), false);
  assert.equal(Object.hasOwn(safe, "resolutionNote"), false);
  assert.equal(Object.hasOwn(safe, "refundAmount"), false);

  const uuidOnly = toCustomerRmaPrivacySafeFields({
    orderId: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(uuidOnly.orderId, null);
  assert.equal(uuidOnly.orderNumber, null);
});

function loadRmaUploadErrorMessage() {
  return loadRmaPageHelpers(["rmaUploadErrorMessage", "isRecord"]).rmaUploadErrorMessage;
}

function loadRmaPageHelpers(names, bindings = {}) {
  const sourceFile = typescript.createSourceFile("rma-page.tsx", component, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TSX);
  const declarations = new Map();
  const visit = (node) => {
    if (typescript.isFunctionDeclaration(node) && node.name) {
      declarations.set(node.name.text, node);
    }
    typescript.forEachChild(node, visit);
  };
  visit(sourceFile);
  const helperSource = names.map((name) => {
    const declaration = declarations.get(name);
    assert.ok(declaration, `${name} helper is required`);
    return declaration.getText(sourceFile);
  }).join("\n");
  const compiled = typescript.transpileModule(`${helperSource}\nglobalThis.helpers = { ${names.join(", ")} };`, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2020 },
  });
  const context = {
    tx: (t, key, fallback) => {
      const value = t(key);
      return value === key ? fallback : value;
    },
    ...bindings,
  };
  vm.runInNewContext(compiled.outputText, context);
  return context.helpers;
}
