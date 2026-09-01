import { Prisma } from "@prisma/client";

export type MoneyValue = Prisma.Decimal | number | string;

export function toDecimal(value: MoneyValue): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function unitCostFromTotalPrice(totalPrice: number, baseQuantity: number): Prisma.Decimal {
  if (!Number.isInteger(totalPrice) || totalPrice <= 0) {
    throw new Error("Price paid must be greater than 0.");
  }
  if (!Number.isInteger(baseQuantity) || baseQuantity <= 0) {
    throw new Error("Quantity must be greater than 0.");
  }
  return new Prisma.Decimal(totalPrice).div(baseQuantity);
}

export function costTimesQuantity(cost: MoneyValue | null | undefined, quantity: number): Prisma.Decimal {
  if (cost == null) return new Prisma.Decimal(0);
  return toDecimal(cost).mul(quantity);
}

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

export function formatRwf(amount: MoneyValue): string {
  try {
    const rounded = toDecimal(amount).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    return `${Number(rounded.toString()).toLocaleString("en-US")} RWF`;
  } catch {
    return "0 RWF";
  }
}

export function formatRwfPerUnit(amount: MoneyValue): string {
  const value = Number(toDecimal(amount).toFixed(2));
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} RWF`;
}
