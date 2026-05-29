export const adminPanelPermissions = {
  catalog: "panel.catalog",
  inventory: "panel.inventory",
  orders: "panel.orders",
  overview: "panel.orders",
  settings: "panel.settings",
  timeline: "panel.orders",
} as const;

export const CUSTOMER_MANAGE_LEVEL_PERMISSION = "customers.manage_level";

export const adminPermissions = [
  "panel.orders",
  "panel.catalog",
  "panel.inventory",
  "panel.settings",
  "customers.read",
  "customers.classify",
  CUSTOMER_MANAGE_LEVEL_PERMISSION,
  "employees.read",
  "employees.manage_permissions",
  "orders.read",
  "orders.manage",
  "products.read_admin",
  "products.manage",
  "products.pricing",
  "inventory.manage",
  "product.read_admin",
  "product.create_draft",
  "product.edit_content",
  "product.edit_price",
  "product.edit_cost",
  "product.adjust_stock",
  "product.publish",
  "product.hide",
  "product.block",
  "product.restore_draft",
  "product.image_manage",
] as const;

export type AdminPermission = (typeof adminPermissions)[number] | string;

export const roleTemplateLabels: Record<string, string> = {
  admin: "Administrator",
  auditor: "Auditor",
  catalog_manager: "Catalog manager",
  inventory_manager: "Inventory manager",
  pricing_manager: "Pricing manager",
  purchasing: "Purchasing",
  sales: "Sales",
  sales_support: "Sales support",
  warehouse: "Warehouse",
};

const adminPermissionSet = new Set(adminPermissions);

export const roleTemplatePermissions: Record<string, Set<string>> = {
  admin: adminPermissionSet,
  auditor: new Set([
    "panel.orders",
    "panel.catalog",
    "orders.read",
    "customers.read",
    "employees.read",
    "products.read_admin",
    "product.read_admin",
  ]),
  catalog_manager: new Set([
    "panel.catalog",
    "products.read_admin",
    "products.manage",
    "product.read_admin",
    "product.create_draft",
    "product.edit_content",
    "product.publish",
    "product.hide",
    "product.restore_draft",
    "product.image_manage",
  ]),
  inventory_manager: new Set([
    "panel.catalog",
    "panel.inventory",
    "products.read_admin",
    "inventory.manage",
    "product.read_admin",
    "product.adjust_stock",
  ]),
  pricing_manager: new Set([
    "panel.catalog",
    "products.read_admin",
    "products.pricing",
    "product.read_admin",
    "product.edit_price",
    "product.edit_cost",
  ]),
  purchasing: new Set([
    "panel.catalog",
    "products.read_admin",
    "products.manage",
    "product.read_admin",
    "product.create_draft",
    "product.edit_content",
  ]),
  sales: new Set([
    "panel.orders",
    "orders.read",
    "orders.manage",
    "customers.read",
    "customers.classify",
    CUSTOMER_MANAGE_LEVEL_PERMISSION,
    "employees.read",
  ]),
  sales_support: new Set([
    "panel.orders",
    "panel.catalog",
    "orders.read",
    "customers.read",
    "employees.read",
    "products.read_admin",
    "product.read_admin",
  ]),
  warehouse: new Set([
    "panel.inventory",
    "products.read_admin",
    "inventory.manage",
    "product.read_admin",
    "product.adjust_stock",
  ]),
};

export function permissionsForRoleTemplate(role: string | null | undefined) {
  return roleTemplatePermissions[role ?? ""] ?? new Set<string>();
}

export function visiblePanelsForPermissions(permissions: Iterable<string>) {
  const permissionSet = new Set(permissions);

  return Object.entries(adminPanelPermissions)
    .filter(
      ([panel, permission]) =>
        permissionSet.has(permission) ||
        (panel === "settings" &&
          (permissionSet.has("employees.manage_permissions") ||
            permissionSet.has("customers.read") ||
            permissionSet.has("customers.classify") ||
            permissionSet.has(CUSTOMER_MANAGE_LEVEL_PERMISSION)))
    )
    .map(([panel]) => panel);
}
