import { NextResponse } from "next/server";
import { rmaDraftCreateSchema } from "@/lib/partspro-rma-contract";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { createRmaDraft, RmaSimpleFlowError } from "@/lib/partspro-rma-simple-flow";
import { noStore } from "@/lib/partspro-rma-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) {
    return noStore(apiError(400, "INVALID_JSON", "Request body must be valid JSON."));
  }

  const parsed = rmaDraftCreateSchema.safeParse(body.data);
  if (!parsed.success) {
    return noStore(
      apiError(400, "INVALID_RMA_DRAFT_PAYLOAD", "RMA draft payload is invalid.", {
        issues: formatZodIssues(parsed.error),
      })
    );
  }

  try {
    const data = await createRmaDraft(parsed.data);
    return noStore(NextResponse.json({ data, meta: { flow: "rma_simple_v1" } }, { status: 201 }));
  } catch (error) {
    if (error instanceof RmaSimpleFlowError) {
      return noStore(apiError(error.status, error.code, error.message, error.details));
    }

    return noStore(apiError(500, "RMA_DRAFT_CREATE_FAILED", "RMA draft could not be created."));
  }
}
