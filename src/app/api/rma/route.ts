import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  listCurrentCustomerRmaOrderOptions,
  listCurrentCustomerRmaRequests,
  listCurrentEmployeeSelfRmaOrderOptions,
  listCurrentEmployeeSelfRmaRequests,
  RepositoryWriteError,
  saveRmaRequest,
} from "@/lib/partspro-repository";
import type { RmaOrderOption } from "@/lib/partspro-data";

const createRmaSchema = z
  .object({
    orderId: z.string().trim().min(1).max(80).optional(),
    orderLineId: z.string().trim().min(1).max(80),
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/).optional(),
    quantity: z.coerce.number().int().min(1).max(999),
    reason: z.string().trim().min(5).max(120),
    description: z.string().trim().max(1000).optional().default(""),
    hasPhysicalDamage: z.boolean().optional().default(false),
    installed: z.boolean().optional().default(false),
    requestedResolution: z.enum(["replacement", "refund", "credit_note"]).optional().default("replacement"),
    testedBeforeInstall: z.boolean().optional().default(false),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await getCurrentAccountContext({ ensure: true });

    if (!account.authenticated) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required to read RMA requests.");
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

    return NextResponse.json({
      data: requestsResult.data,
      meta: {
        orderOptions: orderOptionsResult.data,
        source: requestsResult.source,
        total: requestsResult.data.length,
        uploadPolicy: "photos_or_video_before_return",
        warnings: [requestsResult.warning, orderOptionsResult.warning].filter(Boolean),
      },
    });
  } catch {
    return apiError(500, "RMA_UNAVAILABLE", "RMA data is temporarily unavailable.");
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = createRmaSchema.safeParse(body.data);

  if (!result.success) {
    return apiError(400, "INVALID_RMA_PAYLOAD", "RMA payload is invalid.", {
      issues: formatZodIssues(result.error),
    });
  }

  try {
    const account = await getCurrentAccountContext({ ensure: true });

    if (!account.authenticated) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required to create an RMA request.");
    }

    if (account.accountType !== "customer" && account.accountType !== "employee") {
      return apiError(403, "RMA_ACCOUNT_NOT_ALLOWED", "Only customer accounts can create RMA requests.");
    }

    const orderOptions =
      account.accountType === "employee"
        ? await listCurrentEmployeeSelfRmaOrderOptions()
        : await listCurrentCustomerRmaOrderOptions();
    const selection = findRmaOrderLineSelection(orderOptions.data, result.data.orderLineId);

    if (!selection) {
      return apiError(
        404,
        "RMA_ORDER_LINE_NOT_FOUND",
        "Select a valid order item from your account before creating an RMA request."
      );
    }

    if (result.data.quantity > selection.line.remainingQuantity) {
      return apiError(
        409,
        "RMA_QUANTITY_EXCEEDS_REMAINING",
        "RMA quantity exceeds the remaining quantity available for this order item.",
        {
          orderedQuantity: selection.line.orderedQuantity,
          alreadyRequestedQuantity: selection.line.alreadyRequestedQuantity,
          remainingQuantity: selection.line.remainingQuantity,
        }
      );
    }

    const saved = await saveRmaRequest({
      description: result.data.description,
      hasPhysicalDamage: result.data.hasPhysicalDamage,
      installed: result.data.installed,
      orderId: selection.order.number,
      orderLineId: selection.line.id,
      productName: selection.line.productName,
      quantity: result.data.quantity,
      reason: result.data.reason,
      requestedResolution: result.data.requestedResolution,
      sku: selection.line.sku,
      testedBeforeInstall: result.data.testedBeforeInstall,
    });

    return NextResponse.json(
      {
        data: saved.data,
        meta: {
          source: saved.source,
          order: {
            id: selection.order.id,
            number: selection.order.number,
          },
          uploadPolicy: "photos_or_video_before_return",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RepositoryWriteError) {
      return apiError(error.status, error.code, error.message);
    }

    return apiError(500, "RMA_CREATE_FAILED", "RMA request could not be created at this time.");
  }
}

function findRmaOrderLineSelection(orderOptions: RmaOrderOption[], orderLineId: string) {
  for (const order of orderOptions) {
    const line = order.lines.find((item) => item.id === orderLineId);

    if (line) {
      return { line, order };
    }
  }

  return null;
}
