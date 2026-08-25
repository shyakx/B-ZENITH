import { compare } from "bcryptjs";
import { z } from "zod";

export const PIN_LOCK_AFTER = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;

export const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "PIN must be 4 digits.");

export type PinVerifyFailure = "locked" | "invalid" | "missing" | "not_found";
export type PinVerifyResult = { ok: true } | { ok: false; reason: PinVerifyFailure };

export function isPinCurrentlyLocked(pinLockedUntil: Date | null | undefined, now = new Date()) {
  return Boolean(pinLockedUntil && pinLockedUntil > now);
}

export function nextPinFailureState(currentAttempts: number, now = new Date()) {
  const pinFailedAttempts = currentAttempts + 1;
  const pinLockedUntil = pinFailedAttempts >= PIN_LOCK_AFTER ? new Date(now.getTime() + PIN_LOCK_MS) : null;
  return { pinFailedAttempts, pinLockedUntil };
}

/**
 * Single PIN verification + lockout writer used by login and manager approval.
 * Never returns pinHash. Callers must not log the PIN.
 */
export async function verifyAndRecordPinAttempt(userId: string, pin: string): Promise<PinVerifyResult> {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, pinHash: true, pinFailedAttempts: true, pinLockedUntil: true },
  });
  if (!user) return { ok: false, reason: "not_found" };
  if (!user.pinHash) return { ok: false, reason: "missing" };
  if (isPinCurrentlyLocked(user.pinLockedUntil)) return { ok: false, reason: "locked" };

  const ok = await compare(pin, user.pinHash);
  if (!ok) {
    const failure = nextPinFailureState(user.pinFailedAttempts);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        pinFailedAttempts: failure.pinFailedAttempts,
        pinLockedUntil: failure.pinLockedUntil,
      },
    });
    return { ok: false, reason: "invalid" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { pinFailedAttempts: 0, pinLockedUntil: null },
  });
  return { ok: true };
}
