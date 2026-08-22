import type { ProductUnit, Role } from "@prisma/client";

export const DELETED_PRODUCT_SKU_PREFIX = "__del__.";

export const PRODUCT_DELETE_DENIED_MESSAGE = "Only an admin can delete menu items.";

export const PRICE_ADJUST_DENIED_MESSAGE = "Only a manager can change menu prices.";

export type CatalogProductWrite = {
  name: string;
  sku?: string;
  categoryId: string;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  unit: ProductUnit;
  imageUrl?: string;
  active: boolean;
  trackInventory: boolean;
};

export function catalogProductWriteData(input: CatalogProductWrite) {
  return {
    name: input.name,
    categoryId: input.categoryId,
    description: input.description,
    unit: input.unit,
    imageUrl: input.imageUrl,
    active: input.active,
    trackInventory: input.trackInventory,
    costPrice: input.costPrice,
    sellingPrice: input.sellingPrice,
    ...(input.sku ? { sku: input.sku } : {}),
  };
}

export function catalogProductNonPriceWriteData(input: CatalogProductWrite) {
  return {
    name: input.name,
    categoryId: input.categoryId,
    description: input.description,
    unit: input.unit,
    imageUrl: input.imageUrl,
    active: input.active,
    trackInventory: input.trackInventory,
    ...(input.sku ? { sku: input.sku } : {}),
  };
}

export function newProductStockQuantity() {
  return 0;
}

export function isDeletedProductSku(sku: string) {
  return sku.startsWith(DELETED_PRODUCT_SKU_PREFIX);
}

export function authorizeProductDelete(actorRole: Role) {
  if (actorRole === "OWNER" || actorRole === "ADMIN") return { ok: true as const };
  return { ok: false as const, error: PRODUCT_DELETE_DENIED_MESSAGE };
}

export function canAdjustPrices(actorRole: Role) {
  return actorRole === "MANAGER";
}

export function authorizePriceAdjust(actorRole: Role) {
  if (canAdjustPrices(actorRole)) return { ok: true as const };
  return { ok: false as const, error: PRICE_ADJUST_DENIED_MESSAGE };
}
