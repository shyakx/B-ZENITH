"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTableAction } from "@/actions/catalog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function TableRenameForm({
  table,
}: {
  table: { id: string; name: string; active: boolean };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
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
    setError("");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="mt-3 flex min-w-0 flex-wrap gap-2">
      <Input name="name" defaultValue={table.name} required aria-label={`Rename ${table.name}`} />
      <Button variant="secondary" disabled={busy}>
        Rename
      </Button>
      {error ? <p className="w-full text-sm font-semibold text-zenith-danger">{error}</p> : null}
    </form>
  );
}
