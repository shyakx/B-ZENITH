import { requireRole } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { TableForm, TableRow } from "@/components/manager/ProductForm";
import { TableRenameForm } from "@/components/manager/TableManager";
import { listManagedTables } from "@/services/products";

export default async function ManagerTablesPage() {
  await requireRole("MANAGER");
  const tables = await listManagedTables();

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <h1 className="font-display text-2xl text-zenith-gold">Tables</h1>

      <div className="mt-5 grid min-w-0 gap-4">
        <Card>
          <h2 className="mb-3 font-semibold">Add table</h2>
          <TableForm />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Existing tables</h2>
          {tables.length === 0 ? (
            <p className="text-sm font-semibold">No tables yet. Add the first table above.</p>
          ) : (
            <div className="min-w-0 space-y-3">
              {tables.map((table) => (
                <div key={table.id} className="rounded-xl border border-zenith-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{table.name}</div>
                      <div className="text-sm text-zenith-muted">
                        {table.active ? "Active" : "Inactive"}
                        {table.inUse ? " · In use" : table.active ? " · Available" : ""}
                      </div>
                    </div>
                    <TableRow table={table} showLabel={false} />
                  </div>
                  <TableRenameForm table={table} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
