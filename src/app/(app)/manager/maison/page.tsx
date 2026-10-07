import { requireRole } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/dates";
import { formatRwf } from "@/lib/domain/money";
import { MaisonForm, MaisonPayButton } from "@/components/manager/MaisonForm";
import { PaymentBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listMaisonRecords } from "@/services/maison";
import { PaymentStatus } from "@prisma/client";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, validAmountParam, type SearchParams } from "@/lib/list-filters";
import { listUsers } from "@/services/users";

export default async function MaisonPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("MANAGER");
  const params = await searchParams;
  const { from, to, fromValue, toValue } = dateRange(params);
  const paymentStatus = Object.values(PaymentStatus).find((value) => value === singleParam(params, "paymentStatus"));
  const staffId = singleParam(params, "staffId");
  const search = singleParam(params, "q");
  const minAmount = validAmountParam(singleParam(params, "minAmount"));
  const maxAmount = validAmountParam(singleParam(params, "maxAmount"));
  const [records, staff] = await Promise.all([
    listMaisonRecords({ from, to, paymentStatus, staffId, search, minAmount, maxAmount }),
    listUsers(),
  ]);
  const fields: ListFilterField[] = [
    { name: "from", label: "Stay date from", type: "date", value: fromValue },
    { name: "to", label: "Stay date to", type: "date", value: toValue },
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Guest, phone, reference, staff" },
    {
      name: "paymentStatus",
      label: "Payment status",
      type: "select",
      value: paymentStatus ?? "",
      options: [{ value: "", label: "All statuses" }, ...Object.values(PaymentStatus).map((value) => ({ value, label: value.replaceAll("_", " ") }))],
    },
    {
      name: "staffId",
      label: "Recorded by",
      type: "select",
      value: staffId,
      options: [{ value: "", label: "All staff" }, ...staff.map((person) => ({ value: person.id, label: person.name }))],
    },
    { name: "minAmount", label: "Min bill", type: "number", value: singleParam(params, "minAmount") },
    { name: "maxAmount", label: "Max bill", type: "number", value: singleParam(params, "maxAmount") },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <PageHeader title="Maison de Passage" subtitle="Guest stays — separate from POS sales." />
      <div className="mb-6 max-w-3xl">
        <Card>
          <MaisonForm />
        </Card>
      </div>
      <ListFilterForm fields={fields} action="/manager/maison" />
      <p className="mb-2 text-xs text-zenith-muted">{records.length} stays shown (maximum 200).</p>
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
