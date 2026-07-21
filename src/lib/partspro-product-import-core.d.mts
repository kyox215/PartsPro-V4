export function normalizeProductImportHeader(value: unknown): string;
export function normalizeProductImportSku(value: unknown): string;
export function splitProductImportList(value: unknown): string[];
export function shouldSkipProductImportUpdate(
  operation: string,
  changeCount: number,
  issueCount: number
): boolean;
export function parseProductImportDelimited(input: unknown): string[][];
