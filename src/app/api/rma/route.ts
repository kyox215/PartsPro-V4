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
import type { RmaOrderOption, RmaRequest } from "@/lib/partspro-data";
import {
  signRmaRequestAttachments,
  signSingleRmaRequestAttachments,
} from "@/lib/partspro-rma-evidence";

const rmaAttachmentSchema = z
  .object({
    bucket: z.string().trim().min(1).max(80).optional().default("rma-evidence"),
    contentType: z
      .enum([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
        "video/mp4",
        "video/quicktime",
      ])
      .optional(),
    name: z.string().trim().min(1).max(180),
    path: z.string().trim().min(1).max(500),
    signedUrl: z.string().trim().url().optional(),
    size: z.coerce.number().int().min(1).max(20 * 1024 * 1024).optional(),
    uploadedAt: z.string().trim().max(80).optional(),
  })
  .strict();

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
    attachments: z.array(rmaAttachmentSchema).max(8).optional().default([]),
  })
  .strict();

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
      toCustomerRmaRequests(requestsResult.data)
    );

    return NextResponse.json({
      data: signedRequests,
      meta: {
        orderOptions: orderOptionsResult.data,
        source: requestsResult.source,
        total: signedRequests.length,
        uploadPolicy: "photos_or_video_before_return",
        warnings: [requestsResult.warning, orderOptionsResult.warning].filter(Boolean),
      },
    });
  } catch {
    return apiError(500, "RMA_UNAVAILABLE", "After-sales request data is temporarily unavailable.");
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = createRmaSchema.safeParse(body.data);

  if (!result.success) {
    return apiError(400, "INVALID_RMA_PAYLOAD", "After-sales request payload is invalid.", {
      issues: formatZodIssues(result.error),
    });
  }

  try {
    const account = await getCurrentAccountContext({ ensure: true });

    if (!account.authenticated) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required to create an after-sales request.");
    }

    if (account.accountType !== "customer" && account.accountType !== "employee") {
      return apiError(403, "RMA_ACCOUNT_NOT_ALLOWED", "Only customer accounts can create after-sales requests.");
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
        "Select a valid order item from your account before creating an after-sales request."
      );
    }

    if (result.data.quantity > selection.line.remainingQuantity) {
      return apiError(
        409,
        "RMA_QUANTITY_EXCEEDS_REMAINING",
        "After-sales request quantity exceeds the remaining quantity available for this order item.",
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
      attachments: result.data.attachments,
    });
    const signedRequest = await signSingleRmaRequestAttachments(
      toCustomerRmaRequest(saved.data)
    );

    return NextResponse.json(
      {
        data: signedRequest,
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

    return apiError(500, "RMA_CREATE_FAILED", "After-sales request could not be created at this time.");
  }
}

function toCustomerRmaRequests(requests: RmaRequest[]) {
  return requests.map(toCustomerRmaRequest);
}

function toCustomerRmaRequest(request: RmaRequest): RmaRequest {
  return {
    ...request,
    internalNote: undefined,
  };
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
