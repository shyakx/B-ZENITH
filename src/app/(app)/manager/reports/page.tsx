import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/roles";
import { PaymentMethod } from "@prisma/client";
import { formatDateTime } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { currentOutstandingAmount } from "@/lib/manager-dashboard";
import { formatStockQty } from "@/lib/domain/units";
import { OrderBadge, PaymentBadge } from "@/components/ui/Badge";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { VisibleDateRange } from "@/components/ui/VisibleDate";
import { listStock, valuationFromStock } from "@/services/inventory";
import { listOrders, payableOutstandingBalance } from "@/services/orders";
import { listOutstanding, listPayments, unsettledCreditTotal } from "@/services/payments";
import { salesSummary } from "@/services/reports";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, type SearchParams } from "@/lib/list-filters";
import { listCategories, listProductOptions, listTables } from "@/services/products";
import { listUsers } from "@/services/users";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole("MANAGER");
  const params = await searchParams;
  const { from, to, fromValue, toValue } = dateRange(params);
  const waiterId = singleParam(params, "waiterId");
  const cashierId = singleParam(params, "cashierId");
  const tableId = singleParam(params, "tableId");
  const productId = singleParam(params, "productId");
  const categoryId = singleParam(params, "categoryId");
  const method = Object.values(PaymentMethod).find((value) => value === singleParam(params, "method"));
  const search = singleParam(params, "q");
  const filter = { waiterId, cashierId, tableId, productId, categoryId, method };
  const [summary, outstandingCredits, payableDue, creditDue, stock, orders, payments, users, tables, categories, products] =
    await Promise.all([
      salesSummary(from, to, filter),
      listOutstanding(),
      payableOutstandingBalance(),
      unsettledCreditTotal(),
      listStock(),
      listOrders({ from, to, take: 40, waiterId, tableId, search, productId, categoryId }),
      listPayments(from, to, { cashierId, waiterId, tableId, method, search }),
      listUsers(),
      listTables(),
      listCategories(),
      listProductOptions(),
    ]);
  const fields: ListFilterField[] = [
    { name: "from", label: "From", type: "date", value: fromValue },
    { name: "to", label: "To", type: "date", value: toValue },
    { name: "q", label: "Order/payment search", type: "search", value: search, placeholder: "Order, waiter, or table" },
    {
      name: "waiterId",
      label: "Waiter",
      type: "select",
      value: waiterId,
      options: [{ value: "", label: "All waiters" }, ...users.filter((entry) => entry.role === "WAITER").map((entry) => ({ value: entry.id, label: entry.name }))],
    },
    {
      name: "cashierId",
      label: "Cashier",
      type: "select",
      value: cashierId,
      options: [{ value: "", label: "All cashiers" }, ...users.filter((entry) => entry.role === "CASHIER").map((entry) => ({ value: entry.id, label: entry.name }))],
    },
    {
      name: "tableId",
      label: "Table",
      type: "select",
      value: tableId,
      options: [{ value: "", label: "All tables" }, ...tables.map((entry) => ({ value: entry.id, label: entry.name }))],
    },
    {
      name: "method",
      label: "Payment method",
      type: "select",
      value: method ?? "",
      options: [{ value: "", label: "All methods" }, ...Object.values(PaymentMethod).map((value) => ({ value, label: value.replaceAll("_", " ") }))],
    },
    {
      name: "categoryId",
      label: "Product category",
      type: "select",
      value: categoryId,
      options: [{ value: "", label: "All categories" }, ...categories.map((entry) => ({ value: entry.id, label: entry.name }))],
    },
    {
      name: "productId",
      label: "Product",
      type: "select",
      value: productId,
      options: [{ value: "", label: "All products" }, ...products.map((entry) => ({ value: entry.id, label: entry.name }))],
    },
  ];
  const valuation = valuationFromStock(stock);
  const outstanding = currentOutstandingAmount([{ total: payableDue, paidAmount: 0 }], [
    { amountOwed: creditDue },
  ]);
  const canViewAudit = hasPermission(user.role, "viewAudit");

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <PageHeader
        title="Reports & history"
        subtitle="Sales, payments, and stock for the selected dates."
      />
      <div className="mb-4">
        <VisibleDateRange from={from} to={to} />
      </div>

      <nav className="mb-6 flex flex-wrap gap-2 text-sm font-semibold">
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/orders">
          All orders
        </Link>
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/inventory/movements">
          Stock history
        </Link>
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/inventory/history">
          Purchase receipts
        </Link>
        {canViewAudit ? (
          <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/admin/audit">
            Staff audit log
          </Link>
        ) : null}
      </nav>

      <ListFilterForm fields={fields} action="/manager/reports" />
      <p className="-mt-3 mb-5 text-xs text-zenith-muted">
        Filters affect matching sales and payment sections; current outstanding balances and stock value remain all-time figures.
      </p>

      <div className="mb-6 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales (orders created)" value={formatRwf(summary.orderTotal)} hint={`${summary.orderCount} orders`} />
        <StatCard label="Payments received" value={formatRwf(summary.collected)} />
        <StatCard
          label="Fully paid sales"
          value={formatRwf(summary.paidSales)}
          hint="Orders created in this period that were fully paid"
        />
        <StatCard
          label="All unpaid now"
          value={formatRwf(outstanding)}
          hint="Current unpaid balances across all dates"
        />
      </div>

      <div className="mb-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-xl">Orders in range</h2>
            <span className="text-xs text-zenith-muted">{orders.length} shown</span>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-zenith-muted">No orders in this range.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/manager/orders/${order.id}`}
                  className="block rounded-lg border border-zenith-border/80 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        #{order.orderNumber} · Table {order.table.name}
                      </div>
                      <div className="text-zenith-muted">
                        {order.waiter.name} · {formatDateTime(order.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <OrderBadge status={order.status} />
                      <PaymentBadge status={order.paymentStatus} />
                    </div>
                  </div>
                  <div className="mt-1 font-semibold">{formatRwf(order.total)}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-xl">Payments in range</h2>
            <span className="text-xs text-zenith-muted">{payments.length} shown</span>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-zenith-muted">No payments in this range.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => (
                <div key={payment.id} className="rounded-lg border border-zenith-border/80 px-3 py-2 text-sm">
                  <div className="font-semibold">
                    {formatRwf(payment.amount)} · #{payment.order.orderNumber} · Table {payment.order.table.name}
                  </div>
                  <div className="text-zenith-muted">
                    {payment.cashier.name} · {payment.order.waiter.name} · {formatDateTime(payment.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
          <h2 className="mb-3 font-display text-xl">Product sales</h2>
          {summary.products.slice(0, 15).map((product) => (
            <div key={product.name} className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {product.name} × {product.quantity}
              </span>
              <span className="font-semibold">{formatRwf(product.total)}</span>
            </div>
          ))}
          {summary.products.length === 0 ? <p className="text-sm text-zenith-muted">None.</p> : null}
        </section>
        <section className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
          <h2 className="mb-3 font-display text-xl">Waiters</h2>
          {summary.waiters.map((waiter) => (
            <div key={waiter.name} className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {waiter.name} · {waiter.orders} orders
              </span>
              <span className="font-semibold">{formatRwf(waiter.total)}</span>
            </div>
          ))}
          {summary.waiters.length === 0 ? <p className="text-sm text-zenith-muted">None.</p> : null}
        </section>
        <section className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
          <h2 className="mb-3 font-display text-xl">Payments by cashier</h2>
          {summary.cashiers.map((cashier) => (
            <div key={cashier.name} className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {cashier.name} · {cashier.payments} payments
              </span>
              <span className="font-semibold">{formatRwf(cashier.total)}</span>
            </div>
          ))}
          {summary.cashiers.length === 0 ? <p className="text-sm text-zenith-muted">No payments in this date range.</p> : null}
        </section>
        <section className="min-w-0 rounded-xl border border-zenith-border bg-white p-4">
          <h2 className="mb-3 font-display text-xl">Customer credit</h2>
          {outstandingCredits.map((credit) => (
            <div key={credit.id} className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {credit.customerName} · Order #{credit.order.orderNumber}
              </span>
              <span className="font-semibold">{formatRwf(credit.amountOwed)}</span>
            </div>
          ))}
          {outstandingCredits.length === 0 ? <p className="text-sm text-zenith-muted">None.</p> : null}
        </section>
        <section className="min-w-0 rounded-xl border border-zenith-border bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-xl">Inventory value</h2>
            <Link href="/manager/inventory/movements" className="text-sm font-semibold text-zenith-gold">
              Full stock history →
            </Link>
          </div>
          <div className="mb-4 grid max-w-md gap-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4"><span>Main</span><span>{formatRwf(valuation.byLocation.MAIN)}</span></div>
            <div className="flex justify-between gap-4"><span>Bar</span><span>{formatRwf(valuation.byLocation.BAR)}</span></div>
            <div className="flex justify-between gap-4"><span>Kitchen</span><span>{formatRwf(valuation.byLocation.KITCHEN)}</span></div>
            <div className="flex justify-between gap-4"><span>Cafe</span><span>{formatRwf(valuation.byLocation.CAFE)}</span></div>
            <div className="flex justify-between gap-4 font-semibold sm:col-span-2">
              <span>Total</span>
              <span>{formatRwf(valuation.total)}</span>
            </div>
          </div>
          <div className="text-sm">
            {stock.slice(0, 12).map((product) => {
              const unit = product.baseUnit?.code ?? null;
              return (
                <div key={product.id} className="mb-1 flex flex-wrap justify-between gap-2">
                  <span>
                    {product.name}
                    {unit ? <span className="text-zenith-muted"> · {unit}</span> : null}
                  </span>
                  <span>
                    M {formatStockQty(product.main, unit)} · B {formatStockQty(product.bar, unit)} · K{" "}
                    {formatStockQty(product.kitchen, unit)} · C {formatStockQty(product.cafe, unit)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
