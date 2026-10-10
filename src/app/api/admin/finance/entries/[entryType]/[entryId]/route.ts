import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues } from "@/lib/partspro-api";
import { readAdminFinanceEditableEntry } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../../_shared";

export const dynamic = "force-dynamic";
const paramsSchema = z.object({ entryType: z.enum(["expense", "supplier_payment"]), entryId: z.string().uuid() });
export async function GET(_request: NextRequest, { params }: { params: Promise<{ entryType: string; entryId: string }> }) {
  const admin = await requireAdminApi("finance.read");
  if (!admin.ok) return admin.response;
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return apiError(400, "INVALID_FINANCE_ENTRY", "Finance entry reference is invalid.", { issues: formatZodIssues(parsed.error) });
  try {
    const result = await readAdminFinanceEditableEntry(parsed.data.entryType, parsed.data.entryId);
    if (!result.data) return apiError(404, "FINANCE_ENTRY_NOT_FOUND", "Finance entry could not be found.");
    const entry = result.data;
    const common = { id: entry.id, amountNet: entry.amountNet, vatAmount: entry.vatAmount, amountGross: entry.amountGross,
      currency: entry.currency, status: entry.status, paidAt: entry.paidAt, version: entry.version };
    const detail = "description" in entry ? { category: entry.category, description: entry.description, occurredAt: entry.occurredAt, notes: entry.notes }
      : { batchId: entry.batchId, batchCode: entry.batchCode, supplierName: entry.supplierName, dueAt: entry.dueAt, note: entry.note };
    return NextResponse.json({ data: { ...common, ...detail } });
  } catch (error) {
    return repositoryErrorResponse(error, "ADMIN_FINANCE_ENTRY_UNAVAILABLE", "Finance entry could not be read.");
  }
}
