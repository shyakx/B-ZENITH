import { formatRwfAmount } from "@/lib/domain/money";
import { formatPaymentDate, formatPaymentTime } from "@/lib/domain/payment-history";
import { commandeStationLabel, type CommandeStation } from "@/lib/domain/commande-slip";
import type { BusinessSettings } from "@/lib/settings";
import type { OrderWithDetails } from "@/services/orders";

type SlipItem = OrderWithDetails["items"][number];

function receiptWhen(date: Date | string) {
  return `${formatPaymentDate(date)} ${formatPaymentTime(date)}`;
}

export function PreFactureDocument({
  settings,
  orders,
  station,
  items,
}: {
  settings: BusinessSettings;
  orders: OrderWithDetails[];
  station?: CommandeStation;
  items?: SlipItem[];
}) {
  const lines = items ?? orders.flatMap((order) => order.items);
  const total = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  const waiters = [...new Set(orders.map((order) => order.waiter.name))].join(", ");
  const table = orders[0]?.table.name ?? "-";
  const title = station ? `Commande · ${commandeStationLabel(station)}` : "Commande";

  return (
    <div className="facture commande-slip">
      <header className="facture-header">
        <div className="facture-brand">{settings.businessName}</div>
        {settings.phone ? <div>Tel {settings.phone}</div> : null}
      </header>

      <div className="facture-rule" />

      <div className="facture-title">{title}</div>
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
        {station ? (
          <div>
            <span>Station</span>
            <strong>{commandeStationLabel(station)}</strong>
          </div>
        ) : null}
        <div>
          <span>Printed</span>
          <strong>{receiptWhen(new Date())}</strong>
        </div>
      </div>

      <div className="facture-rule" />

      <div className="facture-items">
        {lines.map((item) => (
          <div key={item.id} className="facture-item">
            <div className="facture-item-name">{item.name}</div>
            <div className="facture-item-row">
              <span>
                {item.quantity} × {formatRwfAmount(item.unitPrice)}
              </span>
              <span>{formatRwfAmount(item.lineTotal)}</span>
            </div>
          </div>
        ))}
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
