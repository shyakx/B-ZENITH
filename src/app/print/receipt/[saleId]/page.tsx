import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { ReceiptPrintControls } from "@/components/receipt-print-controls";
import { PoweredBy } from "@/components/powered-by";
import { requireUser } from "@/lib/authorization";
import { formatDateTime, formatMoney, paymentLabel, VENUE_LINE } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

function money(value: number, currency: string) {
  return formatMoney(value, currency, 0).replace(/\u00a0|\u202f/g, " ");
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const user = await requireUser(["OWNER", "ADMIN", "WAITER"]);
  const { saleId } = await params;
  const { autoprint } = await searchParams;
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
    <main className="receipt-page mx-auto bg-white p-3 text-black">
      <ReceiptPrintControls autoprint={autoprint === "1"} />
      <article className="receipt mx-auto w-full max-w-[58mm] bg-white text-[12px] leading-5">
        <header className="border-b border-dashed border-black pb-3 text-center">
          <BrandLogo variant="receipt" size={48} className="receipt-logo mx-auto mb-1" />
          <h1 className="text-base font-black tracking-widest">{settings.businessName}</h1>
          <p>{VENUE_LINE}</p>
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && <p>Tel: {settings.phone}</p>}
          {settings.email && <p>{settings.email}</p>}
        </header>
        <section className="border-b border-dashed border-black py-3">
          <div className="flex justify-between gap-2"><span>Receipt</span><b>{sale.receiptNumber}</b></div>
          <div className="flex justify-between gap-2"><span>Date</span><span className="text-right">{formatDateTime(sale.createdAt)}</span></div>
          <div className="flex justify-between gap-2"><span>Cashier</span><span className="text-right">{sale.cashier.name}</span></div>
        </section>
        <section className="border-b border-dashed border-black py-2">
          {sale.items.map((item) => (
            <div key={item.id} className="mb-2">
              <p className="break-words">
                {item.productName}
                {item.variantName && item.variantName !== "Portion" && !item.productName.includes(item.variantName) && (
                  <span className="block text-[10px]">{item.variantName}</span>
                )}
              </p>
              <div className="flex justify-between gap-2">
                <span>
                  {item.quantity} x {money(item.unitPrice.toNumber(), currency)}
                </span>
                <b>{money(item.lineSubtotal.toNumber(), currency)}</b>
              </div>
            </div>
          ))}
        </section>
        <section className="space-y-1 border-b border-dashed border-black py-3">
          <div className="flex justify-between"><span>Subtotal</span><b>{money(sale.subtotal.toNumber(), currency)}</b></div>
          {sale.tax.isPositive() && <div className="flex justify-between"><span>Tax</span><b>{money(sale.tax.toNumber(), currency)}</b></div>}
          <div className="flex justify-between text-[13px]"><span className="font-black">TOTAL</span><b>{money(sale.total.toNumber(), currency)}</b></div>
          <div className="flex justify-between"><span>Payment</span><span>{paymentLabel(sale.paymentMethod)}</span></div>
          {sale.payment?.cashReceived && <div className="flex justify-between"><span>Cash</span><span>{money(sale.payment.cashReceived.toNumber(), currency)}</span></div>}
          {sale.payment?.change?.isPositive() && <div className="flex justify-between"><span>Change</span><span>{money(sale.payment.change.toNumber(), currency)}</span></div>}
        </section>
        <footer className="py-4 text-center">
          <p className="font-semibold">{settings.receiptFooter}</p>
          <PoweredBy className="mt-3 text-stone-600" />
        </footer>
      </article>
    </main>
  );
}
