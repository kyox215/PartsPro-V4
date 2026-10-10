import { NextResponse } from "next/server";
import { readMarketplacePolicyOptions } from "@/lib/partspro-marketplace";
import { requireAdminApi, repositoryErrorResponse } from "../../_shared";
export const dynamic = "force-dynamic";
export async function GET() {
  const admin = await requireAdminApi("ebay.settings"); if (!admin.ok) return admin.response;
  try { return NextResponse.json({ data: await readMarketplacePolicyOptions() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return repositoryErrorResponse(error, "EBAY_POLICIES_UNAVAILABLE", "Policies could not be read. Check the saved environment and connection."); }
}
