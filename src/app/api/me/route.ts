import { NextResponse } from "next/server";
import { getAdminAuthStateFromAccount } from "@/lib/partspro-admin-auth";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { visiblePanelsForPermissions } from "@/lib/partspro-permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getCurrentAccountContext({ ensure: true });
  const adminAuth = getAdminAuthStateFromAccount(account);
  const role = "role" in adminAuth ? adminAuth.role ?? null : null;
  const permissions = adminAuth.allowed ? adminAuth.permissions : account.permissions;
  const visiblePanels = adminAuth.allowed
    ? visiblePanelsForPermissions(permissions)
    : account.visiblePanels;

  return NextResponse.json({
    authenticated: account.authenticated,
    accountType: account.accountType,
    customer: account.customer,
    userId: account.userId,
    roleTemplate: account.roleTemplate,
    permissions,
    visiblePanels,
    canUseCart: account.canUseCart,
    canViewPrices: account.canViewPrices,
    canCheckout: account.canCheckout,
    admin: {
      allowed: adminAuth.allowed,
      role: adminAuth.allowed ? role : null,
      reason: adminAuth.reason,
    },
  });
}
