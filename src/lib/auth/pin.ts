import bcrypt from "bcryptjs";

const PIN_PATTERN = /^\d{4,6}$/;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be 4 to 6 digits.");
  }
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  return bcrypt.compare(pin, pinHash);
}
