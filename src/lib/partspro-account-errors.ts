export class AccountRequestError extends Error {
  constructor(readonly code: string | null, readonly status: number, readonly issues?: unknown) {
    super(code ?? String(status));
  }
}

export function accountRequestErrorKey(error: unknown, context: "profile" | "orders") {
  if (error instanceof AccountRequestError) {
    if (error.status === 401 || error.code === "ACCOUNT_PROFILE_AUTH_REQUIRED") {
      return context === "profile" ? "storefront.account.profile.authRequired" : "storefront.account.orders.authRequired";
    }
    if (error.status === 403) {
      return context === "profile" ? "storefront.account.profile.forbidden" : "storefront.account.orders.forbidden";
    }
    if (context === "profile" && error.code === "INVALID_ACCOUNT_PROFILE") {
      return "storefront.account.profile.invalid";
    }
    if (context === "orders" && error.status === 404) {
      return "storefront.account.orders.notFound";
    }
  }
  return context === "profile" ? "storefront.account.profile.saveError" : "storefront.account.orders.unavailable";
}
