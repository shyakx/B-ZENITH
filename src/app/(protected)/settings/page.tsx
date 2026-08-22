import { updateSettings } from "@/actions/settings";
import { requireUser } from "@/lib/authorization";
import { userAdminRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  await requireUser(userAdminRoles);
  const settings = await prisma.businessSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const inputClass = "mt-1 min-h-11 w-full rounded-md border border-stone-300 px-3 font-normal outline-none focus:border-[#b38f20]";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Configuration</p>
        <h1 className="text-3xl font-black">Business settings</h1>
      </div>
      <form action={updateSettings} className="space-y-4 rounded-lg border bg-white p-5">
        <label className="block text-sm font-bold">Business name<input required name="businessName" defaultValue={settings.businessName} className={inputClass} /></label>
        <label className="block text-sm font-bold">Phone<input name="phone" defaultValue={settings.phone ?? ""} className={inputClass} /></label>
        <label className="block text-sm font-bold">Email<input name="email" type="email" defaultValue={settings.email ?? ""} className={inputClass} /></label>
        <label className="block text-sm font-bold">Address<textarea name="address" rows={2} defaultValue={settings.address ?? ""} className="mt-1 w-full rounded-md border border-stone-300 p-3 font-normal outline-none focus:border-[#b38f20]" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">Currency<input readOnly value={settings.currency} className={`${inputClass} bg-stone-50`} /></label>
          <label className="block text-sm font-bold">Timezone<input readOnly value={settings.timezone} className={`${inputClass} bg-stone-50`} /></label>
        </div>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="taxEnabled" defaultChecked={settings.taxEnabled} />
          Charge VAT / tax on sales
        </label>
        <label className="block text-sm font-bold">Tax rate (%)
          <input name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.taxRate.toFixed(2)} className={inputClass} />
        </label>
        <p className="text-sm text-stone-500">Leave tax disabled until the correct B-ZENITH rate is confirmed. Do not guess a rate.</p>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="lowStockEnabled" defaultChecked={settings.lowStockEnabled} />
          Show low-stock warnings
        </label>
        <label className="block text-sm font-bold">Default low-stock level
          <input name="defaultReorderLevel" type="number" min="0" defaultValue={settings.defaultReorderLevel} className={inputClass} />
        </label>
        <label className="block text-sm font-bold">Receipt footer<textarea required name="receiptFooter" rows={3} defaultValue={settings.receiptFooter} className="mt-1 w-full rounded-md border border-stone-300 p-3 font-normal outline-none focus:border-[#b38f20]" /></label>
        <p className="text-sm text-stone-500">Receipts also print “Powered by Cloud Sync Company”. Dates use Africa/Kigali.</p>
        <button className="min-h-12 w-full rounded-md bg-black font-bold text-[#d4af37]">Save settings</button>
      </form>
    </div>
  );
}
