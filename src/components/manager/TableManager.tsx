"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveTableAction } from "@/actions/catalog";
import { Button } from "@/components/ui/Button";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { Input } from "@/components/ui/Input";

export function TableRenameForm({
  table,
}: {
  table: { id: string; name: string; active: boolean };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await saveTableAction({
      id: table.id,
      name: String(formData.get("name") ?? ""),
      active: table.active,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Table renamed successfully.");
    router.refresh();
  }

  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
      className="mt-3 flex min-w-0 flex-wrap gap-2"
    >
      <Input name="name" defaultValue={table.name} required aria-label={`Rename ${table.name}`} />
      <Button variant="secondary" disabled={busy}>
        Rename
      </Button>
      <ActionFeedback
        busy={busy}
        busyMessage="Renaming table…"
        message={message}
        error={error}
        onDismissError={() => setError("")}
      />
    </form>
  );
}
