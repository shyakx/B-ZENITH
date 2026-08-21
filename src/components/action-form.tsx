"use client";

import { useState, type ReactNode } from "react";

type ActionResult = { error?: string } | void;

export function ActionForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  className?: string;
  children: ReactNode;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    setPending(false);
  }

  return (
    <form action={submit} className={className}>
      {children}
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700 sm:col-span-2">{error}</p> : null}
      {pending ? <p className="sr-only" aria-live="polite">Saving…</p> : null}
    </form>
  );
}
