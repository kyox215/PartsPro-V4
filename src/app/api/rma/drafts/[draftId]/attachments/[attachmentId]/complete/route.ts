import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { rmaCompleteAttachmentSchema } from "@/lib/partspro-rma-contract";
import { noStore } from "@/lib/partspro-rma-http";
import {
  cancelRmaAttachment,
  completeRmaAttachment,
  RmaSimpleFlowError,
} from "@/lib/partspro-rma-simple-flow";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ draftId: string; attachmentId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { draftId, attachmentId } = await params;
  if (!z.string().uuid().safeParse(draftId).success || !z.string().uuid().safeParse(attachmentId).success) {
    return noStore(apiError(400, "INVALID_RMA_ATTACHMENT_ID", "RMA attachment id is invalid."));
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return noStore(apiError(400, "INVALID_JSON", "Request body must be valid JSON."));
  }

  const parsed = rmaCompleteAttachmentSchema.safeParse(body.data);
  if (!parsed.success) {
    return noStore(
      apiError(400, "INVALID_RMA_ATTACHMENT_PAYLOAD", "RMA attachment verification payload is invalid.", {
        issues: formatZodIssues(parsed.error),
      })
    );
  }

  try {
    const data = await completeRmaAttachment(attachmentId, parsed.data, draftId);
    return noStore(
      NextResponse.json({ data, meta: { flow: "rma_simple_v1", draftId } })
    );
  } catch (error) {
    if (error instanceof RmaSimpleFlowError) {
      if (error.status === 422) {
        try {
          await cancelRmaAttachment(draftId, attachmentId);
        } catch {
          // The verification error remains the user-facing result; the
          // cancellation RPC is independently idempotent and GC covers any
          // storage-delete failure.
        }
      }
      return noStore(apiError(error.status, error.code, error.message, error.details));
    }

    return noStore(apiError(500, "RMA_ATTACHMENT_VERIFY_FAILED", "RMA attachment could not be verified."));
  }
}

/** Cancel a failed/abandoned upload and release its six-image quota. */
export async function DELETE(_request: Request, { params }: Params) {
  const { draftId, attachmentId } = await params;
  if (!z.string().uuid().safeParse(draftId).success || !z.string().uuid().safeParse(attachmentId).success) {
    return noStore(apiError(400, "INVALID_RMA_ATTACHMENT_ID", "RMA attachment id is invalid."));
  }

  try {
    const data = await cancelRmaAttachment(draftId, attachmentId);
    return noStore(NextResponse.json({ data, meta: { flow: "rma_simple_v1", draftId } }));
  } catch (error) {
    if (error instanceof RmaSimpleFlowError) {
      return noStore(apiError(error.status, error.code, error.message, error.details));
    }

    return noStore(apiError(500, "RMA_ATTACHMENT_CANCEL_FAILED", "RMA attachment could not be cancelled."));
  }
}
