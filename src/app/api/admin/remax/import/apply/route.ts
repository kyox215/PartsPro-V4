import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import {
  parseRemaxImportSettings,
  previewRemaxImport,
  RemaxImportError,
} from "@/lib/partspro-remax-import";
import {
  blockExistingAdminRemaxImportRows,
  importAdminRemaxBatch,
} from "@/lib/partspro-remax-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

const requiredPermissions = [
  "product.create_draft",
  "product.edit_content",
  "product.edit_cost",
  "product.edit_price",
] as const;

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const missingPermissions = requiredPermissions.filter(
    (permission) => !hasAdminPermission(admin.authState, permission)
  );
  if (missingPermissions.length > 0) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Permessi insufficienti per importare REMAX.", {
      missingPermissions,
    });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const rawSettings = form.get("settings");
    const previewHash = form.get("previewHash");

    if (!(file instanceof File) || typeof rawSettings !== "string" || typeof previewHash !== "string") {
      throw new RemaxImportError("File, impostazioni e conferma anteprima sono obbligatori.");
    }

    const settings = parseRemaxImportSettings(JSON.parse(rawSettings) as unknown);
    const preview = await blockExistingAdminRemaxImportRows(
      await previewRemaxImport(file, settings)
    );

    if (preview.previewHash !== previewHash) {
      return apiError(409, "REMAX_IMPORT_PREVIEW_STALE", "Il file o i dati del lotto sono cambiati. Ripeti il controllo.");
    }
    if (preview.counts.blocked > 0) {
      return apiError(422, "REMAX_IMPORT_BLOCKED", "Correggi tutte le righe bloccate prima di importare.", {
        blocked: preview.counts.blocked,
      });
    }
    if (
      preview.rows.some((row) => row.publish) &&
      !hasAdminPermission(admin.authState, "product.publish")
    ) {
      return apiError(403, "ADMIN_PERMISSION_DENIED", "Manca il permesso di pubblicazione prodotti.", {
        missingPermissions: ["product.publish"],
      });
    }

    return NextResponse.json({ data: await importAdminRemaxBatch(preview.payload) });
  } catch (error) {
    if (error instanceof RemaxImportError) {
      return apiError(400, "INVALID_REMAX_IMPORT", error.message, error.details);
    }
    if (error instanceof SyntaxError) {
      return apiError(400, "INVALID_REMAX_IMPORT_SETTINGS", "Le impostazioni del lotto non sono valide.");
    }
    return repositoryErrorResponse(
      error,
      "ADMIN_REMAX_IMPORT_FAILED",
      "REMAX preorder batch could not be imported."
    );
  }
}
