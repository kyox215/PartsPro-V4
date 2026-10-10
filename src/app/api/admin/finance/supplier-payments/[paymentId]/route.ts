import { NextRequest, NextResponse } from "next/server";
import { financeGross } from "@/lib/admin-finance-input.mjs";
import { apiError, formatZodIssues } from "@/lib/partspro-api";
import { updateAdminSupplierBatchPayment, readAdminFinanceEditableEntry } from "@/lib/partspro-repository";
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
    const original = await readAdminFinanceEditableEntry("supplier_payment", parsedId.data.id);
    if (!original.data) return apiError(404, "FINANCE_ENTRY_NOT_FOUND", "Finance entry could not be found.");
    const { correctionReason, expectedUpdatedAt, ...changes } = body.data;
    const net = changes.amountNet ?? original.data.amountNet;
    const vat = changes.vatAmount ?? original.data.vatAmount;
    const gross = financeGross(net, vat);
    if (changes.amountGross !== undefined && changes.amountGross !== gross) return apiError(400, "INVALID_BODY", "Gross amount must equal net plus VAT.", {
      issues: [{ path: "amountGross", code: "custom", message: "GROSS_MUST_EQUAL_NET_PLUS_VAT" }],
    });
    if (original.data.version !== expectedUpdatedAt) return apiError(409, "FINANCE_ENTRY_CONFLICT", "This entry changed. Reopen it and review the latest values before correcting.");
    const result = await updateAdminSupplierBatchPayment(parsedId.data.id, {
      ...changes,
      ...(changes.amountNet !== undefined || changes.vatAmount !== undefined || changes.amountGross !== undefined ? { amountNet: net, vatAmount: vat, amountGross: gross } : {}),
      metadata: { ...original.data.metadata, ...changes.metadata, correctionReason },
    }, expectedUpdatedAt);

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
