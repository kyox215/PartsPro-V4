import type { AccountContext } from "@/lib/partspro-account-context";

export type StoreHeaderAccountAccess = {
  accountType: AccountContext["accountType"];
  authenticated: boolean;
  canOpenAdmin: boolean;
  displayName: string | null;
  email: string | null;
  role: string | null;
  status: "loading" | "ready" | "error";
};

export const anonymousStoreHeaderAccess: StoreHeaderAccountAccess = {
  accountType: null,
  authenticated: false,
  canOpenAdmin: false,
  displayName: null,
  email: null,
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
  const staffRole = normalizedRole && staffRoles.has(normalizedRole) ? normalizedRole : null;
  const adminEmail = Boolean(
    account.email && adminEmails.has(account.email.trim().toLowerCase())
  );
  const staff =
    adminEmail ||
    account.accountType === "employee" ||
    Boolean(normalizedRole && staffRoles.has(normalizedRole)) ||
    account.visiblePanels.length > 0;

  return {
    accountType: account.accountType,
    authenticated: account.authenticated,
    canOpenAdmin: staff,
    displayName:
      account.customer?.name ??
      account.employeeSelfCustomer?.name ??
      account.email ??
      null,
    email: account.email,
    role: staff ? (adminEmail ? "admin" : staffRole) : null,
    status: "ready",
  };
}
