import { NextResponse } from "next/server";
import { catalogDirectoryRpc } from "@/lib/partspro-catalog-directory-server";
import { repositoryErrorResponse } from "../admin/_shared";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ data: await catalogDirectoryRpc("catalog_directory_public") }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return repositoryErrorResponse(error, "CATALOG_DIRECTORY_UNAVAILABLE", "Directory settings could not be loaded."); }
}
