import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { listAdminOrders, listAdminProducts } from "@/lib/partspro-repository";
import { createClient } from "@/lib/supabase/server";
import { parseAdminQuery, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";
const querySchema = z.object({ q: z.string().trim().min(2).max(120) }).strict();
type Result = { id: string; kind: "order" | "product" | "account"; title: string; subtitle: string; href: string };

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const query = parseAdminQuery(request.nextUrl.searchParams, querySchema);
  if (!query.ok) return query.response;
  const q = query.data.q;
  const reads: Promise<Result[]>[] = [];
  if (hasAdminPermission(admin.authState, "orders.read")) reads.push(
    listAdminOrders({ q, limit: 5, offset: 0, sort: "date_desc" }).then(result => result.data.orders.map(order => ({
      id: order.id, kind: "order" as const, title: order.orderNo, subtitle: order.customer.name,
      href: `/admin?panel=orders&orderId=${encodeURIComponent(order.id)}`,
    })))
  );
  if (hasAdminPermission(admin.authState, "product.read_admin")) reads.push(
    listAdminProducts({ q, limit: 5, offset: 0, sort: "updated_desc" }).then(result => result.data.products.map(product => ({
      id: product.sku, kind: "product" as const, title: product.name, subtitle: product.sku,
      href: `/admin?panel=catalog&sku=${encodeURIComponent(product.sku)}`,
    })))
  );
  if (hasAdminPermission(admin.authState, "customers.read") || hasAdminPermission(admin.authState, "employees.read")) {
    reads.push((async () => {
      const client = await createClient();
      const value = q.replace(/[%_,().]/g, " ").trim();
      if (!value) return [];
      let profiles = client.from("profiles").select("id,display_name,email,account_type")
        .or(`display_name.ilike.%${value}%,email.ilike.%${value}%`);
      if (!hasAdminPermission(admin.authState, "employees.read")) profiles = profiles.eq("account_type", "customer");
      if (!hasAdminPermission(admin.authState, "customers.read")) profiles = profiles.eq("account_type", "employee");
      const { data, error } = await profiles.limit(5);
      if (error) throw new Error("Account search unavailable");
      return (data ?? []).map(row => ({
        id: row.id, kind: "account" as const, title: row.display_name || row.email || row.id, subtitle: row.email || "",
        href: `/admin?panel=accounts&accountType=${row.account_type === "employee" ? "employee" : "customer"}&userId=${encodeURIComponent(row.id)}`,
      }));
    })());
  }
  const results = await Promise.allSettled(reads);
  const failed = results.filter(result => result.status === "rejected").length;
  return NextResponse.json({
    data: results.flatMap(result => result.status === "fulfilled" ? result.value : []),
    meta: { partial: failed > 0, unavailableDomains: failed, searchedDomains: reads.length },
  }, { status: reads.length > 0 && failed === reads.length ? 503 : 200 });
}
