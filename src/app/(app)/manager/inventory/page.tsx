import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import {
  StockMovementWorkspace,
  type MoveKind,
} from "@/components/manager/StockMovementWorkspace";
import { StockWorkbench } from "@/components/manager/StockWorkbench";
import { PageHeader } from "@/components/ui/PageHeader";
import { listLocations, listStock, valuationFromStock } from "@/services/inventory";
import { listSuppliers } from "@/services/suppliers";

const KINDS = new Set<MoveKind>(["receive", "transfer", "count", "adjust", "waste"]);

export default async function InventoryOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; productId?: string }>;
}) {
  await requireRole("MANAGER");
  const params = await searchParams;
  const kind = (KINDS.has(params.kind as MoveKind) ? params.kind : "receive") as MoveKind;
  const [stock, locations, suppliers] = await Promise.all([
    listStock(),
    listLocations(),
    listSuppliers(),
  ]);
  const valuation = valuationFromStock(stock);

  const rows = stock.map((row) => ({
    id: row.id,
    name: row.name,
    categoryName: row.category.name,
    main: row.main,
    bar: row.bar,
    kitchen: row.kitchen,
    cafe: row.cafe,
    total: row.total,
    unitCode: row.baseUnit?.code ?? null,
    defaultLocationCode: row.defaultLocationCode,
    managerReferenceName: row.managerReferenceName,
  }));

  return (
    <div>
      <PageHeader title="Stock" subtitle="Receive, transfer, and check current levels." />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/inventory/movements">
          Stock History
        </Link>
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/inventory/packaging">
          Packaging
        </Link>
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/inventory/suppliers">
          Suppliers
        </Link>
        <Link className="rounded-lg border border-zenith-border px-3 py-1.5" href="/manager/products">
          Products
        </Link>
        <span className="self-center text-zenith-muted">Stock value: {formatRwf(valuation.total)}</span>
      </div>

      <section className="mb-6 min-w-0">
        <h2 className="mb-3 font-display text-xl text-zenith-gold">Receive / Transfer</h2>
        <StockMovementWorkspace
          kind={kind}
          productId={params.productId}
          products={stock}
          locations={locations}
          suppliers={suppliers}
        />
      </section>

      <section className="min-w-0">
        <h2 className="mb-3 font-display text-xl text-zenith-gold">Current levels</h2>
        <StockWorkbench rows={rows} />
      </section>
    </div>
  );
}
