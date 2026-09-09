import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { auditActionLabel, auditAffected } from "@/lib/admin-audit";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { listUsers } from "@/services/users";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  await requireRole("ADMIN");
  const { userId } = await searchParams;
  const [logs, staff] = await Promise.all([
    prisma.auditLog.findMany({
      take: 200,
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
    listUsers(),
  ]);
  const selected = staff.find((user) => user.id === userId);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <h1 className="text-xl font-semibold text-zenith-gold">Audit</h1>

      <form className="mt-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Staff</span>
          <select
            name="userId"
            defaultValue={userId ?? ""}
            className="min-w-[12rem] rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
          >
            <option value="">All staff</option>
            {staff.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.role}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-xl bg-zenith-gold px-4 py-2 font-semibold text-white">Filter</button>
        {userId ? (
          <Link href="/admin/audit" className="self-center text-sm font-semibold text-zenith-gold">
            Clear filter
          </Link>
        ) : null}
      </form>

      {selected ? (
        <p className="mt-3 text-sm text-zenith-muted">Showing activity for {selected.name}.</p>
      ) : null}

      {logs.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-zenith-border bg-white px-4 py-6">No audit records yet.</p>
      ) : (
        <div className="mt-6 grid gap-3">
          {logs.map((log) => (
            <article key={log.id} className="min-w-0 rounded-2xl border border-zenith-border bg-white p-4">
              <div className="text-base font-semibold text-zenith-gold">{auditActionLabel(log.action)}</div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Date and time</dt>
                  <dd className="mt-0.5 font-semibold">{formatDateTime(log.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">User</dt>
                  <dd className="mt-0.5 font-semibold">
                    {log.user.name} · {log.user.role}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">What was affected</dt>
                  <dd className="mt-0.5 font-semibold">{auditAffected(log)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
