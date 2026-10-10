import { NextResponse } from "next/server";
import { z } from "zod";
import { readCheckoutSubmission } from "@/lib/partspro-checkout-submission";
import { apiError } from "@/lib/partspro-api";
import { RepositoryWriteError } from "@/lib/partspro-repository";

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  if (!z.string().uuid().safeParse(requestId).success) return apiError(400, "INVALID_SUBMISSION_ID", "Invalid submission reference.");
  try {
    return NextResponse.json(await readCheckoutSubmission(requestId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RepositoryWriteError) return apiError(error.status, error.code, error.message);
    return apiError(503, "ORDER_RESULT_UNKNOWN", "Order result needs verification.");
  }
}
