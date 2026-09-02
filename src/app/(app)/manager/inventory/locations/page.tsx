import { requireRole } from "@/lib/auth/current-user";
import { formatRwf } from "@/lib/domain/money";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listStock } from "@/services/inventory";

export default async function StockByLocationPage() {
  await requireRole("MANAGER");
  const stock = await listStock();

  return (
    <div>
      <PageHeader
        title="Stock by Location"
        subtitle="See how much is in Main Stock, Bar, Kitchen, and Cafe."
      />
      <Card>
        <div className="overflow-x-auto text-sm">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-zenith-border text-xs uppercase tracking-wider text-zenith-muted">
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Main</th>
                <th className="py-2 pr-2">Bar</th>
                <th className="py-2 pr-2">Kitchen</th>
                <th className="py-2 pr-2">Cafe</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((product) => (
                <tr key={product.id} className="border-b border-zenith-border/70">
                  <td className="py-2 pr-2 font-semibold">{product.name}</td>
                  <td className="py-2 pr-2">
                    {product.productType === "RAW_MATERIAL"
                      ? "Stock items"
                      : product.productType === "PACKAGED_GOOD"
                        ? "Packaged"
                        : "Menu"}
                  </td>
                  <td className="py-2 pr-2">{product.main}</td>
                  <td className="py-2 pr-2">{product.bar}</td>
                  <td className="py-2 pr-2">{product.kitchen}</td>
                  <td className="py-2 pr-2">{product.cafe}</td>
                  <td className="py-2 pr-2 font-semibold">{product.total}</td>
                  <td className="py-2">{formatRwf(product.valuation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
