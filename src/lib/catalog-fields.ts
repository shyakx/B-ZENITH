import type { ProductUnit } from "@prisma/client";

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
  const data = {
    name: input.name,
    categoryId: input.categoryId,
    description: input.description,
    costPrice: input.costPrice,
    sellingPrice: input.sellingPrice,
    unit: input.unit,
    imageUrl: input.imageUrl,
    active: input.active,
    trackInventory: input.trackInventory,
    ...(input.sku ? { sku: input.sku } : {}),
  };
  return data;
}

export function newProductStockQuantity() {
  return 0;
}
