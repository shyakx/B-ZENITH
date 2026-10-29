"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createMaisonAction, payMaisonAction } from "@/actions/maison";
import { Button } from "@/components/ui/Button";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { Field, Input, Textarea } from "@/components/ui/Input";

export function MaisonForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function action(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await createMaisonAction({
        customerName: String(formData.get("customerName") ?? ""),
        customerPhone: String(formData.get("customerPhone") ?? ""),
        reference: String(formData.get("reference") ?? ""),
        date: String(formData.get("date") ?? ""),
        amount: Number(formData.get("amount")),
        paidAmount: formData.get("paidAmount") ? Number(formData.get("paidAmount")) : 0,
        notes: String(formData.get("notes") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Maison record saved successfully.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={action} className="grid gap-3 md:grid-cols-2">
      <Field label="Customer name">
        <Input name="customerName" required />
      </Field>
      <Field label="Phone">
        <Input name="customerPhone" />
      </Field>
      <Field label="Reference">
        <Input name="reference" placeholder="Wedding party, bride, etc." />
      </Field>
      <Field label="Date">
        <Input name="date" type="date" required />
      </Field>
      <Field label="Amount (RWF)">
        <Input name="amount" type="number" min={1} required />
      </Field>
      <Field label="Paid now">
        <Input name="paidAmount" type="number" min={0} defaultValue={0} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Notes">
          <Textarea name="notes" rows={2} />
        </Field>
      </div>
      <ActionFeedback
        busy={busy}
        busyMessage="Saving Maison record…"
        message={message}
        error={error}
        onDismissError={() => setError("")}
      />
      <Button disabled={busy} className="md:col-span-2">
        {busy ? "Saving record…" : "Save record"}
      </Button>
    </form>
  );
}

export function MaisonPayButton({ id, remaining }: { id: string; remaining: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  async function action(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await payMaisonAction({
        id,
        amount: Number(new FormData(event.currentTarget).get("amount")),
        idempotencyKey,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIdempotencyKey(crypto.randomUUID());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (remaining <= 0) return null;

  return (
    <form onSubmit={action} className="flex flex-wrap gap-2">
      <Input name="amount" type="number" min={1} max={remaining} defaultValue={remaining} />
      <Button disabled={busy}>{busy ? "Paying…" : "Pay"}</Button>
      <ActionFeedback
        busy={busy}
        busyMessage="Recording Maison payment…"
        error={error}
        onDismissError={() => setError("")}
      />
    </form>
  );
}
