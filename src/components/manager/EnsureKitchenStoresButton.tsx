"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ensureKitchenStoresAction } from "@/actions/catalog";
import { Button } from "@/components/ui/Button";
import { ActionFeedback } from "@/components/ui/ActionFeedback";

export function EnsureKitchenStoresButton({ missing }: { missing: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (missing <= 0) return null;

  async function addStores() {
    if (
      !window.confirm(
        `Add ${missing} kitchen store item${missing === 1 ? "" : "s"} to inventory? Existing stock will not change.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await ensureKitchenStoresAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Kitchen stores added successfully.");
      router.refresh();
    } catch {
      setError("Could not add kitchen stores. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zenith-gold bg-zenith-raised p-3">
      <p className="text-sm">
        Add kitchen stores so chicken, rice, charcoal and other recipe items can be received and moved to Kitchen.
      </p>
      <p className="mt-1 text-sm text-zenith-muted">{missing} kitchen items are not in inventory yet.</p>
      <ActionFeedback
        busy={busy}
        busyMessage="Adding kitchen stores…"
        message={message}
        error={error}
        onDismissError={() => setError("")}
      />
      <Button className="mt-3" type="button" disabled={busy} onClick={addStores}>
        {busy ? "Adding…" : "Add kitchen stores"}
      </Button>
    </div>
  );
}
