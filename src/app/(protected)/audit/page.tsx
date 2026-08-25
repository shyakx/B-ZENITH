import { DashboardHeader } from "@/components/dashboard/ui";
import { requireUser } from "@/lib/authorization";
import { formatDateTime } from "@/lib/datetime";
import { userAdminRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export default async function AuditPage() {
  await requireUser(userAdminRoles);
  const logs = await prisma.auditLog.findMany({
    take: 250,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <DashboardHeader kicker="Management" title="Audit logs" subtitle="Operational and security events. Sensitive payload details are not shown here." />
      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No audit events recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="p-4">Date / time</th>
                <th className="p-4">Staff</th>
                <th className="p-4">Action</th>
                <th className="p-4">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="p-4">{formatDateTime(log.createdAt)}</td>
                  <td className="p-4">
                    <span className="block font-semibold">{log.actorName ?? log.user?.name ?? "System"}</span>
                    <span className="text-xs text-stone-500">
                      {[log.actorRole, log.actorUsername ? `@${log.actorUsername}` : log.user?.email].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="p-4 font-bold">{log.action}</td>
                  <td className="p-4">{log.entity}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
