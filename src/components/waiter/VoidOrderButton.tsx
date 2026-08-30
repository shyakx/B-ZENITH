"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { voidOwnOrderAction } from "@/actions/orders";
import { Button } from "@/components/ui/Button";

export function VoidOrderButton({
  orderId,
  orderNumber,
  tableName,
}: {
  orderId: string;
  orderNumber: number;
  tableName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmVoid() {
    setBusy(true);
    setError("");
    const result = await voidOwnOrderAction(orderId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="min-w-0">
      <Button variant="ghost" className="text-zenith-danger" onClick={() => setOpen(true)}>
        Void order
      </Button>
      {error && !open ? <p className="mt-1 text-sm text-zenith-danger">{error}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby={`void-title-${orderId}`}
            className="w-full min-w-0 max-w-md rounded-3xl border border-zenith-border bg-white p-5"
          >
            <h2 id={`void-title-${orderId}`} className="font-display text-2xl text-zenith-gold">
              Void this order?
            </h2>
            <p className="mt-2 font-semibold">
              Order #{orderNumber} · Table {tableName}
            </p>
            <p className="mt-3 text-sm text-zenith-muted">
              This will cancel the entire order and return tracked stock. You can submit a new order
              afterward.
            </p>
            {error ? <p className="mt-3 text-sm text-zenith-danger">{error}</p> : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" className="w-full" disabled={busy} onClick={() => setOpen(false)}>
                Keep order
              </Button>
              <Button variant="danger" className="w-full" disabled={busy} onClick={confirmVoid}>
                {busy ? "Voiding…" : "Void order"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
