import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/partspro-api";
import { noStore } from "@/lib/partspro-rma-http";
import { readRmaDraft, RmaSimpleFlowError } from "@/lib/partspro-rma-simple-flow";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ draftId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { draftId } = await params;
  if (!z.string().uuid().safeParse(draftId).success) {
    return noStore(apiError(400, "INVALID_RMA_DRAFT_ID", "RMA draft id is invalid."));
  }

  try {
    const data = await readRmaDraft(draftId);
    return noStore(NextResponse.json({ data, meta: { flow: "rma_simple_v1" } }));
  } catch (error) {
    if (error instanceof RmaSimpleFlowError) {
      return noStore(apiError(error.status, error.code, error.message, error.details));
    }

    return noStore(apiError(500, "RMA_DRAFT_READ_FAILED", "RMA draft could not be read."));
  }
}
