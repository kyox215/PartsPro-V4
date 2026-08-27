import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { rmaUploadTicketSchema } from "@/lib/partspro-rma-contract";
import { noStore } from "@/lib/partspro-rma-http";
import {
  issueRmaUploadTicket,
  RmaSimpleFlowError,
} from "@/lib/partspro-rma-simple-flow";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { draftId } = await params;
  if (!z.string().uuid().safeParse(draftId).success) {
    return noStore(apiError(400, "INVALID_RMA_DRAFT_ID", "RMA draft id is invalid."));
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return noStore(apiError(400, "INVALID_JSON", "Request body must be valid JSON."));
  }

  const parsed = rmaUploadTicketSchema.safeParse(body.data);
  if (!parsed.success) {
    return noStore(
      apiError(400, "INVALID_RMA_UPLOAD_PAYLOAD", "RMA upload payload is invalid.", {
        issues: formatZodIssues(parsed.error),
      })
    );
  }

  try {
    const data = await issueRmaUploadTicket(draftId, parsed.data);
    return noStore(
      NextResponse.json(
        { data, meta: { flow: "rma_simple_v1", storage: "signed_direct_upload" } },
        { status: 201 }
      )
    );
  } catch (error) {
    if (error instanceof RmaSimpleFlowError) {
      return noStore(apiError(error.status, error.code, error.message, error.details));
    }

    return noStore(apiError(500, "RMA_UPLOAD_TICKET_FAILED", "RMA upload ticket could not be created."));
  }
}
