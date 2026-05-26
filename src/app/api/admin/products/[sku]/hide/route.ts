import { NextRequest } from "next/server";
import { runProductAction } from "../_actions";

export const dynamic = "force-dynamic";

type ProductParams = { params: Promise<{ sku: string }> };

export async function POST(request: NextRequest, context: ProductParams) {
  return runProductAction("hide", request, context);
}
