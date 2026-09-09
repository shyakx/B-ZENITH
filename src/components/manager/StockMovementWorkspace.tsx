"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AdjustForm,
  CountForm,
  PurchaseForm,
  TransferForm,
  WasteForm,
} from "@/components/manager/InventoryForms";
import { Card } from "@/components/ui/Card";
import { canReceiveProduct, isPourUnit } from "@/lib/domain/units";

export type MoveKind = "receive" | "transfer" | "count" | "adjust" | "waste";

type ProductOption = {
  id: string;
  name: string;
  main?: number;
  bar?: number;
  kitchen?: number;
  cafe?: number;
  total?: number;
  productType?: string;
  wholePackageTransfer?: boolean;
  baseUnit?: { id: string; code: string; name: string } | null;
  packs?: {
    unitId: string;
    baseQuantity: number;
    unit: { id: string; code: string; name: string };
  }[];
};

type LocationOption = { id: string; code: string; name: string };
type SupplierOption = { id: string; name: string; active: boolean };

const KINDS: { id: MoveKind; label: string }[] = [
  { id: "receive", label: "Receive Stock" },
  { id: "transfer", label: "Transfer Stock" },
  { id: "count", label: "Count" },
  { id: "adjust", label: "Adjust" },
  { id: "waste", label: "Waste" },
];

function tangibleProducts(products: ProductOption[]) {
  return products.filter((product) => !isPourUnit(product.baseUnit?.code ?? ""));
}

export function StockMovementWorkspace({
  kind,
  productId,
  products,
  locations,
  suppliers,
}: {
  kind: MoveKind;
  productId?: string;
  products: ProductOption[];
  locations: LocationOption[];
  suppliers: SupplierOption[];
}) {
  const stockProducts = useMemo(() => tangibleProducts(products), [products]);
  const receivable = useMemo(
    () => stockProducts.filter((row) => canReceiveProduct(row)),
    [stockProducts],
  );
  const destinations = locations.filter((location) => location.code !== "MAIN");
  const current = KINDS.find((entry) => entry.id === kind) ?? KINDS[0];
  const queryProduct = productId
    ? `&productId=${encodeURIComponent(productId)}`
    : "";

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,14rem)_1fr]">
      <Card>
        <h2 className="mb-2 font-semibold">What do you want to do?</h2>
        <div className="grid gap-1.5">
          {KINDS.map((entry) => (
            <Link
              key={entry.id}
              href={`/manager/inventory?kind=${entry.id}${queryProduct}`}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                kind === entry.id
                  ? "bg-zenith-gold text-white"
                  : "border border-zenith-border bg-white"
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">{current.label}</h2>
        {kind === "receive" ? (
          <PurchaseForm products={receivable} suppliers={suppliers} initialProductId={productId} />
        ) : null}
        {kind === "transfer" ? (
          <TransferForm
            products={stockProducts}
            destinations={destinations}
            initialProductId={productId}
          />
        ) : null}
        {kind === "count" ? (
          <CountForm products={stockProducts} locations={locations} initialProductId={productId} />
        ) : null}
        {kind === "adjust" ? (
          <AdjustForm products={stockProducts} locations={locations} initialProductId={productId} />
        ) : null}
        {kind === "waste" ? (
          <WasteForm products={stockProducts} locations={locations} initialProductId={productId} />
        ) : null}
      </Card>
    </div>
  );
}
