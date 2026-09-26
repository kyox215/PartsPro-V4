import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { apiError } from "@/lib/partspro-api";
import {
  readAdminCustomerSettlementPreview,
  settleAdminCustomerOrders,
} from "@/lib/partspro-customer-settlement";
import {
  parseAdminJsonBody,
  repositoryErrorResponse,
  requireAdminApi,
} from "../../../_shared";

export const dynamic = "force-dynamic";

type CustomerSettlementParams = {
  params: Promise<{ customerId: string }>;
};

const customerIdSchema = z.string().trim().uuid();
const customerSettlementSchema = z
  .object({
    expectedRevision: z.string().trim().regex(/^[0-9a-f]{32}$/),
    paymentMethod: z.enum(["bank_transfer", "cash"]),
    receivedAt: z.string().trim().datetime({ offset: true }).optional(),
    reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  { params }: CustomerSettlementParams
) {
  const admin = await requireSettlementPermissions();

  if (!admin.ok) {
    return admin.response;
  }

  const customerId = await readCustomerId(params);

  if (!customerId.ok) {
    return customerId.response;
  }

  try {
    const data = await readAdminCustomerSettlementPreview(customerId.value);

    return NextResponse.json({
      data,
      meta: { source: "supabase_rpc" },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_CUSTOMER_SETTLEMENT_PREVIEW_UNAVAILABLE",
      "Customer settlement preview is temporarily unavailable."
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: CustomerSettlementParams
) {
  const admin = await requireSettlementPermissions();

  if (!admin.ok) {
    return admin.response;
  }

  const customerId = await readCustomerId(params);

  if (!customerId.ok) {
    return customerId.response;
  }

  const body = await parseAdminJsonBody(request, customerSettlementSchema);

  if (!body.ok) {
    return body.response;
  }

  try {
    const data = await settleAdminCustomerOrders({
      customerId: customerId.value,
      expectedRevision: body.data.expectedRevision,
      note: body.data.note,
      paymentMethod: body.data.paymentMethod,
      receivedAt: body.data.receivedAt,
      reference: body.data.reference,
    });

    return NextResponse.json({
      data,
      meta: {
        source: "supabase_rpc",
        paymentLifecycle: "atomic_customer_bulk_settlement",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_CUSTOMER_SETTLEMENT_FAILED",
      "Customer orders could not be settled at this time."
    );
  }
}

async function requireSettlementPermissions() {
  const admin = await requireAdminApi("customers.read");

  if (!admin.ok) {
    return admin;
  }

  if (!hasAdminPermission(admin.authState, "orders.manage")) {
    return {
      ok: false as const,
      response: apiError(
        403,
        "ADMIN_PERMISSION_DENIED",
        "Customer settlement requires orders.manage permission.",
        { permission: "orders.manage" }
      ),
    };
  }

  return admin;
}

async function readCustomerId(
  params: CustomerSettlementParams["params"]
): Promise<
  | { ok: true; value: string }
  | { ok: false; response: ReturnType<typeof apiError> }
> {
  const value = (await params).customerId;
  const parsed = customerIdSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(
        400,
        "INVALID_CUSTOMER_ID",
        "Customer id must be a valid UUID."
      ),
    };
  }

  return { ok: true, value: parsed.data };
}
