import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  listCurrentCustomerRmaOrderOptions,
  listCurrentEmployeeSelfRmaOrderOptions,
  RepositoryWriteError,
  saveRmaRequest,
} from "@/lib/partspro-repository";
import type { RmaOrderOption } from "@/lib/partspro-data";
import {
  isLegacyRmaPayload,
  rmaCustomerSubmitSchema,
} from "@/lib/partspro-rma-contract";
import {
  normalizeLegacyRmaAttachments,
  signSingleRmaRequestAttachments,
} from "@/lib/partspro-rma-evidence";
import {
  RmaSimpleFlowError,
  submitRmaRequest,
} from "@/lib/partspro-rma-simple-flow";

const legacyRmaAttachmentSchema = z
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
    // Accepted for rolling compatibility, then deliberately discarded.
    signedUrl: z.string().trim().url().optional(),
    size: z.coerce.number().int().min(1).max(20 * 1024 * 1024).optional(),
    uploadedAt: z.string().trim().max(80).optional(),
  })
  .strict();

const legacyRmaSchema = z
  .object({
    orderId: z.string().trim().min(1).max(80).optional(),
    orderLineId: z.string().uuid(),
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/).optional(),
    quantity: z.coerce.number().int().min(1).max(999),
    reason: z.string().trim().min(5).max(120),
    description: z.string().trim().max(1000).optional().default(""),
    hasPhysicalDamage: z.boolean().optional().default(false),
    installed: z.boolean().optional().default(false),
    requestedResolution: z.enum(["replacement", "refund", "credit_note"]).optional().default("replacement"),
    testedBeforeInstall: z.boolean().optional().default(false),
    attachments: z.array(legacyRmaAttachmentSchema).max(8).optional().default([]),
  })
  .strict();

export async function handleRmaSubmit(request: Request) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return noStore(apiError(400, "INVALID_JSON", "Request body must be valid JSON."));
  }

  if (isLegacyRmaPayload(body.data)) {
    return noStore(await handleLegacyRmaSubmit(body.data));
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

/**
 * Temporary dual-protocol bridge for the current storefront. It keeps the
 * historical JSON/multipart contract alive while refusing client-owned paths,
 * signed URLs, order ownership, and cross-user evidence.
 */
async function handleLegacyRmaSubmit(value: unknown) {
  const parsed = legacyRmaSchema.safeParse(value);
  if (!parsed.success) {
    return apiError(400, "INVALID_RMA_PAYLOAD", "After-sales request payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const account = await getCurrentAccountContext({ ensure: true });
    if (!account.authenticated || !account.userId) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required to create an after-sales request.");
    }

    if (account.accountType !== "customer" && account.accountType !== "employee") {
      return apiError(403, "RMA_ACCOUNT_NOT_ALLOWED", "Only customer accounts can create after-sales requests.");
    }

    const orderOptions =
      account.accountType === "employee"
        ? await listCurrentEmployeeSelfRmaOrderOptions()
        : await listCurrentCustomerRmaOrderOptions();
    const selection = findRmaOrderLineSelection(orderOptions.data, parsed.data.orderLineId);
    if (!selection) {
      return apiError(404, "RMA_ORDER_LINE_NOT_FOUND", "Select a valid order item from your account before creating an after-sales request.");
    }

    if (parsed.data.quantity > selection.line.remainingQuantity) {
      return apiError(409, "RMA_QUANTITY_EXCEEDS_REMAINING", "After-sales request quantity exceeds the remaining quantity available for this order item.", {
        orderedQuantity: selection.line.orderedQuantity,
        alreadyRequestedQuantity: selection.line.alreadyRequestedQuantity,
        remainingQuantity: selection.line.remainingQuantity,
      });
    }

    const attachments = normalizeLegacyRmaAttachments(parsed.data.attachments, account.userId);
    if (!attachments) {
      return apiError(403, "RMA_EVIDENCE_NOT_OWNED", "RMA evidence must be uploaded by this account and belong to its private path.");
    }

    const saved = await saveRmaRequest({
      description: parsed.data.description,
      hasPhysicalDamage: parsed.data.hasPhysicalDamage,
      installed: parsed.data.installed,
      orderId: selection.order.number,
      orderLineId: selection.line.id,
      productName: selection.line.productName,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      requestedResolution: parsed.data.requestedResolution,
      sku: selection.line.sku,
      testedBeforeInstall: parsed.data.testedBeforeInstall,
      attachments,
    });
    const signedRequest = await signSingleRmaRequestAttachments(saved.data, account.userId);

    return NextResponse.json(
      {
        data: signedRequest,
        meta: {
          source: saved.source,
          order: { id: selection.order.id, number: selection.order.number },
          uploadPolicy: "legacy_photos_or_video_before_return",
          compatibility: "legacy_dual_protocol",
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

function findRmaOrderLineSelection(orderOptions: RmaOrderOption[], orderLineId: string) {
  for (const order of orderOptions) {
    const line = order.lines.find((item) => item.id === orderLineId);
    if (line) return { line, order };
  }
  return null;
}

export function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
