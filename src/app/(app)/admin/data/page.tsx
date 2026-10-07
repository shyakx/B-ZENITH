import { requireRole } from "@/lib/auth/current-user";
import { rwandaDayRange, toDateInput } from "@/lib/dates";
import { DataControlForm } from "@/components/admin/DataControlForm";
import { countMaisonRecords, listSalesForDay } from "@/services/admin-purge";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import type { ListFilterField } from "@/components/ui/ListFilterForm";
import { singleParam, validAmountParam, validDateParam, type SearchParams } from "@/lib/list-filters";
import { listTables } from "@/services/products";
import { listUsers } from "@/services/users";

export default async function AdminDataPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const rawDate = singleParam(params, "date");
  const date = validDateParam(rawDate) ? rawDate : toDateInput();
  const { from, to } = rwandaDayRange(date);
  const waiterId = singleParam(params, "waiterId");
  const tableId = singleParam(params, "tableId");
  const status = Object.values(OrderStatus).find((value) => value === singleParam(params, "status"));
  const paymentStatus = Object.values(PaymentStatus).find(
    (value) => value === singleParam(params, "paymentStatus"),
  );
  const search = singleParam(params, "q");
  const minTotal = validAmountParam(singleParam(params, "minTotal"));
  const maxTotal = validAmountParam(singleParam(params, "maxTotal"));
  const [orders, maisonCount, users, tables] = await Promise.all([
    listSalesForDay(from, to, { waiterId, tableId, status, paymentStatus, minTotal, maxTotal, search }),
    countMaisonRecords(),
    listUsers(),
    listTables(),
  ]);
  const fields: ListFilterField[] = [
    { name: "date", label: "Rwanda date", type: "date", value: date },
    { name: "q", label: "Search", type: "search", value: search, placeholder: "Order, waiter, or table" },
    {
      name: "waiterId",
      label: "Waiter",
      type: "select",
      value: waiterId,
      options: [{ value: "", label: "All waiters" }, ...users.filter((user) => user.role === "WAITER").map((user) => ({ value: user.id, label: user.name }))],
    },
    {
      name: "tableId",
      label: "Table",
      type: "select",
      value: tableId,
      options: [{ value: "", label: "All tables" }, ...tables.map((table) => ({ value: table.id, label: table.name }))],
    },
    {
      name: "status",
      label: "Order status",
      type: "select",
      value: status ?? "",
      options: [{ value: "", label: "All statuses" }, ...Object.values(OrderStatus).map((value) => ({ value, label: value.replaceAll("_", " ") }))],
    },
    {
      name: "paymentStatus",
      label: "Payment status",
      type: "select",
      value: paymentStatus ?? "",
      options: [{ value: "", label: "All payments" }, ...Object.values(PaymentStatus).map((value) => ({ value, label: value.replaceAll("_", " ") }))],
    },
    { name: "minTotal", label: "Min total", type: "number", value: singleParam(params, "minTotal") },
    { name: "maxTotal", label: "Max total", type: "number", value: singleParam(params, "maxTotal") },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <h1 className="font-display text-2xl text-zenith-gold">Data control</h1>
      <div className="mt-6">
        <DataControlForm
          key={orders.map((order) => order.id).join(":")}
          filterFields={fields}
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
