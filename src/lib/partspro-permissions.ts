export const adminPanelPermissions = {
  accounts: "panel.accounts",
  catalog: "panel.catalog",
  inventory: "panel.inventory",
  marketplace: "panel.marketplace",
  orders: "panel.orders",
  overview: "panel.orders",
  settings: "panel.settings",
  timeline: "panel.orders",
} as const;

export const CUSTOMER_MANAGE_LEVEL_PERMISSION = "customers.manage_level";

export const adminPermissions = [
  "panel.orders",
  "panel.accounts",
  "panel.catalog",
  "panel.inventory",
  "panel.marketplace",
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
  "ebay.connect",
  "ebay.publish",
  "ebay.sync_inventory",
  "ebay.orders",
  "ebay.settings",
  "ebay.jobs",
] as const;

export type AdminPermission = (typeof adminPermissions)[number] | string;

export const roleTemplateLabels: Record<string, string> = {
  admin: "Administrator",
  auditor: "Auditor",
  catalog_manager: "Catalog manager",
  commerce_manager: "Commerce manager",
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
  commerce_manager: new Set([
    "panel.marketplace",
    "ebay.connect",
    "ebay.publish",
    "ebay.sync_inventory",
    "ebay.orders",
    "ebay.settings",
    "ebay.jobs",
    "products.read_admin",
    "product.read_admin",
    "orders.read",
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
  ]),
  sales_support: new Set([
    "panel.orders",
    "panel.catalog",
    "orders.read",
    "customers.read",
    "customers.classify",
    CUSTOMER_MANAGE_LEVEL_PERMISSION,
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
  const panels = new Set<string>();

  for (const [panel, permission] of Object.entries(adminPanelPermissions)) {
    if (panel === "accounts" || panel === "settings") {
      continue;
    }

    if (permissionSet.has(permission)) {
      panels.add(panel);
    }
  }

  if (
    permissionSet.has("panel.accounts") ||
    permissionSet.has("customers.read") ||
    permissionSet.has("employees.read") ||
    permissionSet.has("employees.manage_permissions")
  ) {
    panels.add("accounts");
  }

  if (
    permissionSet.has("panel.settings") ||
    permissionSet.has("employees.manage_permissions")
  ) {
    panels.add("settings");
  }

  return [...panels];
}
