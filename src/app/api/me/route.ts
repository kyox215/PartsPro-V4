import { NextResponse } from "next/server";
import { getAdminAuthState } from "@/lib/partspro-admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const adminAuth = await getAdminAuthState();
  const role = "role" in adminAuth ? adminAuth.role ?? null : null;

  return NextResponse.json({
    authenticated: adminAuth.configured && adminAuth.reason !== "missing_session",
    admin: {
      allowed: adminAuth.allowed,
      role: adminAuth.allowed ? role : null,
    },
  });
}
