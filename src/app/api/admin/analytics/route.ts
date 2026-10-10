import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readWebsiteAnalytics,
  WebsiteAnalyticsConfigError,
} from "@/lib/partspro-vercel-analytics";
import { apiError } from "@/lib/partspro-api";
import { parseAdminQuery, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

const analyticsQuerySchema = z
  .object({
    range: z.enum(["7", "30"]).default("7"),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("analytics.read");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, analyticsQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const data = await readWebsiteAnalytics(Number(query.data.range) as 7 | 30);

    return NextResponse.json({
      data,
      meta: {
        cacheSeconds: 300,
        source: "vercel_web_analytics",
      },
    });
  } catch (error) {
    if (error instanceof WebsiteAnalyticsConfigError) {
      return apiError(
        503,
        "ANALYTICS_NOT_CONFIGURED",
        "Website analytics is not configured for this environment.",
        { missing: error.missing }
      );
    }

    return apiError(
      502,
      "ANALYTICS_UPSTREAM_UNAVAILABLE",
      "Website analytics data is temporarily unavailable."
    );
  }
}
