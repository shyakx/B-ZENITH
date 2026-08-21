import { z } from "zod";

export const PIN_LOCK_AFTER = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;

export const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "PIN must be 4 digits.");
