import { requireRole } from "@/lib/auth/current-user";
import { getBusinessSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const settings = await getBusinessSettings();

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl">
      <h1 className="text-xl font-semibold text-zenith-gold">Settings</h1>
      <div className="mt-6">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
