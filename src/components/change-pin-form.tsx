"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { changeOwnPin } from "@/actions/pin";
import { homePath } from "@/lib/permissions";

export function ChangePinForm({
  userId,
  role,
  requireCurrent = false,
}: {
  userId: string;
  role: string;
  requireCurrent?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await changeOwnPin(formData);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    const pin = String(formData.get("pin") ?? "");
    await signIn("credentials", { userId, pin, redirect: false });
    const session = await getSession();
    router.push(session?.user ? homePath(session.user.role || role) : "/");
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-4">
      {requireCurrent && (
        <label className="block text-sm font-bold">
          Current PIN
          <input
            name="currentPin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            pattern="\d{4}"
            required
            className="mt-1 min-h-12 w-full rounded-md border px-3 font-normal"
          />
        </label>
      )}
      <label className="block text-sm font-bold">
        New 4-digit PIN
        <input
          name="pin"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          pattern="\d{4}"
          required
          className="mt-1 min-h-12 w-full rounded-md border px-3 font-normal"
        />
      </label>
      <label className="block text-sm font-bold">
        Confirm new PIN
        <input
          name="confirmPin"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          pattern="\d{4}"
          required
          className="mt-1 min-h-12 w-full rounded-md border px-3 font-normal"
        />
      </label>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-md bg-black font-bold text-[#d4af37] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save PIN"}
      </button>
    </form>
  );
}
