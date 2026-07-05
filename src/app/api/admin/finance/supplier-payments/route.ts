import { NextRequest, NextResponse } from "next/server";
import { createAdminSupplierBatchPayment } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { parseAdminJsonBody, supplierPaymentCreateSchema } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("finance.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await parseAdminJsonBody(request, supplierPaymentCreateSchema);

  if (!body.ok) {
    return body.response;
  }

  try {
    const result = await createAdminSupplierBatchPayment(body.data);

    return NextResponse.json(
      {
        data: result.data,
        meta: {
          source: result.source,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIER_PAYMENT_CREATE_FAILED",
      "Supplier payment could not be created."
    );
  }
}
