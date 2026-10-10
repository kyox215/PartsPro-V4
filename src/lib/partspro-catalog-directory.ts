import { z } from "zod";
import { catalogDepartments, type CatalogDepartment, type DeviceModelGroup } from "./partspro-data";

export const catalogNodeSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["department", "brand", "category"]),
  value: z.string().trim().min(1).max(80),
  nameZh: z.string().trim().min(1).max(120),
  nameIt: z.string().trim().min(1).max(120),
  position: z.number().int().min(0).max(10000),
  active: z.boolean().default(true),
  version: z.number().int().positive().optional(),
}).strict().superRefine((node, context) => {
  if (!node.id && !node.active) context.addIssue({ code: "custom", path: ["active"], message: "New directory nodes start active; save before disabling" });
  if (!node.id && node.kind === "category" && node.value.length < 2) context.addIssue({ code: "custom", path: ["value"], message: "Category codes need at least two characters" });
  if (node.id && !node.version) context.addIssue({ code: "custom", path: ["version"], message: "Version required" });
  if (node.kind === "department" && (!node.id || !node.active || !catalogDepartments.includes(node.value as CatalogDepartment))) {
    context.addIssue({ code: "custom", path: ["kind"], message: "The four departments cannot be created or disabled" });
  }
});
export type CatalogNodeInput = z.infer<typeof catalogNodeSchema>;
export type CatalogNode = CatalogNodeInput & {
  id: string;
  version: number;
  count: number;
  countsByDepartment: Partial<Record<CatalogDepartment, number>>;
};
export type CatalogDirectory = { revision: string; nodes: CatalogNode[] };
export const catalogMoveSchema = z.object({
  products: z.array(z.object({ sku: z.string().trim().min(1).max(64), updatedAt: z.string().datetime({ offset: true }) }).strict()).min(1).max(100),
  target: z.object({
    department: z.enum(catalogDepartments).optional(),
    category: z.string().trim().min(2).max(80).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, "Choose a destination"),
  reason: z.string().trim().min(3).max(500),
}).strict().refine((value) => new Set(value.products.map((p) => p.sku)).size === value.products.length, "Duplicate SKU");
export const emptyCatalogDirectory: CatalogDirectory = { revision: "", nodes: [] };
export function catalogNodeLabel(node: CatalogNodeInput, locale: string) {
  return locale.startsWith("zh") ? node.nameZh : node.nameIt;
}

// Universal products may have no model rows; their brand still belongs in navigation.
export function mergeCatalogDirectoryBrands(brands: readonly DeviceModelGroup[], nodes: readonly CatalogNode[], department: CatalogDepartment): DeviceModelGroup[] {
  const merged = [...brands];
  for (const node of nodes) {
    if (node.kind === "brand" && node.active && (node.countsByDepartment[department] ?? 0) > 0
      && !merged.some((brand) => brand.brand.toLowerCase() === node.value.toLowerCase())) {
      merged.push({ brand: node.value, models: [], series: [] });
    }
  }
  return merged;
}
