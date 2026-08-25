import { ItemStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aggregateSessionItems } from "@/lib/hospitality-service";

export type ReceiptLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type HospitalityReceiptView = {
  receiptNumber: string;
  createdAt: Date;
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  footer: string | null;
  currency: string;
  channel: string | null;
  tableName: string | null;
  destinationLabel: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  waiterName: string | null;
  waiterId: string | null;
  cashierName: string;
  cashierId: string;
  posters: string[];
  lines: ReceiptLine[];
  adjustments: Array<{ type: string; quantity: number; reason: string }>;
  subtotal: number;
  tax: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
    cashReceived: number | null;
    change: number | null;
  }>;
  amountPaid: number;
  change: number;
  creditTotal: number | null;
  creditBalance: number | null;
  creditStatus: string | null;
  chargeToRoom: boolean;
  sessionActiveQuantity: number;
};

function money(value: Prisma.Decimal | number) {
  return typeof value === "number" ? value : value.toNumber();
}

export function groupFinancialLines(
  items: Array<{
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: Prisma.Decimal | number;
    lineSubtotal: Prisma.Decimal | number;
  }>,
): ReceiptLine[] {
  const groups = new Map<string, ReceiptLine>();
  for (const item of items) {
    const name =
      item.variantName && item.variantName !== "Portion" && !item.productName.includes(item.variantName)
        ? `${item.productName} (${item.variantName})`
        : item.productName;
    const unitPrice = money(item.unitPrice);
    const key = `${name}|${unitPrice}`;
    const current = groups.get(key) ?? { name, quantity: 0, unitPrice, lineTotal: 0 };
    current.quantity += item.quantity;
    current.lineTotal += money(item.lineSubtotal);
    groups.set(key, current);
  }
  return [...groups.values()];
}

export async function loadHospitalityReceipt(saleId: string): Promise<HospitalityReceiptView | null> {
  const [sale, settings] = await Promise.all([
    prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        cashier: { select: { name: true } },
        items: true,
        payments: { orderBy: { createdAt: "asc" } },
        creditBill: true,
        session: {
          include: {
            waiter: { select: { name: true } },
            table: { select: { name: true } },
            rounds: {
              include: {
                postedBy: { select: { name: true } },
                items: {
                  include: {
                    product: { select: { name: true } },
                    productVariant: { select: { name: true } },
                  },
                },
              },
            },
            adjustments: true,
          },
        },
      },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!sale) return null;

  const session = sale.session;
  const posters = [
    ...new Set((session?.rounds ?? []).map((round) => round.postedBy.name).filter((name): name is string => Boolean(name))),
  ];
  const sessionItems = session?.rounds.flatMap((round) => round.items) ?? [];
  const sessionLines = aggregateSessionItems(
    sessionItems.map((item) => ({
      productId: item.productId,
      productVariantId: item.productVariantId,
      unitPrice: item.unitPrice,
      qty: item.qty,
      status: item.status,
    })),
  );
  const activeSessionItems = sessionItems.filter((item) => item.status === ItemStatus.ACTIVE);
  const lines =
    activeSessionItems.length > 0
      ? groupFinancialLines(
          activeSessionItems.map((item) => ({
            productName: item.product.name,
            variantName: item.productVariant?.name ?? null,
            quantity: item.qty,
            unitPrice: item.unitPrice,
            lineSubtotal: money(item.unitPrice) * item.qty,
          })),
        )
      : groupFinancialLines(sale.items);

  return {
    receiptNumber: sale.receiptNumber,
    createdAt: sale.createdAt,
    businessName: settings?.businessName ?? "B-ZENITH",
    address: settings?.address ?? null,
    phone: settings?.phone ?? null,
    email: settings?.email ?? null,
    footer: settings?.receiptFooter ?? null,
    currency: settings?.currency ?? "RWF",
    channel: session?.channel ?? null,
    tableName: session?.table?.name ?? null,
    destinationLabel: session?.destinationLabel ?? null,
    customerName: sale.customerName ?? session?.customerName ?? null,
    customerPhone: session?.customerPhone ?? null,
    deliveryAddress: session?.deliveryAddress ?? null,
    waiterName: session?.waiter.name ?? null,
    waiterId: session?.waiterId ?? null,
    cashierName: sale.cashier.name,
    cashierId: sale.cashierId,
    posters,
    lines,
    adjustments: (session?.adjustments ?? []).map((row) => ({
      type: row.type,
      quantity: row.quantity,
      reason: row.reason,
    })),
    subtotal: money(sale.subtotal),
    tax: money(sale.tax),
    total: money(sale.total),
    payments: sale.payments.map((payment) => ({
      method: payment.method,
      amount: money(payment.amount),
      cashReceived: payment.cashReceived ? money(payment.cashReceived) : null,
      change: payment.change ? money(payment.change) : null,
    })),
    amountPaid: money(sale.amountPaid),
    change: money(sale.change),
    creditTotal: sale.creditBill ? money(sale.creditBill.total) : null,
    creditBalance: sale.creditBill ? money(sale.creditBill.balance) : null,
    creditStatus: sale.creditBill?.status ?? null,
    chargeToRoom: Boolean(
      sale.note?.toLowerCase().includes("charge to room") || (session?.channel === "ACCOMMODATION" && sale.creditBill),
    ),
    sessionActiveQuantity: sessionLines.reduce((sum, line) => sum + line.totalQty, 0),
  };
}
