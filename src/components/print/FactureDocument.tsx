import { formatRwfAmount } from "@/lib/domain/money";
import { formatPaymentDate, formatPaymentTime, paymentHistoryRows } from "@/lib/domain/payment-history";
import type { BusinessSettings } from "@/lib/settings";
import type { OrderWithDetails } from "@/services/orders";

function receiptStatus(orders: OrderWithDetails[], total: number, paid: number) {
  if (paid >= total && total > 0) return "PAID";
  if (paid > 0) return "PARTIAL";
  if (orders[0]?.paymentStatus === "PAY_LATER") return "PAY LATER";
  return orders[0]?.paymentStatus ?? "UNPAID";
}

function receiptWhen(date: Date | string) {
  return `${formatPaymentDate(date)} ${formatPaymentTime(date)}`;
}

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
  const status = receiptStatus(orders, total, paid);

  return (
    <div className="facture">
      <header className="facture-header">
        <div className="facture-seal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="B-ZENITH" className="facture-logo" />
        </div>
        <div className="facture-brand">{settings.businessName}</div>
        {settings.address ? <div>{settings.address}</div> : null}
        {settings.phone ? <div>Tel {settings.phone}</div> : null}
        {settings.tin ? <div>TIN {settings.tin}</div> : null}
      </header>

      <div className="facture-rule" />

      <div className="facture-title">Facture / Bill</div>
      <div className="facture-meta">
        <div>
          <span>Table</span>
          <strong>{table}</strong>
        </div>
        <div>
          <span>Waiter</span>
          <strong>{waiters}</strong>
        </div>
        <div>
          <span>{orders.length === 1 ? "Order" : "Orders"}</span>
          <strong>
            {orders.length === 1 ? `#${orders[0].orderNumber}` : `${orders.length} open`}
          </strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span>Printed</span>
          <strong>{receiptWhen(new Date())}</strong>
        </div>
        {orders.length === 1 ? (
          <div>
            <span>Opened</span>
            <strong>{receiptWhen(orders[0].createdAt)}</strong>
          </div>
        ) : null}
      </div>

      <div className="facture-rule" />

      <div className="facture-items">
        {orders.flatMap((order) => [
          orders.length > 1 ? (
            <div key={`h-${order.id}`} className="facture-group">
              #{order.orderNumber} · {order.waiter.name} · {receiptWhen(order.createdAt)}
            </div>
          ) : null,
          ...order.items.map((item) => (
            <div key={item.id} className="facture-item">
              <div className="facture-item-name">{item.name}</div>
              <div className="facture-item-row">
                <span>
                  {item.quantity} × {formatRwfAmount(item.unitPrice)}
                </span>
                <span>{formatRwfAmount(item.lineTotal)}</span>
              </div>
            </div>
          )),
          orders.length > 1 ? (
            <div key={`t-${order.id}`} className="facture-group-total">
              Order {formatRwfAmount(order.total)} · Paid {formatRwfAmount(order.paidAmount)} ·
              Due {formatRwfAmount(order.total - order.paidAmount)}
            </div>
          ) : null,
        ])}
      </div>

      <div className="facture-rule" />

      <div className="facture-totals">
        <div>
          <span>Total</span>
          <strong>{formatRwfAmount(total)} RWF</strong>
        </div>
        {history.length > 0 ? (
          <div className="facture-history">
            <div className="facture-history-title">Payments</div>
            {history.map((row) => (
              <div key={row.key} className="facture-item-row">
                <span>
                  {row.date} {row.time} {row.method}
                </span>
                <span>{formatRwfAmount(row.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div>
          <span>Paid</span>
          <strong>{formatRwfAmount(paid)} RWF</strong>
        </div>
        <div className="facture-balance">
          <span>Balance</span>
          <strong>{formatRwfAmount(total - paid)} RWF</strong>
        </div>
      </div>

      {settings.receiptFooter ? <p className="facture-footer">{settings.receiptFooter}</p> : null}

      <aside className="facture-credit" aria-label="Software credit">
        <div className="facture-credit-mark" aria-hidden="true">
          <span />
          <i>✦</i>
          <span />
        </div>
        <p className="facture-credit-kicker">Powered by</p>
        <p className="facture-credit-name">CLOUD SYNC Inc.</p>
        <p className="facture-credit-note">POS software</p>
        <p className="facture-credit-support">Support +250 782 194 138</p>
      </aside>
    </div>
  );
}
