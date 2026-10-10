import { NextRequest, NextResponse } from "next/server";
import { catalogNodeSchema } from "@/lib/partspro-catalog-directory";
import { catalogDirectoryRpc } from "@/lib/partspro-catalog-directory-server";
import { parseAdminJsonBody, repositoryErrorResponse, requireAdminApi } from "../_shared";
export const dynamic = "force-dynamic";
export async function GET() {
  const admin = await requireAdminApi("product.read_admin");
  if (!admin.ok) return admin.response;
  try { return NextResponse.json({ data: await catalogDirectoryRpc("admin_catalog_directory") }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return repositoryErrorResponse(error, "CATALOG_DIRECTORY_UNAVAILABLE", "Directory could not be loaded."); }
}
export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("product.edit_content");
  if (!admin.ok) return admin.response;
  const body = await parseAdminJsonBody(request, catalogNodeSchema);
  if (!body.ok) return body.response;
  try { return NextResponse.json({ data: await catalogDirectoryRpc("admin_save_catalog_node", { p_node: body.data }) }); }
  catch (error) { return repositoryErrorResponse(error, "CATALOG_DIRECTORY_SAVE_FAILED", "Directory could not be saved."); }
}
