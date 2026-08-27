import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";

export const dynamic = "force-dynamic";

/**
 * Compatibility boundary for the pre-draft multipart endpoint. The secure
 * flow uses /api/rma/drafts/:draftId/uploads and returns only an opaque
 * attachment id plus a short-lived direct upload URL.
 */
export async function POST() {
  const response = apiError(
    426,
    "RMA_FLOW_UPGRADE_REQUIRED",
    "Use the draft upload flow with an opaque attachment id."
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function OPTIONS() {
  return NextResponse.json(
    { data: null, meta: { flow: "rma_simple_v1", legacy: "disabled" } },
    {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    }
  );
}
