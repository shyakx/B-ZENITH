import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { assignableRoles } from "@/lib/auth/staff-policy";
import { roleLabel } from "@/lib/auth/roles";
import { formatDate } from "@/lib/dates";
import { CreateUserForm } from "@/components/admin/UserForms";
import { Badge } from "@/components/ui/Badge";
import { countActiveOwners, listUsers } from "@/services/users";

export default async function StaffPage() {
  const actor = await requireRole("ADMIN");
  const [users, ownerCount] = await Promise.all([listUsers(), countActiveOwners()]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <h1 className="text-xl font-semibold text-zenith-gold">Staff</h1>
      <p className="mt-1 text-sm text-zenith-muted">
        Create an account, give the person a temporary PIN, then they log in as usual.
      </p>

      <section className="mt-5 rounded-xl border border-zenith-border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold">Create staff</h2>
        <CreateUserForm assignableRoles={assignableRoles(actor.role, ownerCount)} />
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">People</h2>
        <div className="mt-2 grid gap-2">
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/admin/users/${user.id}`}
              className="block min-w-0 rounded-xl border border-zenith-border bg-white px-3 py-2.5 hover:border-zenith-gold"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-zenith-gold">{user.name}</div>
                  <div className="mt-0.5 truncate text-sm text-zenith-muted">
                    {roleLabel(user.role)} · {formatDate(user.createdAt)}
                  </div>
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
