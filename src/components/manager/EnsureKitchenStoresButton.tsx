"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ensureKitchenStoresAction } from "@/actions/catalog";
import { Button } from "@/components/ui/Button";

export function EnsureKitchenStoresButton({ missing }: { missing: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (missing <= 0) return null;

  async function addStores() {
    setBusy(true);
    const result = await ensureKitchenStoresAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-zenith-gold bg-zenith-raised p-3">
      <p className="text-sm">
        Add kitchen stores so chicken, rice, charcoal and other recipe items can be received and moved to Kitchen.
      </p>
      <p className="mt-1 text-sm text-zenith-muted">{missing} kitchen items are not in inventory yet.</p>
      {error ? <p className="mt-2 text-sm text-zenith-danger">{error}</p> : null}
      <Button className="mt-3" type="button" disabled={busy} onClick={addStores}>
        {busy ? "Adding…" : "Add kitchen stores"}
      </Button>
    </div>
  );
}
