import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/dates";
import { CreateUserForm } from "@/components/admin/UserForms";
import { Badge } from "@/components/ui/Badge";
import { listUsers } from "@/services/users";

export default async function StaffPage() {
  await requireRole("ADMIN");
  const users = await listUsers();

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <h1 className="font-display text-2xl text-zenith-gold">Staff</h1>
      <p className="mt-2 text-sm">Create an account, give the person a temporary PIN, then they log in as usual.</p>

      <section className="mt-6 rounded-2xl border border-zenith-border bg-white p-5">
        <h2 className="mb-4 font-display text-2xl">Create staff</h2>
        <CreateUserForm />
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">People</h2>
        <div className="mt-3 grid gap-3">
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/admin/users/${user.id}`}
              className="block min-w-0 rounded-2xl border border-zenith-border bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-2xl text-zenith-gold">{user.name}</div>
                  <div className="mt-1 text-sm font-semibold uppercase tracking-wider">{user.role}</div>
                  <div className="mt-1 text-sm">{formatDate(user.createdAt)}</div>
                </div>
                <Badge
                  className={
                    user.active
                      ? "border-emerald-200 bg-emerald-50 text-zenith-success"
                      : "border-zenith-border bg-zenith-surface text-zenith-muted"
                  }
                >
                  {user.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
