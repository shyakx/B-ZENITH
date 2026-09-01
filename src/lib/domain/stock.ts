export function assertPositiveQuantity(quantity: number, label = "Quantity"): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }
}

export function nextStockAfterSale(current: number, quantity: number): number {
  assertPositiveQuantity(quantity);
  if (current < quantity) {
    throw new Error("Not enough stock for this product.");
  }
  return current - quantity;
}

export function nextStockAfterIncrease(current: number, quantity: number): number {
  assertPositiveQuantity(quantity);
  return current + quantity;
}

export function nextStockAfterWaste(current: number, quantity: number): number {
  assertPositiveQuantity(quantity);
  if (current < quantity) {
    throw new Error("Waste quantity cannot exceed current stock.");
  }
  return current - quantity;
}

export function nextStockAfterAdjustment(current: number, delta: number): number {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("Adjustment must be a non-zero whole number.");
  }
  const next = current + delta;
  if (next < 0) {
    throw new Error("Adjustment would make stock negative.");
  }
  return next;
}

export function nextStockAfterCount(counted: number): { next: number } {
  if (!Number.isInteger(counted) || counted < 0) {
    throw new Error("Counted stock cannot be negative.");
  }
  return { next: counted };
}

export function isLowStock(trackInventory: boolean, stockQuantity: number, threshold = 5): boolean {
  return trackInventory && stockQuantity <= threshold;
}

export function assertNonNegativeStock(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("Stock quantity cannot be negative.");
  }
}

export function convertPackToBase(packQuantity: number, baseQuantityPerPack: number): number {
  assertPositiveQuantity(packQuantity, "Pack quantity");
  if (!Number.isInteger(baseQuantityPerPack) || baseQuantityPerPack <= 0) {
    throw new Error("Pack conversion must use a positive whole number of base units.");
  }
  return packQuantity * baseQuantityPerPack;
}

export function nextStockAfterTransferOut(current: number, quantity: number): number {
  assertPositiveQuantity(quantity, "Transfer quantity");
  if (current < quantity) {
    throw new Error("Not enough stock to transfer.");
  }
  return current - quantity;
}

export function assertTransferQuantity(quantity: number): void {
  assertPositiveQuantity(quantity, "Transfer quantity");
}

export function assertReceiptDestination(code: string): void {
  if (code !== "MAIN") {
    throw new Error("Stock can only be received into Main Stock.");
  }
}

export function assertAllowedV1Transfer(fromCode: string, toCode: string): void {
  if (fromCode === toCode) {
    throw new Error("Source and destination must be different.");
  }
  if (fromCode !== "MAIN") {
    throw new Error("Stock can only be transferred from Main Stock.");
  }
  if (toCode !== "BAR" && toCode !== "KITCHEN" && toCode !== "CAFE") {
    throw new Error("Stock can only be transferred to Bar, Kitchen, or Cafe.");
  }
}

export function saleStockMessage(productName: string, locationName: string, available: number): string {
  return `Not enough ${locationName} stock for ${productName}. Available: ${available}. Transfer stock from Main Stock first.`;
}
