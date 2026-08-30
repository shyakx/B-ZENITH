"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/current-user";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { saveBusinessSettings, type BusinessSettings } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

export async function saveSettingsAction(
  settings: BusinessSettings,
): Promise<ActionResult> {
  try {
    const user = await requirePermission("manageSettings");
    await saveBusinessSettings(settings);
    await writeAudit({
      userId: user.id,
      action: "SETTINGS_CHANGED",
      entity: "Setting",
      entityId: "business",
      after: settings,
    });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/audit");
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
