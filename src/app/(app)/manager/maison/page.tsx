import { requireRole } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { MaisonForm, MaisonPayButton } from "@/components/manager/MaisonForm";
import { PaymentBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listMaisonRecords } from "@/services/maison";

export default async function MaisonPage() {
  await requireRole("MANAGER");
  const records = await listMaisonRecords();

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <PageHeader
        title="Maison de Passage"
        subtitle="Guest stay — not included in POS sales. Simple usage records for wedding guests and similar bookings."
      />
      <div className="mb-6 max-w-3xl">
        <Card>
          <MaisonForm />
        </Card>
      </div>
      <div className="space-y-3">
        {records.map((record) => (
          <article key={record.id} className="rounded-2xl border border-zenith-border bg-zenith-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{record.customerName}</div>
                <div className="text-sm text-zenith-muted">
                  {record.reference || "No reference"} · {formatDate(record.date)} · {record.staff.name}
                </div>
                {record.customerPhone ? (
                  <div className="text-sm text-zenith-muted">{record.customerPhone}</div>
                ) : null}
              </div>
              <div className="text-right">
                <PaymentBadge status={record.paymentStatus} />
                <div className="mt-2 text-zenith-gold">{formatRwf(record.amount)}</div>
                <div className="text-sm text-zenith-muted">Paid {formatRwf(record.paidAmount)}</div>
              </div>
            </div>
            <div className="mt-3 max-w-sm">
              <MaisonPayButton id={record.id} remaining={record.amount - record.paidAmount} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
