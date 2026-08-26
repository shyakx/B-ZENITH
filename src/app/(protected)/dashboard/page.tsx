import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { BilliardSalesForm } from "@/components/billiard-sales-form";
import { CreditRepaymentForm } from "@/components/credit-repayment-form";
import {
  ActivityList,
  AttentionList,
  DashboardHeader,
  KpiCard,
  KpiGrid,
  MetricRow,
  Panel,
  QuickAction,
  SectionHeader,
  StatusBadge,
} from "@/components/dashboard/ui";
import { LiveRefresh } from "@/components/live-refresh";
import { requireUser } from "@/lib/authorization";
import { businessRoles } from "@/lib/roles";
import { sumBilliardAmounts, billiardReceiptNumber } from "@/lib/billiard";
import { formatDateTime, formatMoney, kigaliDateString, paymentLabel, todayKigaliRange } from "@/lib/datetime";
import { loadHospitalityReport } from "@/lib/hospitality-reporting";
import { prisma } from "@/lib/prisma";
import { summarizeSales } from "@/lib/reporting";
import { CreditStatus, FulfillmentStatus, ItemStatus, SessionStatus } from "@prisma/client";

export const dynamic ="force-dynamic";

const AUDIT_ACTIONS = ["SALE_COMPLETED","CREATE_RETURN","CREATE_PURCHASE","INVENTORY_ADJUSTMENT","INVENTORY_WASTE","CLOSE_BUSINESS_DAY","SAVE_BILLIARD_DAY_SALE","HANDOVER","VOID","RETURN","EXCHANGE","CREATE_EXPENSE",
];

function countBy<T extends string>(rows: Array<{ key: T; count: number }>, key: T) {
  return rows.find((row) => row.key === key)?.count ?? 0;
}

export default async function DashboardPage() {
  const user = await requireUser(businessRoles);
  const { start, end } = todayKigaliRange();
  const today = kigaliDateString();
  const yesterdayStart = new Date(start.getTime() - 86_400_000);
  const todaySales = {
    status: { not:"VOIDED" as const },
    createdAt: { gte: start, lt: end },
  };
  const openCredit = { status: { in: [CreditStatus.OUTSTANDING, CreditStatus.PARTIALLY_PAID] } };
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000);

  const [
    sales,
    yesterdaySales,
    expenses,
    billiardRows,
    recent,
    recentBilliard,
    lowStock,
    settings,
    hospitality,
    tableCounts,
    sessionCounts,
    fulfillmentCounts,
    staleOrders,
    creditOutstanding,
    creditTop,
    creditPaidToday,
    creditPaymentsToday,
    lastClose,
    movements,
    auditRows,
    lifetimePos,
    lifetimeBilliard,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: todaySales,
      select: {
        createdAt: true,
        paymentMethod: true,
        subtotal: true,
        tax: true,
        discount: true,
        total: true,
        items: {
          select: { productName: true, quantity: true, returnedQuantity: true, lineSubtotal: true },
        },
      },
    }),
    prisma.sale.findMany({
      where: { status: { not:"VOIDED" }, createdAt: { gte: yesterdayStart, lt: start } },
      select: {
        createdAt: true,
        paymentMethod: true,
        subtotal: true,
        tax: true,
        discount: true,
        total: true,
        items: {
          select: { productName: true, quantity: true, returnedQuantity: true, lineSubtotal: true },
        },
      },
    }),
    prisma.expense.aggregate({
      where: { incurredAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.billiardDaySale.findMany({
      where: { businessDay: today },
      select: { amount: true, note: true, operatorId: true },
    }),
    prisma.sale.findMany({
      where: todaySales,
      take: 8,
      orderBy: { createdAt:"desc" },
      include: { cashier: { select: { name: true } } },
    }),
    prisma.billiardDaySale.findMany({
      where: { businessDay: today },
      take: 8,
      orderBy: { updatedAt:"desc" },
      include: { operator: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { active: true, trackInventory: true },
      orderBy: { stockQuantity:"asc" },
      take: 80,
      select: { id: true, name: true, stockQuantity: true, reorderLevel: true },
    }),
    prisma.businessSettings.findUnique({ where: { id:"default" } }),
    loadHospitalityReport(start, end),
    prisma.table.groupBy({ by: ["status"], where: { active: true }, _count: true }),
    prisma.serviceSession.groupBy({
      by: ["status","channel"],
      where: { status: { in: [SessionStatus.ACTIVE, SessionStatus.SETTLING] } },
      _count: true,
    }),
    prisma.sessionItem.groupBy({
      by: ["fulfillmentStatus"],
      where: {
        status: ItemStatus.ACTIVE,
        fulfillmentStatus: { in: [FulfillmentStatus.POSTED, FulfillmentStatus.PREPARING, FulfillmentStatus.READY] },
        round: { session: { status: { in: [SessionStatus.ACTIVE, SessionStatus.SETTLING] } } },
      },
      _count: true,
    }),
    prisma.sessionItem.count({
      where: {
        status: ItemStatus.ACTIVE,
        fulfillmentStatus: FulfillmentStatus.POSTED,
        createdAt: { lt: staleCutoff },
        round: { session: { status: { in: [SessionStatus.ACTIVE, SessionStatus.SETTLING] } } },
      },
    }),
    prisma.creditBill.aggregate({
      where: openCredit,
      _sum: { balance: true },
      _count: true,
    }),
    prisma.creditBill.findMany({
      where: openCredit,
      orderBy: { balance:"desc" },
      take: 8,
      select: { id: true, saleId: true, customerName: true, balance: true, status: true },
    }),
    prisma.creditBill.findMany({
      where: { status: CreditStatus.PAID, updatedAt: { gte: start, lt: end } },
      take: 6,
      orderBy: { updatedAt:"desc" },
      select: { id: true, customerName: true, total: true, updatedAt: true },
    }),
    prisma.creditPayment.aggregate({
      where: { timestamp: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.businessDayClose.findFirst({
      orderBy: { closedAt:"desc" },
      include: { closedBy: { select: { name: true } } },
    }),
    prisma.inventoryMovement.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt:"desc" },
      take: 8,
      select: {
        id: true,
        type: true,
        quantity: true,
        createdAt: true,
        product: { select: { name: true } },
        location: { select: { code: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: start, lt: end }, action: { in: AUDIT_ACTIONS } },
      orderBy: { createdAt:"desc" },
      take: 12,
      select: { id: true, action: true, entity: true, actorName: true, createdAt: true },
    }),
    prisma.sale.aggregate({
      where: { status: { not:"VOIDED" } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.billiardDaySale.aggregate({ _sum: { amount: true } }),
  ]);

  const currency = settings?.currency ??"RWF";
  const toReport = (rows: typeof sales) =>
    rows.map((sale) => ({
      createdAt: sale.createdAt,
      paymentMethod: sale.paymentMethod,
      subtotal: sale.subtotal.toNumber(),
      tax: sale.tax.toNumber(),
      discount: sale.discount.toNumber(),
      total: sale.total.toNumber(),
      items: sale.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        returnedQuantity: item.returnedQuantity,
        lineSubtotal: item.lineSubtotal.toNumber(),
      })),
    }));
  const posSummary = summarizeSales(toReport(sales));
  const yesterdaySummary = summarizeSales(toReport(yesterdaySales));
  const billiardToday = sumBilliardAmounts(billiardRows);
  const salesChange =
    yesterdaySummary.netTotal > 0
      ? Math.round(((posSummary.netTotal - yesterdaySummary.netTotal) / yesterdaySummary.netTotal) * 100)
      : null;
  const salesChangeLabel =
    salesChange === null ?"No yesterday baseline" : `${salesChange > 0 ?"+" :""}${salesChange}% vs yesterday`;
  const paymentAmount = (method: string) => hospitality.paymentTotals.get(method)?.amount ?? 0;
  const settledTotal = [...hospitality.paymentTotals.values()].reduce((sum, row) => sum + row.amount, 0);
  const occupied = countBy(tableCounts.map((row) => ({ key: row.status, count: row._count })),"OCCUPIED");
  const available = countBy(tableCounts.map((row) => ({ key: row.status, count: row._count })),"AVAILABLE");
  const outOfService = countBy(tableCounts.map((row) => ({ key: row.status, count: row._count })),"OUT_OF_SERVICE");
  const tableTotal = occupied + available + outOfService;
  const activeSessions = sessionCounts.filter((row) => row.status === SessionStatus.ACTIVE).reduce((sum, row) => sum + row._count, 0);
  const settlingSessions = sessionCounts.filter((row) => row.status === SessionStatus.SETTLING).reduce((sum, row) => sum + row._count, 0);
  const openSessions = activeSessions + settlingSessions;
  const channelCount = (channel: string, status?: SessionStatus) =>
    sessionCounts
      .filter((row) => row.channel === channel && (!status || row.status === status))
      .reduce((sum, row) => sum + row._count, 0);
  const tableSessions = channelCount("TABLE");
  const otherSessions = Math.max(0, openSessions - tableSessions);
  const fulfill = (status: FulfillmentStatus) =>
    fulfillmentCounts.find((row) => row.fulfillmentStatus === status)?._count ?? 0;
  const pendingOrders = fulfill(FulfillmentStatus.POSTED);
  const preparingOrders = fulfill(FulfillmentStatus.PREPARING);
  const readyOrders = fulfill(FulfillmentStatus.READY);
  const queueOrders = pendingOrders + preparingOrders + readyOrders;
  const threshold = settings?.defaultReorderLevel ?? 5;
  const lowStockItems =
    settings?.lowStockEnabled === false
      ? []
      : lowStock.filter((product) => product.stockQuantity > 0 && product.stockQuantity <= (product.reorderLevel || threshold));
  const outOfStockItems = lowStock.filter((product) => product.stockQuantity <= 0);
  const creditBalance = creditOutstanding._sum.balance?.toNumber() ?? 0;
  const myBilliard = billiardRows.find((row) => row.operatorId === user.id);
  const dayClosed = lastClose?.businessDay === today;
  const movementCount = hospitality.inventory.movements.reduce((sum, row) => sum + row.count, 0);
  const stockUnits = hospitality.inventory.locationStockSum;

  const attention = [
    ...(outOfStockItems.length
      ? [{ href:"/inventory", label: `${outOfStockItems.length} out of stock`, detail: outOfStockItems.slice(0, 3).map((p) => p.name).join(","), tone:"stop" as const }]
      : []),
    ...(lowStockItems.length
      ? [{ href:"/inventory", label: `${lowStockItems.length} products low in stock`, detail:"View stock", tone:"warn" as const }]
      : []),
    ...(pendingOrders
      ? [{ href:"/fulfillment/kitchen", label: `${pendingOrders} pending fulfillment`, detail:"Open fulfillment", tone:"warn" as const }]
      : []),
    ...(staleOrders
      ? [{ href:"/fulfillment/bar", label: `${staleOrders} orders waiting over 15 minutes`, detail:"Open fulfillment", tone:"warn" as const }]
      : []),
    ...(settlingSessions
      ? [{ href:"/pos", label: `${settlingSessions} awaiting settlement`, detail:"Open POS", tone:"warn" as const }]
      : []),
    ...(creditOutstanding._count
      ? [{ href:"/reports", label: `${creditOutstanding._count} outstanding credit`, detail: `${formatMoney(creditBalance, currency)} to review`, tone:"warn" as const }]
      : []),
  ];

  const activitySorted = [
    ...recent.map((sale) => ({
      at: sale.createdAt.getTime(),
      id: sale.id,
      href: `/sales/${sale.id}`,
      title: sale.receiptNumber,
      badge:"Sale",
      meta: `${sale.cashier.name} · ${formatDateTime(sale.createdAt)} · ${paymentLabel(sale.paymentMethod)}`,
      amount: formatMoney(sale.total.toNumber(), currency),
    })),
    ...recentBilliard.map((row) => ({
      at: row.updatedAt.getTime(),
      id: row.id,
      href:"/billiard",
      title: billiardReceiptNumber(row.businessDay),
      badge:"Billiard",
      meta: `${row.operator.name} · ${formatDateTime(row.updatedAt)}`,
      amount: formatMoney(row.amount.toNumber(), currency),
    })),
    ...movements.map((row) => ({
      at: row.createdAt.getTime(),
      id: row.id,
      href:"/inventory",
      title: row.product.name,
      badge: row.type.replaceAll("_",""),
      meta: `${row.location?.code ??"MAIN"} · ${formatDateTime(row.createdAt)}`,
      amount: `${row.quantity > 0 ?"+" :""}${row.quantity}`,
    })),
    ...auditRows.map((row) => ({
      at: row.createdAt.getTime(),
      id: row.id,
      href: row.action ==="HANDOVER" ?"/pos" : undefined,
      title: row.action.replaceAll("_",""),
      badge: row.entity,
      meta: `${row.actorName ??"Staff"} · ${formatDateTime(row.createdAt)}`,
      amount: undefined as string | undefined,
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8)
    .map(({ id, href, title, badge, meta, amount }) => ({ id, href, title, badge, meta, amount }));

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <DashboardHeader
        kicker="B-ZENITH"
        title="Operations Dashboard"
        subtitle="Real-time overview of today's restaurant operations."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <BrandLogo size={28} className="rounded-md" />
            <span>Business date {today}</span>
            <StatusBadge tone={dayClosed ?"info" :"ok"}>{dayClosed ?"Day closed" :"Open"}</StatusBadge>
          </div>
        }
        actions={
          <>
            <QuickAction href="/pos" primary>
              Open POS
            </QuickAction>
            <QuickAction href="/inventory">Stock</QuickAction>
            <QuickAction href="/fulfillment/bar">Queues</QuickAction>
            <QuickAction href="/reports">Reports</QuickAction>
          </>
        }
      />

      <KpiGrid>
        <KpiCard
          label="Sales"
          value={formatMoney(posSummary.netTotal, currency)}
          hint={salesChangeLabel}
          emphasis="ok"
        />
        <KpiCard
          label="Orders"
          value={String(posSummary.count)}
          hint={yesterdaySummary.count ? `${yesterdaySummary.count} yesterday` :"orders today"}
        />
        <KpiCard
          label="Stock alerts"
          value={String(outOfStockItems.length + lowStockItems.length)}
          hint={`${outOfStockItems.length} out · ${lowStockItems.length} low`}
          emphasis={outOfStockItems.length + lowStockItems.length > 0 ? "attention" : undefined}
        />
        <KpiCard
          label="Expenses"
          value={formatMoney(expenses._sum.amount?.toNumber() ?? 0, currency)}
          hint="today"
        />
        <KpiCard
          label="Attention"
          value={attention.length === 0 ?"All clear" : String(attention.length)}
          hint={attention.length === 0 ?"Nothing waiting" :"need attention"}
          emphasis={attention.length === 0 ?"ok" :"attention"}
        />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Today's performance" action={<Link href="/sales" className="text-xs font-semibold text-black">View sales</Link>} />
          <div className="divide-y divide-black">
            <MetricRow label="Today" value={formatMoney(posSummary.netTotal, currency)} />
            <MetricRow label="Yesterday" value={formatMoney(yesterdaySummary.netTotal, currency)} hint={`${yesterdaySummary.count} transactions`} />
            <MetricRow label="Change" value={salesChange === null ?"n/a" : `${salesChange > 0 ?"+" :""}${salesChange}%`} />
            <MetricRow label="Transactions" value={String(posSummary.count)} />
            <MetricRow label="Average sale" value={formatMoney(posSummary.averageNet, currency)} />
            <MetricRow
              label="Payment mix"
              value={`${formatMoney(paymentAmount("CASH"), currency)} cash`}
              hint={`Card ${formatMoney(paymentAmount("CARD"), currency)} · Mobile ${formatMoney(paymentAmount("MOBILE_MONEY"), currency)} · Other ${formatMoney(paymentAmount("OTHER"), currency)}`}
            />
          </div>
        </Panel>
        <Panel>
          <SectionHeader title="Live operations" action={<Link href="/pos" className="text-xs font-semibold text-black">Open POS</Link>} />
          <div className="divide-y divide-black">
            <MetricRow label="Tables" value={`${occupied} occupied / ${tableTotal} total`} hint={outOfService ? `${outOfService} out of service` : `${available} available`} />
            <MetricRow label="Orders" value={`${pendingOrders} pending · ${preparingOrders} preparing · ${readyOrders} ready`} />
            <MetricRow label="Sessions" value={`${openSessions} active`} hint={settlingSessions ? `${settlingSessions} awaiting payment` : undefined} />
            <MetricRow label="Fulfillment" value={`${pendingOrders} waiting`} hint={queueOrders ? `${queueOrders} in queue` :"All clear"} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Attention required" />
          <div id="attention">
            <AttentionList items={attention} />
          </div>
        </Panel>
        <Panel>
          <SectionHeader title="Recent activity" action={<Link href="/sales" className="text-xs font-semibold text-black">View all</Link>} />
          <ActivityList items={activitySorted} />
        </Panel>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Panel>
          <SectionHeader title="Stock" action={<Link href="/inventory" className="text-xs font-semibold text-black">Open stock</Link>} />
          <div className="divide-y divide-black">
            <MetricRow label="Low stock" value={String(lowStockItems.length)} />
            <MetricRow label="Out of stock" value={String(outOfStockItems.length)} />
            <MetricRow label="Stock units" value={String(stockUnits)} />
            <MetricRow label="Movements today" value={String(movementCount)} />
          </div>
        </Panel>
        <Panel>
          <SectionHeader
            title="Financial"
            action={
              <span className="flex gap-3">
                <Link href="/reports" className="text-xs font-semibold text-black">View credit</Link>
                <Link href="/sales" className="text-xs font-semibold text-black">Sales / close day</Link>
              </span>
            }
          />
          <div className="divide-y divide-black">
            <MetricRow label="Sales" value={formatMoney(posSummary.netTotal, currency)} />
            <MetricRow label="Cash" value={formatMoney(paymentAmount("CASH"), currency)} />
            <MetricRow label="Mobile money" value={formatMoney(paymentAmount("MOBILE_MONEY"), currency)} />
            <MetricRow label="Card" value={formatMoney(paymentAmount("CARD"), currency)} />
            <MetricRow label="Other" value={formatMoney(paymentAmount("OTHER"), currency)} />
            <MetricRow label="Payments settled" value={formatMoney(settledTotal, currency)} />
            <MetricRow label="Outstanding credit" value={formatMoney(creditBalance, currency)} hint={`${creditOutstanding._count} open bills`} />
            <MetricRow
              label="Credit repayments"
              value={formatMoney(creditPaymentsToday._sum.amount?.toNumber() ?? 0, currency)}
              hint={`${creditPaymentsToday._count} today · ${creditPaidToday.length} settled`}
            />
            <MetricRow
              label="Settlement"
              value={dayClosed ?"Closed" :"Open"}
              hint={lastClose ? `Last close ${lastClose.businessDay} by ${lastClose.closedBy.name}` :"No close recorded yet"}
            />
            <MetricRow label="Expenses today" value={formatMoney(expenses._sum.amount?.toNumber() ?? 0, currency)} />
            <MetricRow label="Since start" value={formatMoney(lifetimePos._sum.total?.toNumber() ?? 0, currency)} hint={`${lifetimePos._count} tickets`} />
          </div>
          {creditTop.length > 0 ? (
            <ul className="divide-y divide-black border-t border-black">
              {creditTop.slice(0, 3).map((bill) => (
                <li key={bill.id}>
                  <Link href={`/sales/${bill.saleId}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
                    <span className="font-bold">{bill.customerName}</span>
                    <span className="font-semibold">{formatMoney(bill.balance.toNumber(), currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="border-t p-4">
            <CreditRepaymentForm bills={creditTop.map((bill) => ({ id: bill.id, label: `${bill.customerName} · ${formatMoney(bill.balance.toNumber(), currency)}` }))} />
          </div>
        </Panel>
        <Panel>
          <SectionHeader title="Billiard today" action={<Link href="/billiard" className="text-xs font-semibold text-black">View billiard</Link>} />
          <MetricRow label="Today" value={formatMoney(billiardToday, currency)} hint={`${formatMoney(lifetimeBilliard._sum.amount?.toNumber() ?? 0, currency)} since start`} />
          <div className="min-w-0 border-t p-4">
            <p className="mb-3 text-sm text-black">Save today’s total take. Games are not entered one by one.</p>
            <BilliardSalesForm
              compact
              defaultAmount={myBilliard?.amount.toNumber()}
              defaultNote={myBilliard?.note ?? undefined}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
