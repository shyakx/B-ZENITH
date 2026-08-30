"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrderAction } from "@/actions/orders";
import { Button } from "@/components/ui/Button";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    if (!confirm("Cancel this unpaid order?")) return;
    setBusy(true);
    const result = await cancelOrderAction(orderId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <Button variant="ghost" disabled={busy} onClick={cancel}>
        Cancel order
      </Button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
