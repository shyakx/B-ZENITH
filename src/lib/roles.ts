import type { Role } from "@prisma/client";

export const userAdminRoles = ["ADMIN", "OWNER"] as const;
export const businessRoles = ["ADMIN", "OWNER", "MANAGER"] as const;
export const catalogRoles = ["ADMIN", "OWNER", "MANAGER"] as const;
export const tillRoles = ["ADMIN", "OWNER", "MANAGER", "WAITER"] as const;

export const loginRoles = [
  { id: "ADMIN", label: "Admin", hint: "Users, settings, and full system access" },
  { id: "OWNER", label: "Owner", hint: "Business overview and settings" },
  { id: "MANAGER", label: "Manager", hint: "Day sales, inventory, and operations" },
  { id: "WAITER", label: "Waiter", hint: "Sell at the register" },
] as const;

export function isAdminRole(role: Role | string) {
  return role === "ADMIN";
}

export function roleTitle(role: Role | string) {
  if (role === "ADMIN") return "Admin";
  if (role === "OWNER") return "Owner";
  if (role === "MANAGER") return "Manager";
  if (role === "WAITER") return "Waiter";
  return role;
}

/** Only the admin account is labeled Admin. Everyone else is shown by their real name. */
export function publicStaffName(person: { role: Role | string; name?: string | null }) {
  if (isAdminRole(person.role)) return "Admin";
  const name = person.name?.trim();
  return name || "Staff";
}
