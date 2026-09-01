import { BUSINESS_TIMEZONE } from "@/lib/dates";

export type PaymentHistorySource = {
  id?: string;
  createdAt: Date | string;
  method: string;
  amount: number;
};

export type PaymentHistoryRow = {
  key: string;
  date: string;
  time: string;
  method: string;
  amount: number;
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "CASH",
  MOBILE_MONEY: "MOBILE MONEY",
  CARD: "CARD",
  OTHER: "OTHER",
};

function asDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

export function paymentMethodLabel(method: string): string {
  return METHOD_LABEL[method] ?? method.replace(/_/g, " ");
}

export function formatPaymentDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(asDate(value));
}

export function formatPaymentTime(value: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(asDate(value));
}

/** Installment rows from Payment records only. Oldest first. Not from Order.paidAmount. */
export function paymentHistoryRows(payments: PaymentHistorySource[]): PaymentHistoryRow[] {
  return [...payments]
    .sort((a, b) => asDate(a.createdAt).getTime() - asDate(b.createdAt).getTime())
    .map((payment, index) => ({
      key: payment.id ?? `${asDate(payment.createdAt).toISOString()}-${index}`,
      date: formatPaymentDate(payment.createdAt),
      time: formatPaymentTime(payment.createdAt),
      method: paymentMethodLabel(payment.method),
      amount: payment.amount,
    }));
}

export function paymentHistoryTotal(payments: PaymentHistorySource[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}
