import { requireRole } from "@/lib/auth/current-user";
import { auditActionLabel, auditAffected } from "@/lib/admin-audit";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { listUsers } from "@/services/users";
import { ListFilterForm, type ListFilterField } from "@/components/ui/ListFilterForm";
import { dateRange, singleParam, type SearchParams } from "@/lib/list-filters";

const AUDIT_ACTIONS = [
  "ORDER_CREATED", "ORDER_CANCELLED", "PAYMENT_RECORDED", "PAY_LATER_CREATED", "PAY_LATER_SETTLED",
  "STOCK_RECEIVED", "STOCK_TRANSFERRED", "STOCK_WASTE", "STOCK_ADJUSTED", "STOCK_COUNTED",
  "PRODUCT_PRICE_CHANGED", "PRODUCT_REMOVED", "PRODUCT_DELETED", "PRODUCT_PACKAGING_CHANGED",
  "CATEGORY_DELETED", "PRODUCT_MANAGER_REFERENCE_UPDATED", "SUPPLIER_CREATED", "SUPPLIER_UPDATED",
  "SUPPLIER_ACTIVATED", "SUPPLIER_DEACTIVATED", "MAISON_CREATED", "MAISON_PAYMENT", "SALES_PURGED",
  "MAISON_PURGED", "USER_CREATED", "PERMISSION_CHANGED", "PIN_CHANGED", "USER_ACTIVATED",
  "USER_DEACTIVATED", "USER_DELETED", "SETTINGS_CHANGED",
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const userId = singleParam(params, "userId");
  const { from, to, fromValue, toValue } = dateRange(params);
  const action = AUDIT_ACTIONS.find((value) => value === singleParam(params, "action"));
  const entity = singleParam(params, "entity");
  const query = singleParam(params, "q").toLowerCase();
  const [allLogs, staff] = await Promise.all([
    prisma.auditLog.findMany({
      take: 500,
      where: {
        userId: userId || undefined,
        action,
        entity: entity || undefined,
        ...(from || to ? { createdAt: { gte: from, lte: to } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
    listUsers(),
  ]);
  const logs = allLogs.filter((log) =>
    !query ||
    `${auditActionLabel(log.action)} ${auditAffected(log)} ${log.entityId}`.toLowerCase().includes(query),
  );
  const selected = staff.find((user) => user.id === userId);
  const staffOptions = [
    ...new Map(
      [...staff, ...allLogs.map((log) => log.user)].map((person) => [person.id, person]),
    ).values(),
  ];
  const entities = [...new Set(allLogs.map((log) => log.entity))].sort();
  const fields: ListFilterField[] = [
    { name: "from", label: "From", type: "date", value: fromValue },
    { name: "to", label: "To", type: "date", value: toValue },
    { name: "q", label: "Search", type: "search", value: query, placeholder: "Staff, action, entity, affected ID" },
    {
      name: "userId",
      label: "Staff",
      type: "select",
      value: userId,
      options: [{ value: "", label: "All staff" }, ...staffOptions.map((person) => ({ value: person.id, label: `${person.name} · ${person.role}` }))],
    },
    {
      name: "action",
      label: "Action",
      type: "select",
      value: action ?? "",
      options: [{ value: "", label: "All actions" }, ...AUDIT_ACTIONS.map((value) => ({ value, label: auditActionLabel(value) }))],
    },
    {
      name: "entity",
      label: "Record type",
      type: "select",
      value: entity,
      options: [{ value: "", label: "All record types" }, ...entities.map((value) => ({ value, label: value }))],
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <h1 className="text-xl font-semibold text-zenith-gold">Audit</h1>

      <div className="mt-4">
        <ListFilterForm fields={fields} action="/admin/audit" />
      </div>
      <p className="mb-2 text-xs text-zenith-muted">
        {logs.length} records match. Search checks the latest 500 records after date, staff, action, and record-type filters.
      </p>

      {selected ? (
        <p className="mt-3 text-sm text-zenith-muted">Showing activity for {selected.name}.</p>
      ) : null}

      {logs.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-zenith-border bg-white px-4 py-6">
          No audit records match these dates and filters.
        </p>
      ) : (
        <div className="mt-6 grid gap-3">
          {logs.map((log) => (
            <article key={log.id} className="min-w-0 rounded-2xl border border-zenith-border bg-white p-4">
              <div className="text-base font-semibold text-zenith-gold">{auditActionLabel(log.action)}</div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">Date and time</dt>
                  <dd className="mt-0.5 font-semibold">{formatDateTime(log.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">User</dt>
                  <dd className="mt-0.5 font-semibold">
                    {log.user.name} · {log.user.role}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">What was affected</dt>
                  <dd className="mt-0.5 font-semibold">{auditAffected(log)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
