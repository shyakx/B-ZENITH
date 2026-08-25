import type { Role } from "@prisma/client";

export const userAdminRoles = ["ADMIN", "OWNER"] as const;
export const businessRoles = ["ADMIN", "OWNER", "MANAGER"] as const;
export const managerRoles = ["ADMIN", "OWNER", "MANAGER"] as const;
export const catalogRoles = ["ADMIN", "OWNER", "MANAGER"] as const;
/** Read-only Stock page. Mutations stay on stockMutateRoles. */
export const stockViewRoles = ["ADMIN", "OWNER", "MANAGER", "WAITER"] as const;
export const stockMutateRoles = catalogRoles;
export const tillRoles = ["ADMIN", "OWNER", "MANAGER", "WAITER"] as const;
export const billiardRoles = ["ADMIN", "OWNER", "MANAGER", "WAITER", "BILLIARD"] as const;

export const loginRoles = [
  { id: "ADMIN", label: "Admin", hint: "Users, settings, and full system access" },
  { id: "OWNER", label: "Owner", hint: "Business overview and settings" },
  { id: "MANAGER", label: "Manager", hint: "Day sales, inventory, and operations" },
  { id: "WAITER", label: "Waiter", hint: "Sell at the register" },
  { id: "BILLIARD", label: "Billiard", hint: "Record today’s billiard sales total" },
] as const;

export function isAdminRole(role: Role | string) {
  return role === "ADMIN";
}

export function roleTitle(role: Role | string) {
  if (role === "ADMIN") return "Admin";
  if (role === "OWNER") return "Owner";
  if (role === "MANAGER") return "Manager";
  if (role === "WAITER") return "Waiter";
  if (role === "BILLIARD") return "Billiard";
  return role;
}

/** Staff are shown by their real name. Role is separate (Admin, Owner, …). */
export function publicStaffName(person: {
  role?: Role | string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}) {
  const name = person.name?.trim();
  if (name) return name;
  const fromParts = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  const username = person.username?.trim();
  if (username) return username;
  return "Staff";
}
