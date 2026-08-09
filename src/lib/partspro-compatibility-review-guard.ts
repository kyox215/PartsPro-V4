import * as productImportCore from "@/lib/partspro-product-import-core.mjs";

/**
 * The fields consumed by the compatibility completeness analyzer.  Keep this
 * list narrower than the product write schema: a price/image/status update
 * must not accidentally become a compatibility review operation.
 */
export const compatibilityReviewFields = [
  "name",
  "brand",
  "model",
  "modelCode",
  "modelCodes",
  "compatibleWith",
] as const;

export type CompatibilityReviewField = (typeof compatibilityReviewFields)[number];

export type CompatibilityReviewProductInput = {
  name?: unknown;
  brand?: unknown;
  model?: unknown;
  compatibilityModels?: unknown;
  modelCodes?: unknown;
  compatibilityManaged?: unknown;
};

export type ProductCompatibilityReview = {
  required: boolean;
  reasonCodes: string[];
  signalCount: number;
  structuredModelCount: number;
  signals: unknown[];
  fingerprint: string;
};

export type CompatibilityReviewConfirmation = {
  confirmed: boolean;
  fingerprint: string | null;
};

type CompatibilityReviewAnalyzer = (
  input: CompatibilityReviewProductInput
) => ProductCompatibilityReview;

/**
 * Read the review acknowledgement from the request envelope only.  The
 * acknowledgement deliberately never enters the product Zod payload or the
 * repository RPC payload.
 */
export function readCompatibilityReviewConfirmation(
  body: unknown
): CompatibilityReviewConfirmation | null {
  if (!isRecord(body) || !hasOwn(body, "compatibilityReview")) {
    return null;
  }

  const review = body.compatibilityReview;

  if (!isRecord(review)) {
    return { confirmed: false, fingerprint: null };
  }

  const fingerprint =
    typeof review.fingerprint === "string" && review.fingerprint.trim().length > 0
      ? review.fingerprint.trim()
      : null;

  return {
    confirmed: review.confirmed === true,
    fingerprint,
  };
}

export function hasCompatibilityReviewField(
  payload: Record<string, unknown>
): boolean {
  return compatibilityReviewFields.some((field) => hasOwn(payload, field));
}

export function hasManagedCompatibilityPatch(
  payload: Record<string, unknown>
): boolean {
  return hasOwn(payload, "compatibleWith") || hasOwn(payload, "modelCodes");
}

export function mergeCompatibilityReviewProduct(
  current: CompatibilityReviewProductInput,
  patch: Record<string, unknown>
): CompatibilityReviewProductInput {
  const modelCodes = hasOwn(patch, "modelCodes")
    ? patch.modelCodes
    : current.modelCodes;

  return {
    name: hasOwn(patch, "name") ? patch.name : current.name,
    brand: hasOwn(patch, "brand") ? patch.brand : current.brand,
    model: hasOwn(patch, "model") ? patch.model : current.model,
    compatibilityModels: hasOwn(patch, "compatibleWith")
      ? patch.compatibleWith
      : current.compatibilityModels,
    modelCodes: hasOwn(patch, "modelCode")
      ? appendModelCode(modelCodes, patch.modelCode)
      : modelCodes,
    // A managed product remains managed for the purpose of this gate even
    // when the patch does not carry the marker itself.
    compatibilityManaged: current.compatibilityManaged,
  };
}

export function toCompatibilityReviewProductInput(product: {
  name?: unknown;
  brand?: unknown;
  model?: unknown;
  modelCode?: unknown;
  compatibleWith?: unknown;
  modelCodes?: unknown;
  compatibilityManaged?: unknown;
}): CompatibilityReviewProductInput {
  return {
    name: product.name,
    brand: product.brand,
    model: product.model,
    compatibilityModels: product.compatibleWith,
    modelCodes: appendModelCode(product.modelCodes, product.modelCode),
    compatibilityManaged: product.compatibilityManaged,
  };
}

/**
 * Delegate all compatibility signal/fingerprint decisions to the shared
 * import core.  If an old build is missing the export, fail closed rather than
 * allowing an unreviewed product write.
 */
export function analyzeProductCompatibilityReview(
  input: CompatibilityReviewProductInput
): ProductCompatibilityReview {
  const analyzer = (
    productImportCore as unknown as {
      analyzeProductCompatibilityReview?: CompatibilityReviewAnalyzer;
    }
  ).analyzeProductCompatibilityReview;

  if (typeof analyzer !== "function") {
    throw new Error("Compatibility review analyzer is unavailable.");
  }

  return serializeCompatibilityReview(analyzer(input));
}

export function isCompatibilityReviewConfirmed(
  review: ProductCompatibilityReview,
  confirmation: CompatibilityReviewConfirmation | null
) {
  return Boolean(
    review.required &&
      confirmation?.confirmed === true &&
      confirmation.fingerprint === review.fingerprint
  );
}

export function serializeCompatibilityReview(value: unknown): ProductCompatibilityReview {
  const review = isRecord(value) ? value : {};
  const signals = Array.isArray(review.signals)
    ? review.signals.map(toSerializableValue)
    : [];

  return {
    required: review.required === true,
    reasonCodes: readStringArray(review.reasonCodes),
    signalCount: readFiniteNumber(review.signalCount, signals.length),
    structuredModelCount: readFiniteNumber(review.structuredModelCount, 0),
    signals,
    fingerprint: typeof review.fingerprint === "string" ? review.fingerprint : "",
  };
}

export function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function appendModelCode(modelCodes: unknown, modelCode: unknown): unknown {
  if (typeof modelCode !== "string" || modelCode.trim().length === 0) {
    return modelCodes;
  }

  if (!Array.isArray(modelCodes)) {
    return [modelCode.trim()];
  }

  if (
    modelCodes.some(
      (value) => typeof value === "string" && value.trim() === modelCode.trim()
    )
  ) {
    return modelCodes;
  }

  return [...modelCodes, modelCode.trim()];
}

function toSerializableValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toSerializableValue);
  }

  if (isRecord(value)) {
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      result[key] = toSerializableValue(entry);
    }

    return result;
  }

  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
