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
