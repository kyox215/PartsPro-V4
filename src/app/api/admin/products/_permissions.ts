import type { AdminAuthState } from "@/lib/partspro-admin-auth";
import type { ProductPatchPayload, ProductWritePayload } from "./_schemas";

type AdminAuthStateInput = AdminAuthState;

type ProductPatchPermissionRequirement = {
  fields: string[];
  permission: string;
};

const productPatchPermissionRequirements: ProductPatchPermissionRequirement[] = [
  {
    fields: ["price", "retailPrice", "vatMode"],
    permission: "product.edit_price",
  },
  {
    fields: ["costPrice"],
    permission: "product.edit_cost",
  },
  {
    fields: ["imagePath", "imageAlt", "galleryImagePaths"],
    permission: "product.image_manage",
  },
  {
    fields: [
      "name",
      "category",
      "brand",
      "grade",
      "moq",
      "compatibleWith",
      "tags",
      "rmaDays",
      "weightGram",
      "model",
      "modelCode",
      "modelCodes",
      "batchCode",
      "supplier",
    ],
    permission: "product.edit_content",
  },
];

export function missingProductPatchPermissions(
  authState: AdminAuthStateInput,
  payload: ProductPatchPayload
) {
  return productPatchPermissionRequirements
    .filter((requirement) =>
      requirement.fields.some((field) =>
        Object.prototype.hasOwnProperty.call(payload, field)
      )
    )
    .filter((requirement) => !hasExactAdminPermission(authState, requirement.permission));
}

export function missingProductCreatePermissions(
  authState: AdminAuthStateInput,
  payload: ProductWritePayload
) {
  const required = new Set<string>();

  if (
    payload.price > 0 ||
    (payload.retailPrice ?? 0) > 0 ||
    Boolean(payload.vatMode?.trim())
  ) {
    required.add("product.edit_price");
  }

  if ((payload.costPrice ?? 0) > 0) {
    required.add("product.edit_cost");
  }

  if (payload.stock > 0) {
    required.add("product.adjust_stock");
  }

  if (
    Boolean(payload.imagePath?.trim()) ||
    Boolean(payload.imageAlt?.trim()) ||
    (payload.galleryImagePaths?.length ?? 0) > 0
  ) {
    required.add("product.image_manage");
  }

  return [...required].filter(
    (permission) => !hasExactAdminPermission(authState, permission)
  );
}

function hasExactAdminPermission(
  authState: AdminAuthStateInput,
  permission: string
) {
  return authState.allowed && authState.permissions.includes(permission);
}
