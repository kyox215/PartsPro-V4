import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";
export const dynamic = "force-dynamic";
const schema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).default(0) }).strict();
export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("panel.orders"); if (!admin.ok) return admin.response;
  const query = parseAdminQuery(request.nextUrl.searchParams, schema); if (!query.ok) return query.response;
  const types: string[] = [];
  if (hasAdminPermission(admin.authState, "orders.read")) types.push("order");
  if (hasAdminPermission(admin.authState, "product.read_admin")) types.push("product", "supplier_batch");
  if (hasAdminPermission(admin.authState, "customers.read")) types.push("customer");
  if (hasAdminPermission(admin.authState, "rma.read")) types.push("rma", "rma_request");
  if (hasAdminPermission(admin.authState, "finance.read")) types.push("finance_expense", "finance_expense_entry", "supplier_batch_payment", "finance_export");
  if (!types.length) return NextResponse.json({ data: [], meta: { total: 0 } });
  try {
    const client = await createClient();
    const { data, error, count } = await client.from("admin_audit_events").select("id,action,entity_type,entity_id,sku_code,actor_role,result,created_at", { count: "exact" }).in("entity_type", types).order("created_at", { ascending: false }).order("id", { ascending: false }).range(query.data.offset, query.data.offset + query.data.limit - 1);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [], meta: { total: count ?? 0, offset: query.data.offset, limit: query.data.limit, source: "admin_audit_events" } });
  } catch (error) { return repositoryErrorResponse(error, "ADMIN_ACTIVITY_UNAVAILABLE", "Activity could not be read."); }
}
