"use client";

import { useState, type FormEvent } from "react";
import { saveSettingsAction } from "@/actions/settings";
import type { BusinessSettings } from "@/lib/settings";
import { Button } from "@/components/ui/Button";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { parseReceiptPaperMm } from "@/lib/settings";

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function action(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setSaved(false);
    try {
      const result = await saveSettingsAction({
        businessName: String(formData.get("businessName") ?? ""),
        address: String(formData.get("address") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        tin: String(formData.get("tin") ?? ""),
        receiptFooter: String(formData.get("receiptFooter") ?? ""),
        receiptPaperMm: parseReceiptPaperMm(String(formData.get("receiptPaperMm") ?? "")),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError("");
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={action} className="grid gap-5">
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
        <Field label="Receipt paper">
          <Select name="receiptPaperMm" defaultValue={settings.receiptPaperMm}>
            <option value="80">80mm bill roll (XP-80C)</option>
            <option value="58">58mm small roll</option>
          </Select>
        </Field>
        <p className="mt-2 text-sm">
          This is the bill width the printer should use. In the print window choose that paper and 100%
          scale. Do not pick A4 or Fit to page.
        </p>
      </div>
      <div>
        <Field label="Receipt footer">
          <Textarea name="receiptFooter" defaultValue={settings.receiptFooter} rows={3} />
        </Field>
        <p className="mt-2 text-sm">This message appears at the bottom of the facture.</p>
      </div>
      <ActionFeedback
        busy={busy}
        busyMessage="Saving settings…"
        message={saved ? "Settings saved successfully." : ""}
        error={error}
        onDismissError={() => setError("")}
      />
      <Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
    </form>
  );
}
