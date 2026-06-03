import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import type { ProductPatchPayload } from "./_schemas";

type AdminAuthStateInput = Parameters<typeof hasAdminPermission>[0];

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
    .filter((requirement) => !hasAdminPermission(authState, requirement.permission));
}
