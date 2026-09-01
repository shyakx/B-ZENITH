import { requireRole } from "@/lib/auth/current-user";
import { auditActionLabel, auditAffected } from "@/lib/admin-audit";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export default async function AuditPage() {
  await requireRole("ADMIN");
  const logs = await prisma.auditLog.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, role: true } } },
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <h1 className="text-xl font-semibold text-zenith-gold">Audit</h1>
      <p className="mt-2 text-sm">Who changed the system, and what they changed.</p>

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
