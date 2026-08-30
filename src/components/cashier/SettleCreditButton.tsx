"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { settleCreditAction } from "@/actions/payments";
import { formatRwf } from "@/lib/domain/money";
import { Button } from "@/components/ui/Button";

export function SettleCreditButton({
  creditId,
  amountOwed,
  customerName,
}: {
  creditId: string;
  amountOwed: number;
  customerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [key] = useState(() => crypto.randomUUID());

  async function settle() {
    setBusy(true);
    setError("");
    const result = await settleCreditAction({
      creditId,
      idempotencyKey: key,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setConfirming(false);
    router.refresh();
  }

  if (success) {
    return (
      <div className="rounded-2xl border-2 border-zenith-gold bg-zenith-raised p-4 text-right">
        <p className="text-xs font-semibold uppercase tracking-wider text-zenith-gold">Payment recorded</p>
        <p className="mt-1 font-display text-2xl text-zenith-gold">{formatRwf(amountOwed)}</p>
        <p className="text-sm font-semibold">{customerName}</p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="space-y-3 text-right">
        <p className="font-semibold">Receive {formatRwf(amountOwed)} cash from {customerName}?</p>
        {error ? <p className="text-sm font-semibold text-zenith-danger">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={settle}>
            {busy ? "Recording…" : "Confirm payment"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button className="h-14 min-w-36" disabled={busy} onClick={() => setConfirming(true)}>
        Settle
      </Button>
      {error ? <p className="mt-2 text-sm font-semibold text-zenith-danger">{error}</p> : null}
    </div>
  );
}
