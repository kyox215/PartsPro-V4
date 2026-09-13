import { NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { isLegacyRmaPayload, rmaCustomerSubmitSchema } from "@/lib/partspro-rma-contract";
import {
  RmaSimpleFlowError,
  submitRmaRequest,
} from "@/lib/partspro-rma-simple-flow";
import {
  deliverPendingRmaNotifications,
  type RmaNotificationPushStatus,
} from "@/lib/partspro-notifications";

export async function handleRmaSubmit(request: Request) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return noStore(apiError(400, "INVALID_JSON", "Request body must be valid JSON."));
  }

  if (isLegacyRmaPayload(body.data)) {
    return noStore(await handleLegacyRmaSubmit());
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
    let notification: RmaNotificationPushStatus = "not_applicable";
    let notificationWarning: string | undefined;

    try {
      const delivery = await deliverPendingRmaNotifications({
        requestId: data.id,
        sourceAction: "customer_submit",
      });
      notification = delivery.pushStatus;
      notificationWarning = pushDeliveryWarning(notification);
    } catch (error) {
      notification = "failed";
      notificationWarning = "RMA submission notification processing failed.";
      console.error("[rma:submit] notification failed", {
        message: error instanceof Error ? error.message : String(error),
        requestId: data.id,
      });
    }

    return noStore(
      NextResponse.json(
        {
          data,
          meta: {
            flow: "rma_simple_v1",
            notification,
            notificationWarning,
            policyScope: data.policyScope,
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

/** Retired JSON writes return a stable upgrade response and never write data. */
async function handleLegacyRmaSubmit() {
  return apiError(
    410,
    "RMA_CLIENT_UPGRADE_REQUIRED",
    "This after-sales client is outdated. Update it to use the secure RMA flow.",
    { flow: "rma_simple_v1" }
  );
}

export function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function pushDeliveryWarning(status: RmaNotificationPushStatus) {
  return status === "failed" || status === "partial"
    ? "The in-app notification was recorded, but browser push delivery was incomplete."
    : undefined;
}
