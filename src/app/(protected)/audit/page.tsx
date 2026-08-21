import { requireUser } from "@/lib/authorization";
import { formatDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export default async function AuditPage() {
  await requireUser(["OWNER"]);
  const logs = await prisma.auditLog.findMany({
    take: 250,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Security</p>
        <h1 className="text-3xl font-black">Audit logs</h1>
      </div>
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
