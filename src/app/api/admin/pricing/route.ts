import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { createClient } from "@/lib/supabase/server";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { pricingInspectionSchema, signupCampaignSchema } from "@/lib/partspro-pricing-admin";
import { parseAdminJsonBody, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi("pricing.manage_policy");
  if (!auth.ok) return auth.response;
  const view = request.nextUrl.searchParams.get("view") ?? "campaign";
  if (!["campaign", "anomalies", "audit"].includes(view)) return apiError(400, "INVALID_VIEW", "Unknown pricing view.");
  if (view === "anomalies" && !hasAdminPermission(auth.authState, "customers.read")) return apiError(403, "PRICING_FORBIDDEN", "Missing customer read permission.");
  try {
    const client = await createClient();
    const rpc = view === "campaign" ? "admin_get_signup_pricing_campaign" : view === "audit" ? "admin_get_signup_pricing_campaign_audit" : "admin_get_pricing_anomalies";
    const { data, error } = await client.rpc(rpc);
    if (error) return apiError(503, "PRICING_UNAVAILABLE", "价格管理暂不可用，请检查迁移状态或稍后重试。");
    return NextResponse.json({ data }, { headers });
  } catch { return apiError(503, "PRICING_UNAVAILABLE", "价格管理暂不可用。"); }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("customers.read");
  if (!auth.ok) return auth.response;
  const parsed = await parseAdminJsonBody(request, pricingInspectionSchema);
  if (!parsed.ok) return parsed.response;
  if (!hasAdminPermission(auth.authState, parsed.data.customerType ? "customers.classify" : "orders.manage")) return apiError(403, "PRICING_FORBIDDEN", "Missing classification permission.");
  try {
    const client = await createClient();
    const { customerId, customerType, items } = parsed.data;
    const { data, error } = customerType
      ? await client.rpc("admin_preview_customer_classification", { p_customer_id: customerId, p_customer_type: customerType, p_items: items })
      : await client.rpc("resolve_customer_product_quotes", { p_customer_id: customerId, p_items: items });
    if (error) return apiError(503, "QUOTE_UNAVAILABLE", "无法取得有效报价，未修改客户或商品。");
    return NextResponse.json({ data }, { headers });
  } catch { return apiError(503, "QUOTE_UNAVAILABLE", "无法取得有效报价。"); }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi("pricing.manage_policy");
  if (!auth.ok) return auth.response;
  const parsed = await parseAdminJsonBody(request, signupCampaignSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const input = parsed.data;
    const client = await createClient();
    const { data, error } = await client.rpc("admin_update_signup_pricing_campaign", {
      p_enabled: input.enabled, p_level: input.level, p_duration_months: input.duration_months,
      p_starts_at: input.starts_at, p_ends_at: input.ends_at, p_reason: input.reason,
    });
    if (error) return apiError(503, "CAMPAIGN_UPDATE_FAILED", "活动未能保存，请刷新配置后重试。");
    return NextResponse.json({ data }, { headers });
  } catch { return apiError(503, "CAMPAIGN_UPDATE_FAILED", "活动未能保存。"); }
}
