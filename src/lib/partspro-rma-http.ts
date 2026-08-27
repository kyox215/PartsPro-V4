import { NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  isLegacyRmaPayload,
  rmaCustomerSubmitSchema,
} from "@/lib/partspro-rma-contract";
import {
  RmaSimpleFlowError,
  submitRmaRequest,
} from "@/lib/partspro-rma-simple-flow";

export async function handleRmaSubmit(request: Request) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return noStore(apiError(400, "INVALID_JSON", "Request body must be valid JSON."));
  }

  if (isLegacyRmaPayload(body.data)) {
    return noStore(
      apiError(
        426,
        "RMA_FLOW_UPGRADE_REQUIRED",
        "The secure RMA flow requires a draft and opaque attachment IDs."
      )
    );
  }

  const parsed = rmaCustomerSubmitSchema.safeParse(body.data);
  if (!parsed.success) {
    return noStore(
      apiError(400, "INVALID_RMA_PAYLOAD", "RMA submission payload is invalid.", {
        issues: formatZodIssues(parsed.error),
      })
    );
  }

  try {
    const data = await submitRmaRequest(parsed.data);
    return noStore(
      NextResponse.json(
        {
          data,
          meta: {
            flow: "rma_simple_v1",
            policyScope: "legacy_unverified",
            uploadPolicy: "photos_only_v1",
          },
        },
        { status: 201 }
      )
    );
  } catch (error) {
    if (error instanceof RmaSimpleFlowError) {
      return noStore(apiError(error.status, error.code, error.message, error.details));
    }

    return noStore(apiError(500, "RMA_SUBMIT_FAILED", "RMA request could not be submitted."));
  }
}

export function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
