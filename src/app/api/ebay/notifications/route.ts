import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEbayNotificationEndpoint } from "@/lib/partspro-marketplace";
import {
  createServiceRoleClient,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const challengeCode = request.nextUrl.searchParams.get("challenge_code");
  const verificationToken = process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN;

  if (!challengeCode || !verificationToken) {
    return NextResponse.json(
      { error: { code: "EBAY_NOTIFICATION_VALIDATION_MISSING" } },
      { status: 400 }
    );
  }

  return NextResponse.json({
    challengeResponse: createHash("sha256")
      .update(challengeCode)
      .update(verificationToken)
      .update(getEbayNotificationEndpoint())
      .digest("hex"),
  });
}

export async function POST(request: NextRequest) {
  let payload: unknown = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  if (isSupabaseServiceRoleConfigured()) {
    const client = createServiceRoleClient();
    const orderId = readNotificationOrderId(payload);

    await client.from("marketplace_sync_jobs").upsert(
      {
        idempotency_key: orderId
          ? `notification-order:${orderId}`
          : `notification-import:${new Date().toISOString().slice(0, 16)}`,
        job_type: "import_orders",
        marketplace_id: "EBAY_IT",
        payload: orderId ? { notification: payload, orderId } : { notification: payload },
        provider: "ebay",
        status: "queued",
        target_order_id: orderId,
      },
      { onConflict: "provider,marketplace_id,idempotency_key" }
    );
  }

  return NextResponse.json({ received: true }, { status: 202 });
}

function readNotificationOrderId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const data = record.data;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dataRecord = data as Record<string, unknown>;
    const orderId = dataRecord.orderId ?? dataRecord.order_id;

    if (typeof orderId === "string" && orderId.trim()) {
      return orderId.trim();
    }
  }

  const orderId = record.orderId ?? record.order_id;
  return typeof orderId === "string" && orderId.trim() ? orderId.trim() : null;
}
