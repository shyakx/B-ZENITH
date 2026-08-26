"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteBilliardDaySale, voidSale } from "@/actions/sales";

export function DeleteSaleButton({
  id,
  kind,
  label,
}: {
  id: string;
  kind:"pos" |"billiard";
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setPending(true);
    setError("");
    const result = kind ==="pos" ? await voidSale(id) : await deleteBilliardDaySale(id);
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-1">
      {error ? <p role="alert" className="bz-alert">{error}</p> : null}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="bz-btn-secondary inline-flex items-center disabled:border-2 disabled:border-dashed"
      >
        {pending ?"Deleting…" :"Delete"}
      </button>
    </div>
  );
}
