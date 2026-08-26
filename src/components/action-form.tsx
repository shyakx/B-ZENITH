"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type ActionResult = { error?: string } | void;

export function ActionForm({
  action,
  className,
  children,
  footer,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
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
    router.refresh();
  }

  return (
    <form action={submit} className={className}>
      {error ? (
        <p role="alert" className="rounded-md bg-black p-3 text-sm font-semibold text-white sm:col-span-2">
          {error}
        </p>
      ) : null}
      {children}
      {pending ? <p className="sr-only" aria-live="polite">Saving…</p> : null}
      {footer}
    </form>
  );
}
