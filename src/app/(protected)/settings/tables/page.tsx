import { DashboardHeader } from "@/components/dashboard/ui";
import { TableManagement } from "@/components/table-management";
import { requireUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { tableAdminRoles } from "@/lib/table-admin";
import { SessionStatus } from "@prisma/client";
import Link from "next/link";

export default async function SettingsTablesPage() {
  await requireUser(tableAdminRoles);

  const tables = await prisma.table.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      sessions: {
        where: { status: { in: [SessionStatus.ACTIVE, SessionStatus.SETTLING] } },
        take: 1,
        select: {
          waiter: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <DashboardHeader
        kicker="Settings"
        title="Tables"
        subtitle="Configure the restaurant’s tables. Waiters use these records in POS → Table. Adding a table does not start a service session."
        actions={
          <Link href="/settings" className="bz-btn-outline inline-flex min-h-11 items-center px-4">
            Back to settings
          </Link>
        }
      />
      <TableManagement
        tables={tables.map((table) => ({
          id: table.id,
          name: table.name,
          status: table.status,
          active: table.active,
          sortOrder: table.sortOrder,
          openSession: table.sessions[0]
            ? { waiterName: table.sessions[0].waiter.name }
            : null,
        }))}
      />
    </div>
  );
}
