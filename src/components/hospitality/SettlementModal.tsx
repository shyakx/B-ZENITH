"use client";

import { X, CreditCard, Banknote, Smartphone, Receipt, CheckCircle2, BedDouble } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { formatMoney, paymentLabel } from "@/lib/datetime";
import { ManagerApprovalFields, type ManagerApprovalInput } from "./AdjustmentModals";
import { SessionInfo } from "./types";
import { PaymentMethod, ServiceChannel } from "@prisma/client";

export type SettlementSubmit = {
  payments: Array<{ method: PaymentMethod; amount: number; cashReceived?: number }>;
  creditAmount?: number;
  chargeToRoom?: boolean;
  customerName?: string;
  managerUserId?: string;
  managerPin?: string;
  idempotencyKey: string;
};

interface SettlementModalProps {
  session: SessionInfo;
  currency: string;
  onClose: () => void;
  onComplete: (payload: SettlementSubmit) => Promise<{ id?: string } | void>;
}

export function SettlementModal({ session, currency, onClose, onComplete }: SettlementModalProps) {
  const settlementKeyRef = useRef(crypto.randomUUID());
  const [payments, setPayments] = useState<Array<{ method: PaymentMethod; amount: number; cashReceived?: number }>>([]);
  const [currentMethod, setCurrentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [amountInput, setAmountInput] = useState("");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [putRemainderOnCredit, setPutRemainderOnCredit] = useState(false);
  const [chargeToRoom, setChargeToRoom] = useState(false);
  const [customerName, setCustomerName] = useState(session.customerName ??"");
  const [approval, setApproval] = useState<ManagerApprovalInput>({ managerUserId:"", managerPin:"" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);

  const totalDue = session.totalAmount;
  const totalPaid = useMemo(() => payments.reduce((sum, payment) => sum + payment.amount, 0), [payments]);
  const remaining = Math.max(0, totalDue - totalPaid);
  const isAccommodation = session.channel === ServiceChannel.ACCOMMODATION;
  const usesCredit = chargeToRoom || (putRemainderOnCredit && remaining > 0);
  const canFinalize = (remaining === 0 || usesCredit) && (!usesCredit || (approval.managerUserId && approval.managerPin.length === 4));

  const addPayment = () => {
    const amount = Number(amountInput);
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Enter a payment amount.");
      return;
    }
    if (amount > remaining) {
      setError("Payment exceeds remaining balance.");
      return;
    }
    setPayments([
      ...payments,
      {
        method: currentMethod,
        amount,
        cashReceived: currentMethod === PaymentMethod.CASH ? Number(cashReceivedInput) || amount : undefined,
      },
    ]);
    setAmountInput("");
    setCashReceivedInput("");
    setError("");
  };

  const handleComplete = async () => {
    if (isProcessing) return;
    if (remaining > 0 && !usesCredit) {
      setError("Pay the remaining balance or convert it to credit.");
      return;
    }
    if (usesCredit && (!approval.managerUserId || approval.managerPin.length !== 4)) {
      setError("Manager approval is required for credit.");
      return;
    }
    if (chargeToRoom && !session.destinationLabel) {
      setError("Charge to room requires a room or destination on this session.");
      return;
    }
    setIsProcessing(true);
    setError("");
    try {
      const result = await onComplete({
        payments,
        creditAmount: usesCredit ? remaining : undefined,
        chargeToRoom: chargeToRoom || undefined,
        customerName: customerName.trim() || undefined,
        managerUserId: usesCredit ? approval.managerUserId : undefined,
        managerPin: usesCredit ? approval.managerPin : undefined,
        idempotencyKey: settlementKeyRef.current,
      });
      if (result?.id) setReceiptSaleId(result.id);
      setCompleted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message :"Settlement failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (completed) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black p-4">
        <div className="w-full max-w-md rounded-md bg-white p-8 text-center border border-black">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#FFD758] text-black">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="mt-6 text-3xl font-semibold">Settled!</h2>
          <p className="mt-2 text-black">Session for {session.table ? session.table.name :"Service"} is closed.</p>
          <div className="mt-8 grid gap-3">
            {receiptSaleId && (
              <a
                href={`/print/receipt/${receiptSaleId}`}
                target="_blank"
                rel="noreferrer"
                className="grid min-h-14 place-items-center rounded-md border-2 border-black font-semibold"
              >
                PRINT RECEIPT
              </a>
            )}
            <button onClick={() => window.location.reload()} className="bz-btn-primary min-h-14">
              DONE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-md bg-white  md:flex-row">
        <div className="flex max-h-[34vh] w-full shrink-0 flex-col border-b bg-white p-4 md:max-h-none md:w-1/3 md:border-b-0 md:border-r md:p-6">
          <h2 className="mb-6 text-xl font-semibold uppercase tracking-widest text-black">Settlement</h2>
          <div className="flex-1 space-y-6 overflow-y-auto">
            <div>
              <p className="text-xs font-bold text-black">SESSION</p>
              <p className="text-lg font-semibold">{session.table ? session.table.name : session.destinationLabel || session.channel}</p>
              <p className="text-xs text-black">{session.waiter.name} · {new Date(session.openedAt).toLocaleTimeString()}</p>
            </div>
            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between text-xl font-semibold">
                <span>Grand Total</span>
                <span>{formatMoney(totalDue, currency, 0)}</span>
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <p className="text-xs font-bold text-black">PAYMENTS</p>
              {payments.length === 0 && <p className="text-xs italic text-black">No payments added yet.</p>}
              {payments.map((payment, index) => (
                <div key={`${payment.method}-${index}`} className="flex items-center justify-between rounded-lg border bg-white p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold">{payment.method}</span>
                    <span className="font-bold">{formatMoney(payment.amount, currency, 0)}</span>
                  </div>
                  <button
                    onClick={() => setPayments(payments.filter((_, idx) => idx !== index))}
                    className="text-black"
                    disabled={isProcessing}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {usesCredit && remaining > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-black bg-white p-2 text-sm">
                  <span className="text-[10px] font-semibold uppercase text-black">{chargeToRoom ?"Room credit" :"Credit"}</span>
                  <span className="font-bold">{formatMoney(remaining, currency, 0)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-auto border-t pt-4">
            <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest text-black">
              <span>Remaining</span>
              <span className={remaining > 0 && !usesCredit ?"text-black" :"text-black"}>
                {formatMoney(usesCredit ? 0 : remaining, currency, 0)}
              </span>
            </div>
            <button
              disabled={!canFinalize || isProcessing}
              onClick={handleComplete}
              className="bz-btn-primary flex min-h-14 w-full items-center justify-center gap-2 disabled:border-2 disabled:border-dashed"
            >
              <Receipt size={20} /> {isProcessing ?"PROCESSING..." :"FINALIZE & CLOSE"}
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-5 md:p-8">
          <button onClick={onClose} className="absolute right-4 top-4 text-black hover:text-black" disabled={isProcessing}>
            <X size={24} />
          </button>
          <h3 className="mb-8 text-2xl font-semibold">Add Payment</h3>
          <div className="mb-6 grid grid-cols-3 gap-2 sm:mb-8 sm:gap-4">
            {[
              { id: PaymentMethod.CASH, label:"Cash", icon: Banknote },
              { id: PaymentMethod.MOBILE_MONEY, label:"MoMo", icon: Smartphone },
              { id: PaymentMethod.CARD, label:"Card", icon: CreditCard },
            ].map((method) => (
              <button
                key={method.id}
                onClick={() => {
                  setCurrentMethod(method.id);
                  setAmountInput(remaining.toString());
                }}
                className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-md border-2 py-4 transition-all sm:py-6 ${
                  currentMethod === method.id ?"border-black bg-[#FFD758] text-black" :"border-black hover:border-[#FFD758]"
                }`}
              >
                <method.icon size={28} />
                <span className="font-semibold">{method.label}</span>
              </button>
            ))}
          </div>
          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold uppercase tracking-widest text-black">Payment Amount</label>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-black">{currency}</span>
                <input
                  type="number"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  className="bz-input mt-2 h-16 pl-16 pr-4 text-2xl font-semibold"
                  placeholder="0"
                  disabled={isProcessing || remaining === 0}
                />
              </div>
            </div>
            {currentMethod === PaymentMethod.CASH && (
              <div>
                <label className="text-sm font-semibold uppercase tracking-widest text-black">Cash Received</label>
                <input
                  type="number"
                  value={cashReceivedInput}
                  onChange={(event) => setCashReceivedInput(event.target.value)}
                  className="bz-input mt-2 h-16 text-2xl font-semibold"
                  placeholder="0"
                  disabled={isProcessing}
                />
              </div>
            )}
            {error && <p className="bz-alert">{error}</p>}
            <button
              onClick={addPayment}
              disabled={isProcessing || remaining === 0}
              className="bz-btn-secondary flex min-h-16 w-full items-center justify-center disabled:border-2 disabled:border-dashed"
            >
              ADD {paymentLabel(currentMethod)} PAYMENT
            </button>
            <label className="flex items-start gap-3 rounded-md border-2 border-black p-4 text-sm font-bold">
              <input
                type="checkbox"
                checked={putRemainderOnCredit}
                onChange={(event) => {
                  setPutRemainderOnCredit(event.target.checked);
                  if (!event.target.checked) setChargeToRoom(false);
                }}
                disabled={isProcessing || remaining === 0}
              />
              <span>Convert remaining {formatMoney(remaining, currency, 0)} to credit</span>
            </label>
            {isAccommodation && (
              <label className="flex items-start gap-3 rounded-md border-2 border-black bg-white p-4 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={chargeToRoom}
                  onChange={(event) => {
                    setChargeToRoom(event.target.checked);
                    if (event.target.checked) setPutRemainderOnCredit(true);
                  }}
                  disabled={isProcessing || remaining === 0}
                />
                <span className="flex items-center gap-2">
                  <BedDouble size={16} /> Charge remaining to room {session.destinationLabel ||"(missing destination)"}
                </span>
              </label>
            )}
            {usesCredit && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-widest text-black">
                  Customer / guest
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="bz-input mt-2 h-12 font-medium"
                    placeholder={session.destinationLabel ? `Room ${session.destinationLabel}` :"Guest name"}
                  />
                </label>
                <ManagerApprovalFields managerUserId={approval.managerUserId} managerPin={approval.managerPin} onChange={setApproval} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
