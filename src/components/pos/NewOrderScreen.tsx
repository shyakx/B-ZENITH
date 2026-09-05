"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { createOrderAction } from "@/actions/orders";
import { formatRwf, sumLineTotals } from "@/lib/domain/money";
import { clearDraftOrderKey, getOrCreateDraftOrderKey } from "@/lib/domain/order-draft-key";
import { Button } from "@/components/ui/Button";
import { CategoryPicker } from "@/components/pos/CategoryPicker";
import { PrintSlipLink } from "@/components/print/PrintFactureLink";

type Product = {
  id: string;
  name: string;
  sellingPrice: number;
  category: { id: string; name: string };
};

type Table = { id: string; name: string };
type Category = { id: string; name: string };
type Line = { product: Product; quantity: number };

export function NewOrderScreen({
  tables,
  products,
  categories,
  initialTableId,
  initialLines,
}: {
  tables: Table[];
  products: Product[];
  categories: Category[];
  initialTableId?: string;
  initialLines?: Line[];
}) {
  const [step, setStep] = useState<"table" | "menu" | "review" | "done">(
    initialTableId ? "menu" : "table",
  );
  const [tableId, setTableId] = useState(initialTableId ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>(initialLines ?? []);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [submitted, setSubmitted] = useState<{
    id: string;
    orderNumber: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    setKey(getOrCreateDraftOrderKey());
  }, []);

  const table = tables.find((item) => item.id === tableId);
  const visible = useMemo(() => {
    return products.filter((product) => {
      const categoryOk = !categoryId || product.category.id === categoryId;
      const queryOk = product.name.toLowerCase().includes(query.toLowerCase());
      return query ? queryOk : categoryOk;
    });
  }, [products, categoryId, query]);

  const selectedCategory = categories.find((category) => category.id === categoryId);

  const total = sumLineTotals(
    cart.map((line) => ({ unitPrice: line.product.sellingPrice, quantity: line.quantity })),
  );

  function chooseTable(id: string) {
    setTableId(id);
    setStep("menu");
  }

  function add(product: Product) {
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      if (found) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function setQty(productId: string, quantity: number) {
    setCart((current) =>
      quantity <= 0
        ? current.filter((line) => line.product.id !== productId)
        : current.map((line) => (line.product.id === productId ? { ...line, quantity } : line)),
    );
  }

  async function submit() {
    setError("");
    if (!tableId || cart.length === 0) {
      setError("Select a table and add products first.");
      return;
    }
    const idempotencyKey = key || getOrCreateDraftOrderKey();
    if (!idempotencyKey) {
      setError("Missing order key. Please try again.");
      return;
    }
    setKey(idempotencyKey);
    setBusy(true);
    const result = await createOrderAction({
      tableId,
      items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      note,
      idempotencyKey,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    clearDraftOrderKey();
    setSubmitted({ id: result.data.id, orderNumber: result.data.orderNumber, total });
    setStep("done");
  }

  if (step === "done" && submitted) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-lg rounded-xl border border-zenith-border bg-white p-5 text-center sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zenith-muted">Submitted</p>
        <h2 className="mt-2 break-words font-display text-2xl text-zenith-gold sm:text-3xl">
          ORDER #{submitted.orderNumber}
        </h2>
        <p className="mt-4 text-lg">Table {table?.name}</p>
        <p className="mt-1 text-2xl font-semibold text-zenith-gold">{formatRwf(submitted.total)}</p>
        <div className="mt-8 grid gap-3">
          <PrintSlipLink href={`/print/slip/order/${submitted.id}`} className="w-full" />
          <Link href="/waiter/orders/new">
            <Button className="w-full">+ New order</Button>
          </Link>
          <Link href="/waiter/orders">
            <Button variant="secondary" className="w-full">
              My orders
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (step === "table") {
    return (
      <div className="order-page">
        <h2 className="mb-2 font-display text-2xl">Select table</h2>
        <p className="mb-5 text-sm text-zenith-muted">Any waiter can serve any table.</p>
        <div className="order-tables">
          {tables.map((item) => (
            <button
              key={item.id}
              onClick={() => chooseTable(item.id)}
              className="min-h-20 min-w-0 break-words rounded-xl border-2 border-zenith-border bg-white px-2 py-3 text-base font-semibold leading-snug sm:text-lg hover:border-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold"
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="mx-auto w-full min-w-0 max-w-lg">
        <button className="mb-4 min-h-11 font-semibold text-zenith-gold" onClick={() => setStep("menu")}>
          ← Back to menu
        </button>
        <div className="rounded-xl border border-zenith-border bg-white p-4 sm:p-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-zenith-muted">Review</p>
          <h2 className="mt-1 break-words font-display text-2xl">Table {table?.name}</h2>
          <ul className="mt-6 space-y-3 text-lg">
            {cart.map((line) => (
              <li key={line.product.id} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">
                  {line.product.name} × {line.quantity}
                </span>
                <span className="shrink-0 font-semibold">
                  {formatRwf(line.product.sellingPrice * line.quantity)}
                </span>
              </li>
            ))}
          </ul>
          {note ? <p className="mt-4 text-sm break-words text-zenith-muted">Note: {note}</p> : null}
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2 font-display text-2xl">
            <span>Total</span>
            <span className="text-zenith-gold">{formatRwf(total)}</span>
          </div>
          {error ? <p className="mt-4 text-zenith-danger">{error}</p> : null}
          <Button className="pos-tap mt-6 h-12 w-full text-base" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit order"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="order-page">
      <div className="order-workspace">
        <section className="order-card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => setStep("table")}
              className="pos-tap min-h-12 shrink-0 rounded-xl bg-zenith-gold px-5 py-3 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold"
            >
              Table {table?.name}
            </button>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search menu"
              className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-zenith-border px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold"
            />
          </div>

          <CategoryPicker
            categories={categories}
            selectedId={categoryId}
            onSelect={(id) => {
              setCategoryId(id);
              setQuery("");
            }}
          />

          {selectedCategory && !query ? (
            <h3 className="mb-3 font-display text-2xl text-zenith-gold">{selectedCategory.name}</h3>
          ) : null}

          <div className="order-products">
            {visible.map((product) => (
              <button
                key={product.id}
                onClick={() => add(product)}
                className="order-card flex min-h-20 flex-col rounded-xl border-2 border-zenith-border bg-white p-2.5 text-left hover:border-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold sm:min-h-[5.5rem] sm:p-3"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-zenith-muted">
                  {product.category.name}
                </div>
                <div className="mt-1 text-base font-semibold leading-snug sm:text-lg">{product.name}</div>
                <div className="mt-auto pt-3 text-base font-semibold text-zenith-gold">
                  {formatRwf(product.sellingPrice)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="order-card order-basket rounded-xl border border-zenith-border bg-white p-3">
          <div className="order-basket-head mb-2">
            <h2 className="font-display text-xl leading-tight">Order</h2>
            <p className="text-sm font-semibold text-zenith-gold">Table {table?.name}</p>
          </div>
          <div className="order-basket-items">
            {cart.length === 0 ? (
              <p className="text-zenith-muted">Tap a product to add it.</p>
            ) : (
              cart.map((line) => (
                <div key={line.product.id} className="order-line rounded-xl bg-zenith-surface">
                  <div className="order-line-name text-sm font-semibold leading-snug">{line.product.name}</div>
                  <div className="order-line-qty">
                    <button
                      onClick={() => setQty(line.product.id, line.quantity - 1)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                    <button
                      onClick={() => setQty(line.product.id, line.quantity + 1)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="order-line-price text-sm font-semibold">
                    {formatRwf(line.product.sellingPrice * line.quantity)}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="order-basket-foot border-t border-zenith-border pt-2">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note (optional)"
              className="w-full min-w-0 rounded-xl border border-zenith-border px-3 py-1.5 text-sm"
              rows={1}
            />
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 font-display text-xl">
              <span>Total</span>
              <span className="text-zenith-gold">{formatRwf(total)}</span>
            </div>
            {error ? <p className="mt-2 text-sm text-zenith-danger">{error}</p> : null}
            <Button
              variant="secondary"
              className="mt-2 w-full"
              disabled={cart.length === 0}
              onClick={() => setCart([])}
            >
              Clear order
            </Button>
            <div className="mt-2">
              <Button className="pos-tap mt-2 h-12 w-full" disabled={cart.length === 0} onClick={() => setStep("review")}>
                Review & submit
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <div className="order-sticky-bar sticky bottom-0 z-10 mt-4 border-t border-zenith-border bg-white py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 font-display text-xl">
          <span>Total</span>
          <span className="text-zenith-gold">{formatRwf(total)}</span>
        </div>
        <Button className="pos-tap mt-3 h-12 w-full" disabled={cart.length === 0} onClick={() => setStep("review")}>
          Review & submit
        </Button>
      </div>
    </div>
  );
}
