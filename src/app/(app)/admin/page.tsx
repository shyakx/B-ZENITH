import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { staffControlCounts } from "@/lib/admin-control";
import { VisibleDate } from "@/components/ui/VisibleDate";
import { listUsers } from "@/services/users";
import { prisma } from "@/lib/prisma";

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="border-l-2 border-zenith-gold bg-white px-4 py-3">
      <div className="text-2xl font-semibold text-zenith-gold">{value}</div>
      <div className="mt-1 text-sm font-semibold">{label}</div>
      <div className="mt-0.5 text-xs text-zenith-muted">{hint}</div>
    </div>
  );
}

function ControlLink({ href, label, text }: { href: string; label: string; text: string }) {
  return (
    <Link href={href} className="group border-b border-zenith-border py-3 transition-colors hover:border-zenith-gold">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-zenith-ink group-hover:text-zenith-gold">{label}</span>
        <span className="text-lg text-zenith-gold" aria-hidden="true">→</span>
      </div>
      <p className="mt-1 max-w-xl text-sm leading-6 text-zenith-muted">{text}</p>
    </Link>
  );
}

export default async function AdminHomePage() {
  await requireRole("ADMIN");
  const [users, system] = await Promise.all([
    listUsers(),
    Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.order.count(),
      prisma.auditLog.count(),
    ]),
  ]);
  const counts = staffControlCounts(users);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zenith-border pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zenith-muted">B-ZENITH administration</p>
          <h1 className="mt-1 font-display text-3xl text-zenith-gold">Control center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zenith-muted">
            Keep access, configuration, oversight, and safe maintenance in one focused workspace.
          </p>
        </div>
        <div className="text-sm text-zenith-muted"><VisibleDate /></div>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">System at a glance</h2>
            <p className="mt-1 text-sm text-zenith-muted">A quick view of the records and people currently managed by the system.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Staff accounts" value={counts.staff} hint={`${counts.active} active · ${counts.inactive} inactive`} />
          <Metric label="Active products" value={system[0]} hint="Available in the catalogue" />
          <Metric label="Orders recorded" value={system[1]} hint="All-time operational records" />
          <Metric label="Audit entries" value={system[2]} hint="Tracked system activity" />
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <h2 className="text-base font-semibold">Administration</h2>
          <div className="mt-2">
            <ControlLink href="/admin/users" label="Staff and roles" text="Create accounts, assign roles, change PINs, and control who can sign in." />
            <ControlLink href="/admin/access" label="Access reference" text="Understand the boundary between owner, admin, manager, cashier, and waiter responsibilities." />
            <ControlLink href="/admin/settings" label="Business settings" text="Maintain the business identity and receipt options used by printed factures." />
            <ControlLink href="/admin/audit" label="Audit history" text="Trace important changes and investigate who changed a record." />
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">Maintenance</h2>
          <p className="mt-1 text-sm leading-6 text-zenith-muted">Use only when cleaning test data or correcting an agreed operational mistake.</p>
          <div className="mt-2">
            <ControlLink href="/admin/data" label="Data control" text="Review matching sales or Maison records before permanently removing them." />
          </div>
          <div className="mt-8 border-t border-zenith-border pt-4">
            <h2 className="text-base font-semibold">Business workspace</h2>
            <p className="mt-1 text-sm leading-6 text-zenith-muted">Operational screens remain available to Admin, but are kept separate from system administration.</p>
            <Link href="/owner" className="mt-3 inline-flex font-semibold text-zenith-gold">Open business overview →</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
