import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9]+(?:[._][a-z0-9]+)*$/, "Username can use letters, numbers, dots, and underscores.");

export function displayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

export function staffEmail(username: string) {
  return `${username}@staff.bzenith.local`;
}

export function splitName(fullName: string) {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(" ");
  if (space === -1) return { firstName: trimmed || "Staff", lastName: "Staff" };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1).trim() || "Staff" };
}
