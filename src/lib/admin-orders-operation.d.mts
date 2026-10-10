export type OrderMutationResult = { ok: false; error: string } | { ok: true; refreshError?: string };
export function runOrderWriteAndRefresh<T>(write: () => Promise<T>, refresh: () => Promise<unknown>, onSaved: (result: T) => void): Promise<OrderMutationResult>;
export function orderQueryParams(filters: Record<string, string | undefined>, page: number, limit?: number): URLSearchParams;
export function combinePackingSlipDocuments(documents: string[]): string;
export function orderDeepLinkFilters(filters: Record<string, string | undefined>, link: { customerId?: string; focusOrderId?: string; focusStatus?: string }): Record<string, string | undefined>;
