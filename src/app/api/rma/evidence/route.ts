import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";

export const dynamic = "force-dynamic";

// The secure draft flow owns uploads now; this compatibility endpoint never
// writes an RMA row or object and gives old clients one stable upgrade code.
export async function POST(_request: NextRequest) {
  void _request;
  return noStore(
    apiError(
      410,
      "RMA_CLIENT_UPGRADE_REQUIRED",
      "This after-sales client is outdated. Update it to use the secure RMA flow.",
      { flow: "rma_simple_v1" }
    )
  );
}

export async function OPTIONS() {
  return noStore(
    apiError(
      410,
      "RMA_CLIENT_UPGRADE_REQUIRED",
      "This after-sales client is outdated. Update it to use the secure RMA flow.",
      { flow: "rma_simple_v1" }
    )
  );
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
