import { formatRwf } from "@/lib/domain/money";
import { formatDateTime } from "@/lib/dates";
import { paymentHistoryRows } from "@/lib/domain/payment-history";
import type { BusinessSettings } from "@/lib/settings";
import type { OrderWithDetails } from "@/services/orders";

export function FactureDocument({
  settings,
  orders,
}: {
  settings: BusinessSettings;
  orders: OrderWithDetails[];
}) {
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  const paid = orders.reduce((sum, order) => sum + order.paidAmount, 0);
  const history = paymentHistoryRows(orders.flatMap((order) => order.payments));
  const waiters = [...new Set(orders.map((order) => order.waiter.name))].join(", ");
  const table = orders[0]?.table.name ?? "-";
  const status =
    paid >= total && total > 0
      ? "PAID"
      : paid > 0
        ? "PARTIAL"
        : orders[0]?.paymentStatus === "PAY_LATER"
          ? "PAY LATER"
          : orders[0]?.paymentStatus;

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-black">
      <div className="mb-6 flex items-center gap-4 border-b border-black pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="B-ZENITH" width={72} height={72} />
        <div>
          <div className="font-serif text-3xl tracking-[0.16em]">{settings.businessName}</div>
          <div className="text-sm">{settings.address}</div>
          {settings.phone ? <div className="text-sm">{settings.phone}</div> : null}
          {settings.tin ? <div className="text-sm">TIN {settings.tin}</div> : null}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <div>Facture / Bill</div>
        <div className="text-right">Printed {formatDateTime(new Date())}</div>
        <div>Table {table}</div>
        <div className="text-right">Waiter(s): {waiters}</div>
        <div>
          {orders.length === 1
            ? `Order #${orders[0].orderNumber}`
            : `${orders.length} current orders`}
        </div>
        <div className="text-right">Status: {status}</div>
        {orders.length === 1 ? (
          <div className="col-span-2 font-semibold">
            {formatDateTime(orders[0].createdAt)}
          </div>
        ) : null}
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-2">Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.flatMap((order) => [
            orders.length > 1 ? (
              <tr key={`h-${order.id}`} className="font-semibold">
                <td colSpan={4} className="pt-3">
                  Order #{order.orderNumber} — {order.waiter.name} — {formatDateTime(order.createdAt)}
                </td>
              </tr>
            ) : null,
            ...order.items.map((item) => (
              <tr key={item.id}>
                <td className="py-1">{item.name}</td>
                <td>{item.quantity}</td>
                <td>{formatRwf(item.unitPrice)}</td>
                <td className="text-right">{formatRwf(item.lineTotal)}</td>
              </tr>
            )),
            orders.length > 1 ? (
              <tr key={`t-${order.id}`} className="text-xs">
                <td colSpan={4} className="pb-2 pt-1">
                  Order total {formatRwf(order.total)} · Paid {formatRwf(order.paidAmount)} ·
                  Balance {formatRwf(order.total - order.paidAmount)} ·{" "}
                  {order.paymentStatus === "PARTIALLY_PAID"
                    ? "PARTIAL"
                    : order.paymentStatus === "PAY_LATER"
                      ? "PAY LATER"
                      : order.paymentStatus}
                </td>
              </tr>
            ) : null,
          ])}
        </tbody>
      </table>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatRwf(total)}</span>
        </div>
      </div>

      {history.length > 0 ? (
        <table className="mb-3 mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-black text-left text-xs uppercase tracking-wider">
              <th className="py-1.5" colSpan={4}>
                Payment history
              </th>
            </tr>
            <tr className="border-b border-black text-left text-xs">
              <th className="py-1">Date</th>
              <th>Time</th>
              <th>Method</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.key}>
                <td className="py-1">{row.date}</td>
                <td>{row.time}</td>
                <td>{row.method}</td>
                <td className="text-right">{formatRwf(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Total paid</span>
          <span>{formatRwf(paid)}</span>
        </div>
        <div className="flex justify-between">
          <span>Balance</span>
          <span>{formatRwf(total - paid)}</span>
        </div>
      </div>

      <p className="mt-8 text-center text-sm">{settings.receiptFooter}</p>
    </div>
  );
}
