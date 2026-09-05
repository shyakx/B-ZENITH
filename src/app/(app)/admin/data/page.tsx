import { requireRole } from "@/lib/auth/current-user";
import { rwandaDayRange, toDateInput } from "@/lib/dates";
import { DataControlForm } from "@/components/admin/DataControlForm";
import { countMaisonRecords, listSalesForDay } from "@/services/admin-purge";

export default async function AdminDataPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireRole("ADMIN");
  const { date: rawDate } = await searchParams;
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : toDateInput();
  const { from, to } = rwandaDayRange(date);
  const [orders, maisonCount] = await Promise.all([listSalesForDay(from, to), countMaisonRecords()]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Data control</h1>
      <p className="mt-1 text-sm text-zenith-muted">
        Owner and Admin can delete test sales and Maison stays from here. Staff, menu, tables, and
        settings stay. The Audit page stays in the menu. Type DELETE before anything is removed.
      </p>
      <div className="mt-6">
        <DataControlForm
          date={date}
          maisonCount={maisonCount}
          orders={orders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            total: order.total,
            paidAmount: order.paidAmount,
            tableName: order.table.name,
            waiterName: order.waiter.name,
          }))}
        />
      </div>
    </div>
  );
}
