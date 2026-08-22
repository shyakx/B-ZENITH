"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteEmployee } from "@/actions/employees";

export function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm(`Delete ${name}? They will no longer be able to sign in.`)) return;
    setPending(true);
    setError("");
    const result = await deleteEmployee(userId);
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="sm:col-span-2 grid gap-2">
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="min-h-11 rounded-md border border-red-200 font-bold text-red-700 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete user"}
      </button>
    </div>
  );
}
