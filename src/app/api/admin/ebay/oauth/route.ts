import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import {
  getEbayAuthorizationUrl,
  isEbayAppConfigured,
  type EbayEnvironment,
} from "@/lib/partspro-ebay-client";
import { requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("ebay.connect");

  if (!admin.ok) {
    return admin.response;
  }

  const environment = readEnvironment(request.nextUrl.searchParams.get("environment"));

  if (!isEbayAppConfigured(environment)) {
    return apiError(409, "EBAY_OAUTH_NOT_CONFIGURED", "eBay OAuth application is not configured.", {
      environment,
    });
  }

  const state = `${environment}:${randomBytes(24).toString("base64url")}`;
  const response = NextResponse.redirect(
    getEbayAuthorizationUrl({
      environment,
      state,
    })
  );

  response.cookies.set("partspro_ebay_oauth_state", state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}

function readEnvironment(value: string | null): EbayEnvironment {
  return value === "production" ? "production" : "sandbox";
}
