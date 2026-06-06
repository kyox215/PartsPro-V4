import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  createAdminWalletRefundRequest,
  listAdminWalletRefundRequests,
  type AdminWalletRefundStatus,
} from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

const walletRefundStatuses = [
  "requested",
  "approved",
  "rejected",
  "credited",
  "cancelled",
] as const;

const walletRefundQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderId: z.string().trim().min(1).max(120).optional(),
  status: z.enum(walletRefundStatuses).optional(),
});

const walletRefundCreateSchema = z.object({
  amount: z.coerce.number().positive(),
  customerId: z.string().trim().min(1).max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  orderId: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(1000),
});

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  if (
    !hasAdminPermission(admin.authState, "wallet_refunds.request") &&
    !hasAdminPermission(admin.authState, "wallet_refunds.approve")
  ) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission: "wallet_refunds.request or wallet_refunds.approve",
      role: admin.authState.role,
    });
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, walletRefundQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminWalletRefundRequests({
      ...query.data,
      status: query.data.status as AdminWalletRefundStatus | undefined,
    });

    return NextResponse.json({
      data: result.data.refunds,
      meta: {
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.refunds.length,
        source: result.source,
        total: result.data.total,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_WALLET_REFUNDS_UNAVAILABLE",
      "Wallet refund requests are temporarily unavailable."
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("wallet_refunds.request");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = walletRefundCreateSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_WALLET_REFUND_PAYLOAD", "Wallet refund payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await createAdminWalletRefundRequest({
      amount: parsed.data.amount,
      customerId: parsed.data.customerId,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        source: "admin_wallet_refunds_api",
      },
      orderId: parsed.data.orderId,
      reason: parsed.data.reason,
    });

    return NextResponse.json(
      {
        data: result.data,
        meta: { source: result.source },
      },
      { status: 201 }
    );
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_WALLET_REFUND_CREATE_FAILED",
      "Wallet refund request could not be created."
    );
  }
}
