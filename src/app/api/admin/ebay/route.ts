import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  enqueueMarketplaceSync,
  getMarketplaceOverview,
  updateMarketplaceSettings,
  type MarketplaceQueueAction,
} from "@/lib/partspro-marketplace";
import { repositoryErrorResponse, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

const categoryMappingSchema = z.object({
  aspects: z.record(z.string(), z.array(z.string())).optional(),
  brand: z.string().trim().nullable().optional(),
  conditionId: z.string().trim().optional(),
  conditionLabel: z.string().trim().optional(),
  ebayCategoryId: z.string().trim().min(1),
  ebayCategoryName: z.string().trim().nullable().optional(),
  ebayCategoryTreeId: z.string().trim().optional(),
  enabled: z.boolean().optional(),
  localCategory: z.string().trim().min(1),
  modelSeries: z.string().trim().nullable().optional(),
  requiredAspects: z.array(z.unknown()).optional(),
});

const settingsSchema = z.object({
  autoPublishEnabled: z.boolean().optional(),
  autoSyncEnabled: z.boolean().optional(),
  categoryMappings: z.array(categoryMappingSchema).optional(),
  defaultConditionId: z.string().trim().optional(),
  defaultConditionLabel: z.string().trim().optional(),
  enabled: z.boolean().optional(),
  environment: z.enum(["sandbox", "production"]).optional(),
  fulfillmentPolicyId: z.string().trim().nullable().optional(),
  listingDuration: z.string().trim().optional(),
  markupFixed: z.number().min(0).max(999_999).optional(),
  markupPercent: z.number().min(0).max(999).optional(),
  merchantLocationKey: z.string().trim().nullable().optional(),
  offerFormat: z.string().trim().optional(),
  orderImportEnabled: z.boolean().optional(),
  paymentPolicyId: z.string().trim().nullable().optional(),
  productionEnabled: z.boolean().optional(),
  returnPolicyId: z.string().trim().nullable().optional(),
  stockBuffer: z.number().int().min(0).max(999).optional(),
});

const syncSchema = z.object({
  action: z.enum(["plan_listings", "publish_eligible", "sync_inventory", "import_orders"]),
  skus: z.array(z.string().trim().min(1)).max(100).optional(),
});

const actionPermissions: Record<MarketplaceQueueAction, string> = {
  import_orders: "ebay.orders",
  plan_listings: "ebay.publish",
  publish_eligible: "ebay.publish",
  sync_inventory: "ebay.sync_inventory",
} as const;

export async function GET() {
  const admin = await requireAdminApi("panel.marketplace");

  if (!admin.ok) {
    return admin.response;
  }

  try {
    return NextResponse.json({ data: await getMarketplaceOverview() });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_EBAY_OVERVIEW_UNAVAILABLE",
      "eBay marketplace data is temporarily unavailable."
    );
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminApi("ebay.settings");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = settingsSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_EBAY_SETTINGS", "eBay settings payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    return NextResponse.json({ data: await updateMarketplaceSettings(parsed.data) });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_EBAY_SETTINGS_UPDATE_FAILED",
      "eBay settings could not be saved."
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = syncSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_EBAY_ACTION", "eBay action payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const admin = await requireAdminApi(actionPermissions[parsed.data.action]);

  if (!admin.ok) {
    return admin.response;
  }

  try {
    return NextResponse.json({
      data: await enqueueMarketplaceSync(parsed.data),
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_EBAY_ACTION_FAILED",
      "eBay action could not be queued."
    );
  }
}
