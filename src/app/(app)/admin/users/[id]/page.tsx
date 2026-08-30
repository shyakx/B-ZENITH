import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { auditActionLabel, auditAffected } from "@/lib/admin-audit";
import { formatDate, formatDateTime } from "@/lib/dates";
import { StaffActions } from "@/components/admin/UserForms";
import { Badge } from "@/components/ui/Badge";
import { getUserById, listUserAudit } from "@/services/users";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const logs = await listUserAudit(user.id);

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link href="/admin/users" className="text-sm font-semibold text-zenith-gold">
        ← Staff
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-zenith-gold">{user.name}</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider">{user.role}</p>
          <p className="mt-1 text-sm">Created {formatDate(user.createdAt)}</p>
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

      <div className="mt-6">
        <StaffActions user={user} />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Recent activity</h2>
        {logs.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-zenith-border bg-white px-4 py-6">
            No staff activity recorded yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-zenith-border bg-white p-4">
                <div className="font-semibold">{auditActionLabel(log.action)}</div>
                <div className="mt-1 text-sm">{auditAffected(log)}</div>
                <div className="mt-1 text-sm">
                  {log.user.name} · {formatDateTime(log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
