"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markPayLaterAction, recordPaymentAction, recordTablePaymentAction } from "@/actions/payments";
import { formatRwf } from "@/lib/domain/money";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { PaymentBadge } from "@/components/ui/Badge";
import type { PaymentStatus } from "@prisma/client";

type Allocation = {
  orderNumber: number;
  amount: number;
  remaining: number;
  paymentStatus: string;
};

function parseAmount(value: string) {
  const amount = Number(value);
  return Number.isInteger(amount) ? amount : NaN;
}

export function PaymentPanel({
  mode,
  targetId,
  remaining,
  tableName,
  total,
  paid,
}: {
  mode: "order" | "table";
  targetId: string;
  remaining: number;
  tableName: string;
  total?: number;
  paid?: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [success, setSuccess] = useState<{
    amount: number;
    remaining: number;
    allocations?: Allocation[];
  } | null>(null);

  function validateAmount() {
    const value = parseAmount(amount);
    if (!Number.isInteger(value) || value <= 0) {
      return "Enter an amount greater than zero.";
    }
    if (value > remaining) {
      return "Payment cannot be greater than the remaining balance.";
    }
    return null;
  }

  function askConfirm() {
    const problem = validateAmount();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setConfirming(true);
  }

  async function confirmPay() {
    const value = parseAmount(amount);
    const problem = validateAmount();
    if (problem) {
      setError(problem);
      setConfirming(false);
      return;
    }

    setBusy(true);
    setError("");
    const result =
      mode === "order"
        ? await recordPaymentAction({
            orderId: targetId,
            amount: value,
            idempotencyKey: key,
          })
        : await recordTablePaymentAction({
            tableId: targetId,
            amount: value,
            idempotencyKey: key,
          });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirming(false);
    setSuccess({
      amount: result.data.amount,
      remaining: result.data.remaining,
      allocations: "allocations" in result.data ? result.data.allocations : undefined,
    });
    setKey(crypto.randomUUID());
    setAmount(result.data.remaining > 0 ? String(result.data.remaining) : "");
    router.refresh();
  }

  async function payLater() {
    if (mode !== "order") return;
    if (customerName.trim().length < 2) {
      setError("Customer name is required for pay later.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await markPayLaterAction({
      orderId: targetId,
      customerName,
      customerPhone,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (success) {
    return (
      <div className="space-y-4 rounded-2xl border-2 border-zenith-gold bg-zenith-raised p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zenith-gold">Payment recorded</p>
          <p className="mt-1 font-display text-3xl text-zenith-gold">{formatRwf(success.amount)}</p>
          <p className="mt-1 text-lg font-semibold">Table {tableName}</p>
          <p className="mt-1 text-base">Remaining: {formatRwf(success.remaining)}</p>
        </div>
        {success.allocations?.length ? (
          <ul className="space-y-2">
            {success.allocations.map((allocation) => (
              <li key={allocation.orderNumber} className="rounded-xl bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">#{allocation.orderNumber}</span>
                  <PaymentBadge status={allocation.paymentStatus as PaymentStatus} />
                </div>
                <div className="mt-1">
                  Paid: {formatRwf(allocation.amount)} · Remaining: {formatRwf(allocation.remaining)}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {success.remaining > 0 ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setSuccess(null);
              setConfirming(false);
            }}
          >
            Record another payment
          </Button>
        ) : null}
      </div>
    );
  }

  if (remaining <= 0) {
    return <p className="text-sm font-semibold text-zenith-success">This bill is paid.</p>;
  }

  if (confirming) {
    const value = parseAmount(amount);
    const nextRemaining = Number.isInteger(value) ? Math.max(0, remaining - value) : remaining;
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Confirm payment</p>
          <p className="mt-1 font-display text-2xl text-zenith-gold">TABLE {tableName}</p>
          <p className="mt-2 text-lg font-semibold">Amount received: {formatRwf(value)}</p>
          <p className="mt-1 text-base">New remaining balance: {formatRwf(nextRemaining)}</p>
        </div>
        {error ? <p className="text-sm font-semibold text-zenith-danger">{error}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={confirmPay}>
            {busy ? "Recording…" : "Confirm payment"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Amount received">
        <Input
          type="number"
          min={1}
          max={remaining}
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>
      <p className="text-sm font-semibold">Balance {formatRwf(remaining)} · Cash</p>
      {error ? <p className="text-sm font-semibold text-zenith-danger">{error}</p> : null}
      <Button className="h-14 w-full text-lg" disabled={busy} onClick={askConfirm}>
        {mode === "table" ? "Pay table" : "Record payment"}
      </Button>

      {mode === "order" ? (
        <div className="space-y-3 border-t border-zenith-border pt-4">
          <p className="text-sm font-semibold">Or mark pay later</p>
          {total != null && paid != null ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-semibold">{formatRwf(total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Already paid</span>
                <span className="font-semibold">{formatRwf(paid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount owed</span>
                <span className="font-semibold text-zenith-gold">{formatRwf(remaining)}</span>
              </div>
            </div>
          ) : null}
          <Field label="Customer name">
            <Input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              required
            />
          </Field>
          <Field label="Phone">
            <Input
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              inputMode="tel"
            />
          </Field>
          <Button variant="secondary" className="w-full" disabled={busy} onClick={payLater}>
            Pay later
          </Button>
        </div>
      ) : null}
    </div>
  );
}
