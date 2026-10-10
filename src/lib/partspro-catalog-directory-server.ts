import "server-only";
import { createClient } from "./supabase/server";
import { RepositoryWriteError } from "./partspro-repository";
import type { CatalogDirectory } from "./partspro-catalog-directory";

export async function catalogDirectoryRpc<T = CatalogDirectory>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = await createClient();
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "28000" ? 401
      : error.code === "P0002" ? 404 : ["40001", "23505"].includes(error.code) ? 409
      : ["23514", "22023", "22007", "22P02"].includes(error.code) ? 422 : 503;
    throw new RepositoryWriteError(status, status === 503 ? "CATALOG_DIRECTORY_UNAVAILABLE" : "CATALOG_DIRECTORY_REJECTED",
      status === 503 ? "Directory management is not available. Verify the required migration." : error.message);
  }
  if (data === null) throw new RepositoryWriteError(503, "CATALOG_DIRECTORY_UNAVAILABLE", "Directory data could not be read.");
  return data as T;
}
