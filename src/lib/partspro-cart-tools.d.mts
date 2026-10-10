export function parseCartBatch(text: string): { items: Array<{sku: string; quantity: number}>; errors: string[] };
export function restoreRemovedCartItems<T extends {sku: string; quantity: number}>(current: readonly T[], removed: readonly T[]): Array<T | {sku: string; quantity: number}>;
