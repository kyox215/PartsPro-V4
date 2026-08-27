import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  listCurrentCustomerRmaOrderOptions,
  listCurrentCustomerRmaRequests,
  listCurrentEmployeeSelfRmaOrderOptions,
  listCurrentEmployeeSelfRmaRequests,
} from "@/lib/partspro-repository";
import type { RmaRequest } from "@/lib/partspro-data";
import {
  hydrateCustomerRmaAttachments,
  signRmaRequestAttachments,
} from "@/lib/partspro-rma-evidence";
import { handleRmaSubmit, noStore } from "@/lib/partspro-rma-http";
import { toCustomerRmaDto } from "@/lib/partspro-rma-customer-dto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await getCurrentAccountContext({ ensure: true });

    if (!account.authenticated) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required to read after-sales requests.");
    }

    const [requestsResult, orderOptionsResult] =
      account.accountType === "employee"
        ? await Promise.all([
            listCurrentEmployeeSelfRmaRequests(),
            listCurrentEmployeeSelfRmaOrderOptions(),
          ])
        : await Promise.all([
            listCurrentCustomerRmaRequests(),
            listCurrentCustomerRmaOrderOptions(),
          ]);

    const signedRequests = await signRmaRequestAttachments(
      requestsResult.data,
      account.userId ?? undefined
    );
    // Legacy JSON is signed against the request uploader first. The relation
    // table is then hydrated by authorized request id/company scope; this
    // avoids applying the viewer's path prefix to another active member's
    // evidence.
    const hydratedRequests = account.userId
      ? await hydrateCustomerRmaAttachments(signedRequests, account.userId)
      : signedRequests;
    const customerRequests = toCustomerRmaRequests(hydratedRequests);

    return noStore(NextResponse.json({
      data: customerRequests,
      meta: {
        orderOptions: orderOptionsResult.data,
        source: requestsResult.source,
        total: customerRequests.length,
        flow: "rma_simple_v1",
        policyScope: "legacy_unverified",
        uploadPolicy: "photos_only_v1",
        warnings: [requestsResult.warning, orderOptionsResult.warning].filter(Boolean),
      },
    }));
  } catch {
    return apiError(500, "RMA_UNAVAILABLE", "After-sales request data is temporarily unavailable.");
  }
}

export async function POST(request: NextRequest) {
  return handleRmaSubmit(request);
}

function toCustomerRmaRequests(requests: RmaRequest[]) {
  return requests.map(toCustomerRmaDto);
}
