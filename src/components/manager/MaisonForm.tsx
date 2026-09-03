"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMaisonAction, payMaisonAction } from "@/actions/maison";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

export function MaisonForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function action(formData: FormData) {
    const result = await createMaisonAction({
      customerName: String(formData.get("customerName") ?? ""),
      customerPhone: String(formData.get("customerPhone") ?? ""),
      reference: String(formData.get("reference") ?? ""),
      date: String(formData.get("date") ?? ""),
      amount: Number(formData.get("amount")),
      paidAmount: formData.get("paidAmount") ? Number(formData.get("paidAmount")) : 0,
      notes: String(formData.get("notes") ?? ""),
    });
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
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
      {error ? <p className="text-sm text-red-300 md:col-span-2">{error}</p> : null}
      <Button className="md:col-span-2">Save record</Button>
    </form>
  );
}

export function MaisonPayButton({ id, remaining }: { id: string; remaining: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  async function action(formData: FormData) {
    const result = await payMaisonAction({
      id,
      amount: Number(formData.get("amount")),
      idempotencyKey,
    });
    if (!result.ok) return setError(result.error);
    setError("");
    setIdempotencyKey(crypto.randomUUID());
    router.refresh();
  }

  if (remaining <= 0) return null;

  return (
    <form action={action} className="flex gap-2">
      <Input name="amount" type="number" min={1} max={remaining} defaultValue={remaining} />
      <Button>Pay</Button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </form>
  );
}
