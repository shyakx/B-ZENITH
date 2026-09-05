"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { purgeMaisonAction, purgeSalesAction } from "@/actions/admin-purge";
import { formatRwf } from "@/lib/domain/money";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { PaymentBadge } from "@/components/ui/Badge";
import type { PaymentStatus } from "@prisma/client";

type DayOrder = {
  id: string;
  orderNumber: number;
  status: string;
  paymentStatus: PaymentStatus;
  total: number;
  paidAmount: number;
  tableName: string;
  waiterName: string;
};

export function DataControlForm({
  date,
  orders,
  maisonCount,
}: {
  date: string;
  orders: DayOrder[];
  maisonCount: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() => orders.map((order) => order.id));
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selected.includes(order.id)),
    [orders, selected],
  );
  const selectedTotal = selectedOrders.reduce((sum, order) => sum + order.total, 0);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function deleteSales(ids: string[]) {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await purgeSalesAction({ orderIds: ids, confirm });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirm("");
    setSelected([]);
    setMessage(`Deleted ${result.data.count} order(s). Stock for those sales was put back.`);
    router.refresh();
  }

  async function deleteMaison() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await purgeMaisonAction({ confirm });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirm("");
    setMessage(`Deleted ${result.data.count} Maison stay(s).`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field label="Rwanda date">
          <Input type="date" name="date" defaultValue={date} />
        </Field>
        <Button type="submit" variant="secondary">
          Show sales
        </Button>
      </form>

      <p className="text-sm">
        {orders.length} order(s) on this date. Selected {selectedOrders.length} · {formatRwf(selectedTotal)}.
      </p>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-zenith-border bg-white px-4 py-6 font-semibold">
          No sales on this date.
        </p>
      ) : (
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSelected(selected.length === orders.length ? [] : orders.map((order) => order.id))}
          >
            {selected.length === orders.length ? "Clear selection" : "Select all"}
          </Button>
          {orders.map((order) => (
            <label
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zenith-border bg-white p-3"
            >
              <span className="flex min-w-0 items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(order.id)}
                  onChange={() => toggle(order.id)}
                />
                <span className="min-w-0">
                  <span className="block font-semibold">
                    #{order.orderNumber} · Table {order.tableName}
                  </span>
                  <span className="block text-sm">
                    {order.waiterName} · {formatRwf(order.total)} · paid {formatRwf(order.paidAmount)}
                  </span>
                </span>
              </span>
              <PaymentBadge status={order.paymentStatus} />
            </label>
          ))}
        </div>
      )}

      <div className="rounded-2xl border-2 border-zenith-gold bg-white p-4">
        <h2 className="font-semibold text-zenith-gold">Confirm delete</h2>
        <p className="mt-1 text-sm">
          This permanently removes the selected test sales, their payments, and credit. Tracked stock is put
          back. Type <strong>DELETE</strong> to continue.
        </p>
        <div className="mt-3 max-w-xs">
          <Field label="Type DELETE">
            <Input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
          </Field>
        </div>
        {error ? <p className="mt-2 text-sm font-semibold text-zenith-danger">{error}</p> : null}
        {message ? <p className="mt-2 text-sm font-semibold text-zenith-success">{message}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="danger"
            disabled={busy || selected.length === 0}
            onClick={() => deleteSales(selected)}
          >
            {busy ? "Deleting…" : `Delete selected sales (${selected.length})`}
          </Button>
          <Button
            variant="danger"
            disabled={busy || orders.length === 0}
            onClick={() => deleteSales(orders.map((order) => order.id))}
          >
            Delete all sales on this date
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-zenith-border bg-white p-4">
        <h2 className="font-semibold">Maison de Passage</h2>
        <p className="mt-1 text-sm">{maisonCount} stay record(s) in the book.</p>
        <Button className="mt-3" variant="danger" disabled={busy || maisonCount === 0} onClick={deleteMaison}>
          Delete all Maison stays
        </Button>
      </div>
    </div>
  );
}
