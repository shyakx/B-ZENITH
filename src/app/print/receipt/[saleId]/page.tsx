import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { PrintButton } from "@/components/print-button";
import { PoweredBy } from "@/components/powered-by";
import { requireUser } from "@/lib/authorization";
import { formatDateTime, formatMoney, paymentLabel, VENUE_LINE } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const user = await requireUser(["OWNER", "ADMIN", "WAITER"]);
  const { saleId } = await params;
  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      ...(user.role === "WAITER" ? { cashierId: user.id } : {}),
    },
    include: { cashier: true, items: true, payment: true },
  });
  if (!sale) notFound();

  const settings = await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  const currency = settings.currency;

  return (
    <main className="receipt-page mx-auto min-h-screen bg-white p-4 text-black">
      <div className="print:hidden mx-auto mb-5 flex max-w-[80mm] justify-end">
        <PrintButton />
      </div>
      <article className="receipt mx-auto w-full max-w-[80mm] bg-white text-[12px] leading-5">
        <header className="border-b border-dashed border-black pb-3 text-center">
          <BrandLogo variant="receipt" size={64} className="receipt-logo mx-auto mb-1" />
          <h1 className="text-xl font-black tracking-widest">{settings.businessName}</h1>
          <p>{VENUE_LINE}</p>
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && <p>Tel: {settings.phone}</p>}
          {settings.email && <p>{settings.email}</p>}
        </header>
        <section className="border-b border-dashed border-black py-3">
          <div className="flex justify-between"><span>Receipt</span><b>{sale.receiptNumber}</b></div>
          <div className="flex justify-between"><span>Date</span><span>{formatDateTime(sale.createdAt)}</span></div>
          <div className="flex justify-between"><span>Cashier</span><span>{sale.cashier.name}</span></div>
        </section>
        <table className="w-full border-b border-dashed border-black py-2">
          <thead>
            <tr className="text-left">
              <th className="py-2">Item</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="pb-2 pr-1">
                  {item.productName}
                  {item.variantName && item.variantName !== "Portion" && !item.productName.includes(item.variantName) && (
                    <span className="block text-[10px]">{item.variantName}</span>
                  )}
                </td>
                <td className="pb-2 text-center">{item.quantity}</td>
                <td className="pb-2 text-right">{formatMoney(item.unitPrice.toNumber(), currency, 0)}</td>
                <td className="pb-2 text-right">{formatMoney(item.lineSubtotal.toNumber(), currency, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="space-y-1 border-b border-dashed border-black py-3">
          <div className="flex justify-between"><span>Subtotal</span><b>{formatMoney(sale.subtotal.toNumber(), currency, 0)}</b></div>
          {sale.tax.isPositive() && <div className="flex justify-between"><span>Tax</span><b>{formatMoney(sale.tax.toNumber(), currency, 0)}</b></div>}
          <div className="flex justify-between text-base"><span className="font-black">TOTAL</span><b>{formatMoney(sale.total.toNumber(), currency, 0)}</b></div>
          <div className="flex justify-between"><span>Payment</span><span>{paymentLabel(sale.paymentMethod)}</span></div>
          {sale.payment?.cashReceived && <div className="flex justify-between"><span>Cash received</span><span>{formatMoney(sale.payment.cashReceived.toNumber(), currency, 0)}</span></div>}
          {sale.payment?.change?.isPositive() && <div className="flex justify-between"><span>Change</span><span>{formatMoney(sale.payment.change.toNumber(), currency, 0)}</span></div>}
        </section>
        <footer className="py-4 text-center">
          <p className="font-semibold">{settings.receiptFooter}</p>
          <PoweredBy className="mt-3 text-stone-600" />
        </footer>
      </article>
    </main>
  );
}
