"use client";

import { useState } from "react";
import { saveSettingsAction } from "@/actions/settings";
import type { BusinessSettings } from "@/lib/settings";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function action(formData: FormData) {
    setBusy(true);
    setSaved(false);
    const result = await saveSettingsAction({
      businessName: String(formData.get("businessName") ?? ""),
      address: String(formData.get("address") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      tin: String(formData.get("tin") ?? ""),
      receiptFooter: String(formData.get("receiptFooter") ?? ""),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setError("");
    setSaved(true);
  }

  return (
    <form action={action} className="grid gap-5">
      <div>
        <Field label="Business name">
          <Input name="businessName" defaultValue={settings.businessName} />
        </Field>
        <p className="mt-2 text-sm">This name appears on the B-ZENITH facture.</p>
      </div>
      <div>
        <Field label="Address">
          <Input name="address" defaultValue={settings.address} />
        </Field>
        <p className="mt-2 text-sm">This address appears on the facture.</p>
      </div>
      <div>
        <Field label="Phone">
          <Input name="phone" defaultValue={settings.phone} />
        </Field>
        <p className="mt-2 text-sm">This phone number appears on the facture.</p>
      </div>
      <div>
        <Field label="TIN">
          <Input name="tin" defaultValue={settings.tin} />
        </Field>
        <p className="mt-2 text-sm">This tax identification number appears on the facture.</p>
      </div>
      <div>
        <Field label="Receipt footer">
          <Textarea name="receiptFooter" defaultValue={settings.receiptFooter} rows={3} />
        </Field>
        <p className="mt-2 text-sm">This message appears at the bottom of the facture.</p>
      </div>
      {error ? <p className="text-sm font-semibold text-zenith-danger">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-zenith-success">Settings saved.</p> : null}
      <Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
    </form>
  );
}
