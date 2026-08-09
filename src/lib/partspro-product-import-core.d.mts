export function normalizeProductImportHeader(value: unknown): string;
export function normalizeProductImportSku(value: unknown): string;
export function splitProductImportList(value: unknown): string[];
export function shouldSkipProductImportUpdate(
  operation: string,
  changeCount: number,
  issueCount: number
): boolean;
export function parseProductImportDelimited(input: unknown): string[][];
export function analyzeProductCompatibilityReview(input?: {
  name?: unknown;
  brand?: unknown;
  model?: unknown;
  compatibilityModels?: unknown;
  modelCodes?: unknown;
  compatibilityManaged?: unknown;
  [key: string]: unknown;
}): {
  required: boolean;
  reasonCodes: string[];
  signalCount: number;
  structuredModelCount: number;
  signals: string[];
  fingerprint: string;
};
