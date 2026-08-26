import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { ReceiptPrintControls } from "@/components/receipt-print-controls";
import { PoweredBy } from "@/components/powered-by";
import { requireUser } from "@/lib/authorization";
import { tillRoles } from "@/lib/roles";
import { formatDateTime, formatMoney, paymentLabel, VENUE_LINE } from "@/lib/datetime";
import { loadHospitalityReceipt } from "@/lib/hospitality-receipt";

function money(value: number, currency: string) {
  return formatMoney(value, currency, 0).replace(/\u00a0|\u202f/g,"");
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const user = await requireUser(tillRoles);
  const { saleId } = await params;
  const { autoprint } = await searchParams;
  const receipt = await loadHospitalityReceipt(saleId);
  if (!receipt) notFound();
  if (user.role ==="WAITER" && user.id !== receipt.cashierId && user.id !== receipt.waiterId) {
    notFound();
  }

  const currency = receipt.currency;

  return (
    <main className="receipt-page mx-auto bg-white p-3 text-black">
      <ReceiptPrintControls autoprint={autoprint ==="1"} />
      <article className="receipt mx-auto w-full max-w-[58mm] bg-white text-[12px] leading-5">
        <header className="border-b border-dashed border-black pb-3 text-center">
          <BrandLogo variant="receipt" size={48} className="receipt-logo mx-auto mb-1" />
          <h1 className="text-base font-semibold tracking-widest">{receipt.businessName}</h1>
          <p>{VENUE_LINE}</p>
          {receipt.address && <p>{receipt.address}</p>}
          {receipt.phone && <p>Tel: {receipt.phone}</p>}
          {receipt.email && <p>{receipt.email}</p>}
        </header>
        <section className="border-b border-dashed border-black py-3">
          <div className="flex justify-between gap-2"><span>Receipt</span><b>{receipt.receiptNumber}</b></div>
          <div className="flex justify-between gap-2"><span>Date</span><span className="text-right">{formatDateTime(receipt.createdAt)}</span></div>
          {receipt.channel && <div className="flex justify-between gap-2"><span>Channel</span><span className="text-right">{receipt.channel.replaceAll("_","")}</span></div>}
          {receipt.tableName && <div className="flex justify-between gap-2"><span>Table</span><span className="text-right">{receipt.tableName}</span></div>}
          {receipt.destinationLabel && <div className="flex justify-between gap-2"><span>{receipt.channel ==="ACCOMMODATION" ?"Room" :"Destination"}</span><span className="text-right">{receipt.destinationLabel}</span></div>}
          {receipt.customerName && <div className="flex justify-between gap-2"><span>Guest</span><span className="text-right">{receipt.customerName}</span></div>}
          {receipt.customerPhone && <div className="flex justify-between gap-2"><span>Phone</span><span className="text-right">{receipt.customerPhone}</span></div>}
          {receipt.deliveryAddress && <p className="mt-1 break-words">Deliver: {receipt.deliveryAddress}</p>}
          {receipt.waiterName && <div className="flex justify-between gap-2"><span>Waiter</span><span className="text-right">{receipt.waiterName}</span></div>}
          {receipt.posters.length > 0 && (
            <div className="flex justify-between gap-2"><span>Posted by</span><span className="text-right">{receipt.posters.join(",")}</span></div>
          )}
          <div className="flex justify-between gap-2"><span>Settled by</span><span className="text-right">{receipt.cashierName}</span></div>
        </section>
        <section className="border-b border-dashed border-black py-2">
          {receipt.lines.map((item) => (
            <div key={`${item.name}-${item.unitPrice}`} className="mb-2">
              <p className="break-words">{item.name}</p>
              <div className="flex justify-between gap-2">
                <span>
                  {item.quantity} x {money(item.unitPrice, currency)}
                </span>
                <b>{money(item.lineTotal, currency)}</b>
              </div>
            </div>
          ))}
          {receipt.adjustments.map((adjustment, index) => (
            <div key={`${adjustment.type}-${index}`} className="flex justify-between text-[10px] text-black">
              <span>{adjustment.type} × {adjustment.quantity}</span>
              <span>{adjustment.reason}</span>
            </div>
          ))}
        </section>
        <section className="space-y-1 border-b border-dashed border-black py-3">
          <div className="flex justify-between"><span>Subtotal</span><b>{money(receipt.subtotal, currency)}</b></div>
          {receipt.tax > 0 && <div className="flex justify-between"><span>Tax</span><b>{money(receipt.tax, currency)}</b></div>}
          <div className="flex justify-between text-[13px]"><span className="font-semibold">TOTAL</span><b>{money(receipt.total, currency)}</b></div>
          <div className="pt-1">
            <div className="font-bold">Payments</div>
            {receipt.payments.length === 0 && receipt.creditTotal ? (
              <div className="flex justify-between text-[10px]"><span>On account</span><span>{money(receipt.creditTotal, currency)}</span></div>
            ) : (
              receipt.payments.map((payment, index) => (
                <div key={`${payment.method}-${index}`}>
                  <div className="flex justify-between text-[10px]">
                    <span>{paymentLabel(payment.method)}</span>
                    <span>{money(payment.amount, currency)}</span>
                  </div>
                  {payment.cashReceived != null && (
                    <div className="flex justify-between text-[10px]"><span>Cash received</span><span>{money(payment.cashReceived, currency)}</span></div>
                  )}
                  {payment.change != null && payment.change > 0 && (
                    <div className="flex justify-between text-[10px]"><span>Change</span><span>{money(payment.change, currency)}</span></div>
                  )}
                </div>
              ))
            )}
          </div>
          {receipt.change > 0 && (
            <div className="flex justify-between"><span>Change</span><b>{money(receipt.change, currency)}</b></div>
          )}
          {receipt.creditTotal != null && (
            <>
              <div className="flex justify-between"><span>{receipt.chargeToRoom ?"Charged to room" :"Credit"}</span><b>{money(receipt.creditTotal, currency)}</b></div>
              {receipt.creditBalance != null && (
                <div className="flex justify-between"><span>Balance due</span><b>{money(receipt.creditBalance, currency)}</b></div>
              )}
            </>
          )}
        </section>
        <footer className="pt-2 pb-1 text-center">
          {receipt.footer && <p className="mb-1">{receipt.footer}</p>}
          <PoweredBy variant="receipt" />
        </footer>
      </article>
    </main>
  );
}
