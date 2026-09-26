type Query = {
  paymentStatus?: string;
  status?: string;
  view?: "payments" | "shipping";
  stockRisk?: "risk" | "clear" | "low" | "blocked" | "unknown";
  reservation?: "overdue";
};
export function orderListSelect(select: string, query: Query): string;
export function applyOrderListFilters<T>(request: T, query: Query, now?: number): T;
