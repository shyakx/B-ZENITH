export const IDEMPOTENCY_KEY_SCHEMA = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function scopedIdempotencyKey(userId: string, clientKey: string) {
  return `${userId}:${clientKey.trim().toLowerCase()}`;
}

export function isPrismaErrorCode(error: unknown, code: string) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === code,
  );
}

export function isSerializationFailure(error: unknown) {
  return isPrismaErrorCode(error, "P2034");
}

export function isUniqueConstraint(error: unknown) {
  return isPrismaErrorCode(error, "P2002");
}

export async function runIdempotentCreate<T>(options: {
  attempts?: number;
  findExisting: () => Promise<T | null>;
  create: () => Promise<T>;
}): Promise<{ value: T; created: boolean }> {
  const existing = await options.findExisting();
  if (existing) return { value: existing, created: false };

  const attempts = options.attempts ?? 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return { value: await options.create(), created: true };
    } catch (error) {
      const found = await options.findExisting();
      if (found) return { value: found, created: false };
      const canRetry = isSerializationFailure(error) && attempt < attempts - 1;
      if (canRetry) continue;
      throw error;
    }
  }

  throw new Error("Unable to complete the idempotent write.");
}

export function salePublicPayload(sale: { id: string; receiptNumber: string; total: { toFixed(digits: number): string } | string }) {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    total: typeof sale.total === "string" ? sale.total : sale.total.toFixed(2),
  };
}
