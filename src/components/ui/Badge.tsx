import type { PaymentStatus, OrderStatus } from "@prisma/client";

const paymentStyles: Record<PaymentStatus, string> = {
  UNPAID: "bg-red-50 text-zenith-danger border-red-200",
  PARTIALLY_PAID: "bg-amber-50 text-zenith-warning border-amber-200",
  PAID: "bg-emerald-50 text-zenith-success border-emerald-200",
  PAY_LATER: "bg-orange-50 text-orange-800 border-orange-200",
};

const orderStyles: Record<OrderStatus, string> = {
  OPEN: "bg-zenith-raised text-zenith-gold border-zenith-border",
  COMPLETED: "bg-emerald-50 text-zenith-success border-emerald-200",
  CANCELLED: "bg-zenith-surface text-zenith-muted border-zenith-border",
};

export function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const label =
    status === "PAY_LATER" ? "PAY LATER" : status === "PARTIALLY_PAID" ? "PARTIAL" : status;
  return <Badge className={paymentStyles[status]}>{label}</Badge>;
}

const orderLabels: Record<OrderStatus, string> = {
  OPEN: "Open",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

export function OrderBadge({ status }: { status: OrderStatus }) {
  return <Badge className={orderStyles[status]}>{orderLabels[status]}</Badge>;
}
