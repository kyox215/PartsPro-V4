import { NextResponse } from "next/server";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { apiError } from "@/lib/partspro-api";
import {
  getCurrentCustomerWallet,
  RepositoryWriteError,
} from "@/lib/partspro-repository";
import { repositoryErrorResponse } from "../../admin/_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await getCurrentAccountContext({ ensure: true });

    if (!account.authenticated) {
      return apiError(401, "ACCOUNT_WALLET_AUTH_REQUIRED", "Authentication is required.");
    }

    const wallet = await getCurrentCustomerWallet();

    return NextResponse.json({
      data: wallet.data,
      meta: { source: wallet.source },
    });
  } catch (error) {
    if (error instanceof RepositoryWriteError) {
      return repositoryErrorResponse(
        error,
        "ACCOUNT_WALLET_UNAVAILABLE",
        "Wallet data is temporarily unavailable."
      );
    }

    return apiError(500, "ACCOUNT_WALLET_UNAVAILABLE", "Wallet data is temporarily unavailable.");
  }
}
