import { formatRwfAmount } from "@/lib/domain/money";
import { formatPaymentDate, formatPaymentTime } from "@/lib/domain/payment-history";
import type { BusinessSettings } from "@/lib/settings";
import type { OrderWithDetails } from "@/services/orders";

function receiptWhen(date: Date | string) {
  return `${formatPaymentDate(date)} ${formatPaymentTime(date)}`;
}

export function PreFactureDocument({
  settings,
  orders,
}: {
  settings: BusinessSettings;
  orders: OrderWithDetails[];
}) {
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  const waiters = [...new Set(orders.map((order) => order.waiter.name))].join(", ");
  const table = orders[0]?.table.name ?? "-";

  return (
    <div className="facture">
      <header className="facture-header">
        <div className="facture-brand">{settings.businessName}</div>
        {settings.phone ? <div>Tel {settings.phone}</div> : null}
      </header>

      <div className="facture-rule" />

      <div className="facture-title">Commande</div>
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
          <span>Printed</span>
          <strong>{receiptWhen(new Date())}</strong>
        </div>
      </div>

      <div className="facture-rule" />

      <div className="facture-items">
        {orders.flatMap((order) => [
          orders.length > 1 ? (
            <div key={`h-${order.id}`} className="facture-group">
              #{order.orderNumber} · {order.waiter.name}
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
        ])}
      </div>

      <div className="facture-rule" />

      <div className="facture-totals">
        <div className="facture-balance">
          <span>Total</span>
          <strong>{formatRwfAmount(total)} RWF</strong>
        </div>
      </div>
    </div>
  );
}
