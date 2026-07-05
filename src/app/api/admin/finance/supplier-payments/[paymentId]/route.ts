import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues } from "@/lib/partspro-api";
import { updateAdminSupplierBatchPayment } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import {
  idParamSchema,
  parseAdminJsonBody,
  supplierPaymentPatchSchema,
} from "../../_shared";

export const dynamic = "force-dynamic";

type PaymentParams = { params: Promise<{ paymentId: string }> };

export async function PATCH(request: NextRequest, { params }: PaymentParams) {
  const admin = await requireAdminApi("finance.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await parseAdminJsonBody(request, supplierPaymentPatchSchema);

  if (!body.ok) {
    return body.response;
  }

  const { paymentId } = await params;
  const parsedId = idParamSchema.safeParse({ id: paymentId });

  if (!parsedId.success) {
    return apiError(400, "INVALID_SUPPLIER_PAYMENT_ID", "Supplier payment id is invalid.", {
      issues: formatZodIssues(parsedId.error),
    });
  }

  try {
    const result = await updateAdminSupplierBatchPayment(parsedId.data.id, body.data);

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIER_PAYMENT_UPDATE_FAILED",
      "Supplier payment could not be updated."
    );
  }
}
