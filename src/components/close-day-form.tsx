"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { closeBusinessDay } from "@/actions/business-day";

export function CloseDayForm({ businessDay, alreadyClosed }: { businessDay: string; alreadyClosed: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onClose(formData: FormData) {
    if (
      !confirm(
        `Close and archive ${businessDay}? Dashboards will keep showing live sales for today. You can retrieve this day’s figures from Closed days.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError("");
    const result = await closeBusinessDay(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.refresh();
  }

  if (alreadyClosed) {
    return <p className="text-sm font-semibold text-black">{businessDay} is already closed and archived.</p>;
  }

  return (
    <form action={onClose} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="businessDay" value={businessDay} />
      <label className="text-sm font-bold">
        Note (optional)
        <input name="note" maxLength={200} placeholder="End of day" className="mt-1 block min-h-11 rounded-md border px-3 font-normal" />
      </label>
      <button disabled={pending} className="bz-btn-primary disabled:border-2 disabled:border-dashed">
        {pending ?"Closing…" :"Close this day"}
      </button>
      {error ? (
        <p role="alert" className="bz-alert w-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}
