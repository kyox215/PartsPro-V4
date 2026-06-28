import { NextResponse } from "next/server";
import { getNotificationClientConfig } from "@/lib/partspro-notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    data: getNotificationClientConfig(),
    meta: {
      source: "partspro_notifications",
    },
  });
}
