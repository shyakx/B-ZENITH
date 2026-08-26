"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProduct } from "@/actions/catalog";

export function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm(`Delete ${name}? It will be removed from the menu and POS.`)) return;
    setPending(true);
    setError("");
    const result = await deleteProduct(productId);
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push("/menu");
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      {error ? (
        <p role="alert" className="rounded-md bg-black p-3 text-sm font-semibold text-white">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="bz-btn-secondary w-full disabled:border-2 disabled:border-dashed"
      >
        {pending ?"Deleting…" :"Delete product"}
      </button>
    </div>
  );
}
