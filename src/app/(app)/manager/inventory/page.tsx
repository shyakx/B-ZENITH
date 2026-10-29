import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import {
  StockMovementWorkspace,
  type MoveKind,
} from "@/components/manager/StockMovementWorkspace";
import { StockWorkbench } from "@/components/manager/StockWorkbench";
import { PageHeader } from "@/components/ui/PageHeader";
import { canReceiveProduct, transferUnitChoicesForProduct } from "@/lib/domain/units";
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
    canReceive: canReceiveProduct(row),
    canTransfer: transferUnitChoicesForProduct(row).length > 0,
    defaultLocationCode: row.defaultLocationCode,
    managerReferenceName: row.managerReferenceName,
  }));
  const outOfStock = rows.filter((row) => row.total === 0).length;
  const lowStock = rows.filter((row) => row.total > 0 && row.total <= 5).length;

  return (
    <div>
      <PageHeader title="Stock" subtitle="Receive, transfer, and check current levels." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <PageHeaderStat label="Tracked items" value={String(rows.length)} hint="Available in stock workspace" />
        <PageHeaderStat label="Out of stock" value={String(outOfStock)} hint="Need receiving or review" />
        <PageHeaderStat label="Low stock" value={String(lowStock)} hint="1 to 5 units remaining" />
      </div>

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

function PageHeaderStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-zenith-border bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zenith-gold">{value}</div>
      <div className="mt-1 text-sm text-zenith-muted">{hint}</div>
    </div>
  );
}
