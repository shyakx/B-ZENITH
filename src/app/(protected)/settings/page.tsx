import { updateSettings } from "@/actions/settings";
import { DashboardHeader } from "@/components/dashboard/ui";
import { requireUser } from "@/lib/authorization";
import { userAdminRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function SettingsPage() {
  await requireUser(userAdminRoles);
  const settings = await prisma.businessSettings.upsert({ where: { id:"default" }, update: {}, create: { id:"default" } });
  const inputClass ="mt-1 min-h-11 w-full rounded-md border border-black px-3 font-normal outline-none focus:border-[#FFD758]";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
        <DashboardHeader kicker="Management" title="Business settings" />
        <p className="text-sm text-black">
          <Link href="/audit" className="font-medium text-black hover:underline">Audit logs</Link>
          {""}are kept here for owners and admins.
        </p>
      <form action={updateSettings} className="space-y-4 rounded-lg border bg-white p-5">
        <label className="block text-sm font-bold">Business name<input required name="businessName" defaultValue={settings.businessName} className={inputClass} /></label>
        <label className="block text-sm font-bold">Phone<input name="phone" defaultValue={settings.phone ??""} className={inputClass} /></label>
        <label className="block text-sm font-bold">Email<input name="email" type="email" defaultValue={settings.email ??""} className={inputClass} /></label>
        <label className="block text-sm font-bold">Address<textarea name="address" rows={2} defaultValue={settings.address ??""} className="mt-1 w-full rounded-md border border-black p-3 font-normal outline-none focus:border-[#FFD758]" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">Currency<input readOnly value={settings.currency} className={`${inputClass} bg-white`} /></label>
          <label className="block text-sm font-bold">Timezone<input readOnly value={settings.timezone} className={`${inputClass} bg-white`} /></label>
        </div>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="taxEnabled" defaultChecked={settings.taxEnabled} />
          Charge VAT / tax on sales
        </label>
        <label className="block text-sm font-bold">Tax rate (%)
          <input name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.taxRate.toFixed(2)} className={inputClass} />
        </label>
        <p className="text-sm text-black">Leave tax disabled until the correct B-ZENITH rate is confirmed. Do not guess a rate.</p>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="lowStockEnabled" defaultChecked={settings.lowStockEnabled} />
          Show low-stock warnings
        </label>
        <label className="block text-sm font-bold">Default low-stock level
          <input name="defaultReorderLevel" type="number" min="0" defaultValue={settings.defaultReorderLevel} className={inputClass} />
        </label>
        <label className="block text-sm font-bold">Receipt footer<textarea required name="receiptFooter" rows={3} defaultValue={settings.receiptFooter} className="mt-1 w-full rounded-md border border-black p-3 font-normal outline-none focus:border-[#FFD758]" /></label>
        <p className="text-sm text-black">Receipts also print “Powered by Cloud Sync Company”. Dates use Africa/Kigali.</p>
        <button className="bz-btn-primary w-full">Save settings</button>
      </form>
    </div>
  );
}
