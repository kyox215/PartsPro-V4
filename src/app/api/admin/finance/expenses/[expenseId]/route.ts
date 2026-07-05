import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues } from "@/lib/partspro-api";
import { updateAdminFinanceExpense } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import {
  financeExpensePatchSchema,
  idParamSchema,
  parseAdminJsonBody,
} from "../../_shared";

export const dynamic = "force-dynamic";

type ExpenseParams = { params: Promise<{ expenseId: string }> };

export async function PATCH(request: NextRequest, { params }: ExpenseParams) {
  const admin = await requireAdminApi("finance.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await parseAdminJsonBody(request, financeExpensePatchSchema);

  if (!body.ok) {
    return body.response;
  }

  const { expenseId } = await params;
  const parsedId = idParamSchema.safeParse({ id: expenseId });

  if (!parsedId.success) {
    return apiError(400, "INVALID_EXPENSE_ID", "Finance expense id is invalid.", {
      issues: formatZodIssues(parsedId.error),
    });
  }

  try {
    const result = await updateAdminFinanceExpense(parsedId.data.id, body.data);

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_FINANCE_EXPENSE_UPDATE_FAILED",
      "Finance expense entry could not be updated."
    );
  }
}
