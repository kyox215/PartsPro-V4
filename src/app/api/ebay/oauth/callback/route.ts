import { NextRequest, NextResponse } from "next/server";
import { saveEbayConnectionFromCode } from "@/lib/partspro-marketplace";
import type { EbayEnvironment } from "@/lib/partspro-ebay-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("partspro_ebay_oauth_state")?.value;
  const redirectUrl = new URL("/", request.url);

  if (!code || !state || state !== expectedState) {
    redirectUrl.searchParams.set("ebay", "oauth_failed");
    redirectUrl.searchParams.set("reason", "state");
    return redirectWithClearedState(redirectUrl);
  }

  const environment = readEnvironmentFromState(state);

  try {
    await saveEbayConnectionFromCode({
      code,
      environment,
    });
    redirectUrl.searchParams.set("ebay", "connected");
    redirectUrl.searchParams.set("environment", environment);
    return redirectWithClearedState(redirectUrl);
  } catch (error) {
    redirectUrl.searchParams.set("ebay", "oauth_failed");
    redirectUrl.searchParams.set(
      "reason",
      error instanceof Error ? error.message.slice(0, 120) : "unknown"
    );
    return redirectWithClearedState(redirectUrl);
  }
}

function readEnvironmentFromState(state: string): EbayEnvironment {
  return state.startsWith("production:") ? "production" : "sandbox";
}

function redirectWithClearedState(url: URL) {
  const response = NextResponse.redirect(url);
  response.cookies.delete("partspro_ebay_oauth_state");
  return response;
}
