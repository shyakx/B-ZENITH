export const BILLIARD_AMOUNT_MAX = 100_000_000;

export function billiardReceiptNumber(businessDay: string) {
  return `BILLIARD-${businessDay}`;
}

export function parseBilliardAmount(raw: unknown) {
  const value = typeof raw === "number" ? raw : Number(String(raw ?? "").replaceAll(",", "").trim());
  if (!Number.isFinite(value) || value <= 0 || value > BILLIARD_AMOUNT_MAX) return null;
  return Math.round(value);
}

export function sumBilliardAmounts(rows: Array<{ amount: { toNumber(): number } | number }>) {
  return rows.reduce((sum, row) => {
    const amount = typeof row.amount === "number" ? row.amount : row.amount.toNumber();
    return sum + amount;
  }, 0);
}
