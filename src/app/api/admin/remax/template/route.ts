import { NextResponse } from "next/server";
import { buildRemaxTemplateBuffer } from "@/lib/partspro-remax-import";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminApi("product.read_admin");
  if (!admin.ok) return admin.response;

  try {
    const body = await buildRemaxTemplateBuffer();
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="partspro-remax-preordini-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_REMAX_TEMPLATE_FAILED",
      "REMAX import template could not be generated."
    );
  }
}
