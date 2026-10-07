import { requireRole } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { TableForm } from "@/components/manager/ProductForm";
import { TableDirectory } from "@/components/manager/FilterableDirectories";
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
          <TableDirectory tables={tables} />
        </Card>
      </div>
    </div>
  );
}
