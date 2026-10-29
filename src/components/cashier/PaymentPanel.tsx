"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markPayLaterAction, recordPaymentAction, recordTablePaymentAction } from "@/actions/payments";
import { formatRwf } from "@/lib/domain/money";
import { PrintFactureLink } from "@/components/print/PrintFactureLink";
import { Button } from "@/components/ui/Button";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
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
  const [busyAction, setBusyAction] = useState<"payment" | "payLater" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [payLaterSuccess, setPayLaterSuccess] = useState(false);
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
    setBusyAction("payment");
    setError("");
    let result: Awaited<ReturnType<typeof recordPaymentAction>> | Awaited<ReturnType<typeof recordTablePaymentAction>>;
    try {
      result =
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
    } catch {
      setBusy(false);
      setBusyAction(null);
      setError("Payment status could not be confirmed. Check the transaction status before retrying.");
      return;
    }
    setBusy(false);
    setBusyAction(null);

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
    setBusyAction("payLater");
    setError("");
    let result: Awaited<ReturnType<typeof markPayLaterAction>>;
    try {
      result = await markPayLaterAction({
        orderId: targetId,
        customerName,
        customerPhone,
      });
    } catch {
      setBusy(false);
      setBusyAction(null);
      setError("The pay-later status could not be confirmed. Please check the order before retrying.");
      return;
    }
    setBusy(false);
    setBusyAction(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPayLaterSuccess(true);
    router.refresh();
  }

  if (success) {
    return (
      <>
        <ActionFeedback
          busy={false}
          busyMessage="Recording payment…"
          message="Payment recorded successfully."
        />
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
        <PrintFactureLink
          href={mode === "table" ? `/print/table/${targetId}` : `/print/order/${targetId}`}
          label={mode === "table" ? "Print table facture" : "Print facture"}
          className="w-full"
        />
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
      </>
    );
  }

  if (remaining <= 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-zenith-success">This bill is paid.</p>
        <PrintFactureLink
          href={mode === "table" ? `/print/table/${targetId}` : `/print/order/${targetId}`}
          label={mode === "table" ? "Print table facture" : "Print facture"}
          className="w-full"
        />
      </div>
    );
  }

  if (payLaterSuccess) {
    return (
      <>
        <ActionFeedback
          busy={false}
          busyMessage="Saving pay-later details..."
          message="Pay-later transaction recorded successfully."
        />
        <div className="space-y-4 rounded-2xl border-2 border-zenith-gold bg-zenith-raised p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zenith-gold">Pay later recorded</p>
            <p className="mt-1 text-lg font-semibold">Table {tableName}</p>
            <p className="mt-1 text-sm text-zenith-muted">
              The balance remains in Customer credit until it is settled.
            </p>
          </div>
          <PrintFactureLink href={`/print/order/${targetId}`} label="Print facture" className="w-full" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" className="w-full" onClick={() => setPayLaterSuccess(false)}>
              Back to bill
            </Button>
            <Link
              href="/cashier/outstanding"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-zenith-gold px-4 py-2 text-sm font-semibold text-white hover:bg-zenith-gold-bright"
            >
              View customer credit
            </Link>
          </div>
        </div>
      </>
    );
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
        <ActionFeedback
          busy={busy}
          busyMessage="Recording payment…"
          error={error}
          onDismissError={() => setError("")}
        />
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold">Remaining balance: {formatRwf(remaining)} · Cash</p>
        <button
          type="button"
          className="font-semibold text-zenith-gold underline underline-offset-2"
          onClick={() => setAmount(String(remaining))}
        >
          Use full balance
        </button>
      </div>
      <ActionFeedback
        busy={busy}
        busyMessage={busyAction === "payLater" ? "Saving pay-later details..." : "Recording cash payment..."}
        error={error}
        onDismissError={() => setError("")}
      />
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
            {busyAction === "payLater" ? "Saving..." : "Mark pay later"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
