import { requireRole } from "@/lib/auth/current-user";
import { staffControlCounts } from "@/lib/admin-control";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { listUsers } from "@/services/users";

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zenith-border bg-white p-3">
      <div className="text-xl font-semibold text-zenith-gold">{value}</div>
      <div className="mt-1 text-xs font-medium text-zenith-muted">{label}</div>
    </div>
  );
}

export default async function AdminHomePage() {
  await requireRole("ADMIN");
  const counts = staffControlCounts(await listUsers());

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <h1 className="text-xl font-semibold text-zenith-gold">System Control</h1>
      <div className="mt-2">
        <VisibleDate />
      </div>
      <p className="mt-3 text-sm">
        Admin has all access: every business page, payment, stock move, report, and staff action.
      </p>

      <section className="mt-6">
        <h2 className="text-base font-semibold">Staff</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CountCard label="Staff" value={counts.staff} />
          <CountCard label="Active Staff" value={counts.active} />
          <CountCard label="Inactive Staff" value={counts.inactive} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Access</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <CountCard label="Owners" value={counts.owners} />
          <CountCard label="Admins" value={counts.admins} />
          <CountCard label="Managers" value={counts.managers} />
          <CountCard label="Cashiers" value={counts.cashiers} />
          <CountCard label="Waiters" value={counts.waiters} />
        </div>
      </section>
    </div>
  );
}
