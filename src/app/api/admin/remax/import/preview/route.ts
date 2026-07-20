import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import {
  parseRemaxImportSettings,
  previewRemaxImport,
  RemaxImportError,
} from "@/lib/partspro-remax-import";
import { requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdminApi("product.read_admin");
  if (!admin.ok) return admin.response;

  try {
    const { file, settings } = await readImportForm(request);
    const preview = await previewRemaxImport(file, settings);
    return NextResponse.json({ data: preview });
  } catch (error) {
    if (error instanceof RemaxImportError) {
      return apiError(400, "INVALID_REMAX_IMPORT", error.message, error.details);
    }
    return apiError(500, "REMAX_IMPORT_PREVIEW_FAILED", "Impossibile controllare il file REMAX.");
  }
}

async function readImportForm(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new RemaxImportError("La richiesta deve contenere un file e le impostazioni del lotto.");
  }

  const file = form.get("file");
  const rawSettings = form.get("settings");
  if (!(file instanceof File) || typeof rawSettings !== "string") {
    throw new RemaxImportError("Seleziona un file e completa i dati del lotto.");
  }

  let settings: unknown;
  try {
    settings = JSON.parse(rawSettings);
  } catch {
    throw new RemaxImportError("Le impostazioni del lotto non sono JSON valido.");
  }

  return { file, settings: parseRemaxImportSettings(settings) };
}
