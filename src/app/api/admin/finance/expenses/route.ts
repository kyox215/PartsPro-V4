import { NextRequest, NextResponse } from "next/server";
import { createAdminFinanceExpense } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { financeExpenseCreateSchema, parseAdminJsonBody } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("finance.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await parseAdminJsonBody(request, financeExpenseCreateSchema);

  if (!body.ok) {
    return body.response;
  }

  try {
    const result = await createAdminFinanceExpense(body.data);

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
      "ADMIN_FINANCE_EXPENSE_CREATE_FAILED",
      "Finance expense entry could not be created."
    );
  }
}
