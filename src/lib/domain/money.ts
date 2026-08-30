export function lineTotal(unitPrice: number, quantity: number): number {
  if (!Number.isInteger(unitPrice) || unitPrice < 0) {
    throw new Error("Unit price must be a non-negative integer.");
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer.");
  }
  return unitPrice * quantity;
}

export function sumLineTotals(
  items: { unitPrice: number; quantity: number }[],
): number {
  return items.reduce((sum, item) => sum + lineTotal(item.unitPrice, item.quantity), 0);
}

export function remainingBalance(total: number, paidAmount: number): number {
  return Math.max(0, total - paidAmount);
}

export function formatRwf(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${safe.toLocaleString("en-US")} RWF`;
}
