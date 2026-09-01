import type { Role } from "@/lib/auth/roles";

export type StaffMemberCount = {
  role: Role;
  active: boolean;
};

export function staffControlCounts(users: StaffMemberCount[]) {
  return {
    staff: users.length,
    active: users.filter((user) => user.active).length,
    inactive: users.filter((user) => !user.active).length,
    admins: users.filter((user) => user.role === "ADMIN").length,
    owners: users.filter((user) => user.role === "OWNER").length,
    managers: users.filter((user) => user.role === "MANAGER").length,
    cashiers: users.filter((user) => user.role === "CASHIER").length,
    waiters: users.filter((user) => user.role === "WAITER").length,
  };
}
