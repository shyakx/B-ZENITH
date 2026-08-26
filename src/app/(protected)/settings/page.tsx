import type { ReactNode } from "react";
import { updateSettings } from "@/actions/settings";
import { DashboardHeader } from "@/components/dashboard/ui";
import { requireUser } from "@/lib/authorization";
import { userAdminRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  CalendarDays,
  CircleDollarSign,
  KeyRound,
  LayoutGrid,
  ScrollText,
  Tags,
  FolderTree,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

function SettingsNavCard({
  href,
  title,
  description,
  action,
  Icon,
}: {
  href: string;
  title: string;
  description: string;
  action: string;
  Icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      aria-label={`${title}. ${description}`}
      className="group flex min-h-20 cursor-pointer items-center gap-3 rounded-md border border-black bg-white px-4 py-3 text-black outline-none hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-[#FFD758] focus-visible:ring-offset-2"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#FFD758] text-black">
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm font-normal">{description}</span>
      </span>
      <span className="shrink-0 text-sm font-medium group-hover:text-[#FFD758]">
        {action}
        <span aria-hidden> →</span>
      </span>
    </Link>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-md border border-black bg-white px-4 py-3">
      <p className="text-sm font-semibold text-black">{title}</p>
      <div className="mt-1 text-sm font-normal text-black">{children}</div>
    </article>
  );
}

export default async function SettingsPage() {
  await requireUser(userAdminRoles);
  const settings = await prisma.businessSettings.findUnique({ where: { id:"default" } });
  const inputClass ="mt-1 min-h-11 w-full rounded-md border border-black px-3 font-normal outline-none focus:border-[#FFD758]";
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <DashboardHeader
        kicker="Settings"
        title="Restaurant control"
        subtitle="Manage your B-ZENITH restaurant configuration. Editable fields save here. Cards open existing management screens."
      />

      <section>
        <h2 className="bz-section-title mb-2 border-b border-black pb-2">Business</h2>
        <p className="mb-3 text-sm font-normal text-black">Restaurant identity, tax, stock alerts, and receipt text.</p>
        <form action={updateSettings} className="space-y-6 rounded-md border border-black bg-white p-4 sm:p-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Business identity</h3>
            <label className="block text-sm font-medium">Business name<input required name="businessName" defaultValue={settings?.businessName ?? "B-ZENITH"} className={inputClass} /></label>
          </div>

          <div className="space-y-3 border-t border-black pt-4">
            <h3 className="text-sm font-semibold">Contact information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Phone<input name="phone" defaultValue={settings?.phone ??""} className={inputClass} /></label>
              <label className="block text-sm font-medium">Email<input name="email" type="email" defaultValue={settings?.email ??""} className={inputClass} /></label>
            </div>
            <label className="block text-sm font-medium">Address<textarea name="address" rows={2} defaultValue={settings?.address ??""} className="mt-1 w-full rounded-md border border-black p-3 font-normal outline-none focus:border-[#FFD758]" /></label>
          </div>

          <div className="space-y-3 border-t border-black pt-4">
            <h3 className="text-sm font-semibold">Regional settings</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Currency<input readOnly value={settings?.currency ?? "RWF"} className={`${inputClass} bg-white`} /></label>
              <label className="block text-sm font-medium">Timezone<input readOnly value={settings?.timezone ?? "Africa/Kigali"} className={`${inputClass} bg-white`} /></label>
            </div>
            <p className="text-sm font-normal text-black">Currency is RWF and dates use Africa/Kigali. These values are fixed in the system.</p>
          </div>

          <div className="space-y-3 border-t border-black pt-4">
            <h3 className="text-sm font-semibold">Tax</h3>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="taxEnabled" defaultChecked={settings?.taxEnabled ?? false} />
              Charge VAT / tax on sales
            </label>
            <label className="block text-sm font-medium">Tax rate (%)
              <input name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={Number(settings?.taxRate ?? 0).toFixed(2)} className={inputClass} />
            </label>
            <p className="text-sm font-normal text-black">Leave tax disabled until the correct B-ZENITH rate is confirmed. Do not guess a rate.</p>
          </div>

          <div className="space-y-3 border-t border-black pt-4">
            <h3 className="text-sm font-semibold">Inventory alerts</h3>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="lowStockEnabled" defaultChecked={settings?.lowStockEnabled ?? true} />
              Show low-stock warnings
            </label>
            <label className="block text-sm font-medium">Default low-stock level
              <input name="defaultReorderLevel" type="number" min="0" defaultValue={settings?.defaultReorderLevel ?? 5} className={inputClass} />
            </label>
          </div>

          <div className="space-y-3 border-t border-black pt-4">
            <h3 className="text-sm font-semibold">Receipt</h3>
            <label className="block text-sm font-medium">Receipt footer<textarea required name="receiptFooter" rows={3} defaultValue={settings?.receiptFooter ?? "Thank you for dining with us."} className="mt-1 w-full rounded-md border border-black p-3 font-normal outline-none focus:border-[#FFD758]" /></label>
            <p className="text-sm font-normal text-black">Receipts also print “Powered by Cloud Sync Company”.</p>
          </div>

          <button className="bz-btn-primary w-full sm:w-auto sm:min-w-48">Save changes</button>
        </form>
      </section>

      <section>
        <h2 className="bz-section-title mb-2 border-b border-black pb-2">Restaurant</h2>
        <p className="mb-3 text-sm font-normal text-black">Physical floor, menu, and stock destinations already in the system.</p>
        <nav aria-label="Restaurant configuration" className="grid gap-2 md:grid-cols-2">
          <SettingsNavCard
            href="/settings/tables"
            title="Tables"
            description="Configure table names and active or inactive floor tables for POS."
            action="Manage"
            Icon={LayoutGrid}
          />
          <SettingsNavCard
            href="/menu"
            title="Menu"
            description="Manage products that appear in POS."
            action="Open"
            Icon={Tags}
          />
          <SettingsNavCard
            href="/categories"
            title="Categories"
            description="Organize the menu into categories used on the floor."
            action="Open"
            Icon={FolderTree}
          />
        </nav>
        <div className="mt-2">
          <InfoPanel title="Inventory locations">
            Stock already uses Main Stock, Bar, and Kitchen. Location names are not configurable here yet. Review quantities on Stock.
          </InfoPanel>
        </div>
      </section>

      <section>
        <h2 className="bz-section-title mb-2 border-b border-black pb-2">Staff and access</h2>
        <p className="mb-3 text-sm font-normal text-black">Create staff and assign an existing role. Role permissions are not edited on this page.</p>
        <nav aria-label="Staff and access" className="grid gap-2 md:grid-cols-2">
          <SettingsNavCard
            href="/employees"
            title="Staff"
            description="Add restaurant users, set roles, and activate or deactivate accounts."
            action="Manage"
            Icon={Users}
          />
        </nav>
        <div className="mt-2">
          <InfoPanel title="Roles in use">
            OWNER, ADMIN, MANAGER, WAITER, and BILLIARD. Assign a role when you create or edit a staff member. There is no separate permissions editor.
          </InfoPanel>
        </div>
      </section>

      <section>
        <h2 className="bz-section-title mb-2 border-b border-black pb-2">Operations</h2>
        <p className="mb-3 text-sm font-normal text-black">Day close and expenses already exist as working screens.</p>
        <nav aria-label="Operations" className="grid gap-2 md:grid-cols-2">
          <SettingsNavCard
            href="/sales"
            title="Business day"
            description="Close today’s operating period from Sales."
            action="Open"
            Icon={CalendarDays}
          />
          <SettingsNavCard
            href="/expenses"
            title="Expenses"
            description="Record restaurant expenses used in daily close totals."
            action="Open"
            Icon={CircleDollarSign}
          />
        </nav>
        <div className="mt-2">
          <InfoPanel title="Payments">
            POS settlement already accepts Cash, Card, and Mobile money. Which methods are offered is not configurable here yet.
          </InfoPanel>
        </div>
      </section>

      <section>
        <h2 className="bz-section-title mb-2 border-b border-black pb-2">Security</h2>
        <nav aria-label="Security" className="grid gap-2 md:grid-cols-2">
          <SettingsNavCard
            href="/audit"
            title="Audit logs"
            description="Review important administrative and system activity."
            action="View"
            Icon={ScrollText}
          />
          <SettingsNavCard
            href="/account"
            title="Sign-in PIN"
            description="Change the PIN used to sign in to this account."
            action="Open"
            Icon={KeyRound}
          />
        </nav>
      </section>
    </div>
  );
}
