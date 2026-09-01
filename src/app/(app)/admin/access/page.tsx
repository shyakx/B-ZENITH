import { requireRole } from "@/lib/auth/current-user";
import { listUsers } from "@/services/users";
import { roleLabel, type Role } from "@/lib/auth/roles";

const ACCESS: {
  role: Role;
  can: string[];
  cannot: string[];
}[] = [
  {
    role: "OWNER",
    can: [
      "See the entire business",
      "Take orders and run POS",
      "View tables, bills, and outstanding",
      "Record payments when needed",
      "Manage products and inventory",
      "View reports and Maison",
      "Manage staff, roles, settings, and audit",
    ],
    cannot: ["Leave the business without an active owner"],
  },
  {
    role: "WAITER",
    can: ["Create orders", "View own orders", "Void own unpaid orders", "Order again"],
    cannot: [
      "Take payments",
      "Manage stock",
      "Change products",
      "Manage users",
      "Change settings",
    ],
  },
  {
    role: "CASHIER",
    can: [
      "View bills",
      "Record payments",
      "Record pay later",
      "Settle outstanding bills",
      "Print factures",
    ],
    cannot: [
      "Create orders",
      "Manage products",
      "Manage stock",
      "Manage users",
      "Change settings",
    ],
  },
  {
    role: "MANAGER",
    can: [
      "View all orders",
      "Manage inventory",
      "Manage products",
      "Manage tables",
      "View reports",
      "Manage Maison de Passage",
    ],
    cannot: ["Record payments", "Manage users", "Change system settings"],
  },
  {
    role: "ADMIN",
    can: ["Manage staff", "Assign non-owner roles", "Reset PINs", "Manage settings", "View audit log"],
    cannot: [
      "Orders",
      "Payments",
      "Stock",
      "Products",
      "Daily business operations",
      "Create or promote an owner once an owner exists",
    ],
  },
];

export default async function AccessPage() {
  await requireRole("ADMIN");
  const users = await listUsers();

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <h1 className="text-xl font-semibold text-zenith-gold">Access</h1>
      <p className="mt-2 text-sm">
        These five roles are fixed. Owner sees the whole business. Admin manages people and system
        settings, not daily floor work.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {ACCESS.map((item) => (
          <section key={item.role} className="rounded-2xl border border-zenith-border bg-white p-5">
            <h2 className="text-base font-semibold text-zenith-gold">{roleLabel(item.role)}</h2>
            <div className="mt-3 text-sm">
              <div className="font-semibold">Can</div>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {item.can.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="mt-4 font-semibold">Cannot</div>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {item.cannot.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-zenith-border bg-white p-5">
        <h2 className="mb-3 text-base font-semibold">Current assignments</h2>
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">{user.name}</span>
              <span className="font-semibold uppercase tracking-wider text-zenith-gold">
                {roleLabel(user.role)}
                {user.active ? "" : " · inactive"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
