import type { AccountContext } from "@/lib/partspro-account-context";

export type StoreHeaderAccountAccess = {
  authenticated: boolean;
  canOpenAdmin: boolean;
  role: string | null;
  status: "loading" | "ready" | "error";
};

export const anonymousStoreHeaderAccess: StoreHeaderAccountAccess = {
  authenticated: false,
  canOpenAdmin: false,
  role: null,
  status: "ready",
};

const staffRoles = new Set([
  "sales",
  "warehouse",
  "purchasing",
  "admin",
  "catalog_manager",
  "pricing_manager",
  "inventory_manager",
  "sales_support",
  "auditor",
]);

const adminEmails = new Set(
  (process.env.PARTSPRO_ADMIN_EMAILS ?? "kyox120@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export function toStoreHeaderAccountAccess(
  account: AccountContext
): StoreHeaderAccountAccess {
  const normalizedRole = account.role?.trim().toLowerCase() ?? null;
  const adminEmail = Boolean(
    account.email && adminEmails.has(account.email.trim().toLowerCase())
  );
  const staff =
    adminEmail ||
    account.accountType === "employee" ||
    Boolean(normalizedRole && staffRoles.has(normalizedRole)) ||
    account.visiblePanels.length > 0;

  return {
    authenticated: account.authenticated,
    canOpenAdmin: staff,
    role: staff ? account.role ?? (adminEmail ? "admin" : null) : null,
    status: "ready",
  };
}
