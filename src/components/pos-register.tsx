"use client";

/**
 * LEGACY register. Not mounted on /pos.
 * Hospitality POS is src/components/hospitality/HospitalityPos.tsx.
 * Kept in-tree for reference until a later removal phase is authorized.
 */

import { CheckCircle2, Minus, Plus, Printer, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/datetime";

type PosVariant = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: string;
};

export type PosProduct = {
  id: string;
  name: string;
  categoryId: string;
  trackInventory: boolean;
  stockQuantity: number;
  variants: PosVariant[];
};

type CartLine = {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  sellingPrice: string;
  quantity: number;
  trackInventory: boolean;
  stockQuantity: number;
};

type Category = { id: string; name: string };

function displayName(productName: string, variantName: string) {
  return variantName === "Portion" ? productName : `${productName} · ${variantName}`;
}

export function PosRegister({
  products,
  categories,
  currency,
  taxRate,
}: {
  products: PosProduct[];
  categories: Category[];
  currency: string;
  taxRate: string;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [completed, setCompleted] = useState<{ id: string; receiptNumber: string; total: string } | null>(null);
  const checkoutLock = useRef(false);
  const idempotencyKey = useRef<string | null>(null);
  const cartKey = useRef("");

  const filtered = products.filter((product) => {
    if (category !== "all" && product.categoryId !== category) return false;
    const haystack = `${product.name} ${product.variants.map((variant) => `${variant.name} ${variant.sku}`).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.sellingPrice) * item.quantity, 0),
    [cart],
  );
  const tax = subtotal * (Number(taxRate) / 100);
  const total = subtotal + tax;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function addVariant(product: PosProduct, variant: PosVariant) {
    setCart((current) => {
      const existing = current.find((line) => line.variantId === variant.id);
      const nextQuantity = (existing?.quantity ?? 0) + 1;
      if (existing) {
        return current.map((line) => (line.variantId === variant.id ? { ...line, quantity: nextQuantity } : line));
      }
      return [
        ...current,
        {
          variantId: variant.id,
          productName: product.name,
          variantName: variant.name,
          sku: variant.sku,
          sellingPrice: variant.sellingPrice,
          quantity: 1,
          trackInventory: product.trackInventory,
          stockQuantity: product.stockQuantity,
        },
      ];
    });
  }

  function changeQuantity(variantId: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => {
          if (line.variantId !== variantId) return line;
          const quantity = Math.max(0, line.quantity + delta);
          return { ...line, quantity };
        })
        .filter((line) => line.quantity > 0),
    );
  }

  async function checkout() {
    if (checkoutLock.current) return;
    if (paymentMethod === "CASH" && Number(amountPaid) < total) {
      setError("Cash received must be at least the sale total.");
      return;
    }
    const fingerprint = cart.map((line) => `${line.variantId}:${line.quantity}`).join("|");
    if (cartKey.current !== fingerprint) {
      cartKey.current = fingerprint;
      idempotencyKey.current = null;
    }
    idempotencyKey.current ??= crypto.randomUUID();
    checkoutLock.current = true;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          items: cart.map(({ variantId, quantity }) => ({ variantId, quantity })),
          paymentMethod,
          amountPaid: amountPaid || total.toFixed(2),
        }),
      });
      const result = (await response.json()) as {
        id?: string;
        receiptNumber?: string;
        total?: string;
        error?: string;
      };
      if (!response.ok || !result.id) {
        setError(result.error ?? "Unable to complete sale. Please try again.");
        return;
      }
      idempotencyKey.current = null;
      cartKey.current = "";
      setCompleted({
        id: result.id,
        receiptNumber: result.receiptNumber ?? "",
        total: result.total ?? total.toFixed(2),
      });
      setPaymentOpen(false);
      setCartOpen(false);
      setCart([]);
      router.refresh();
    } catch {
      setError("Network error. If the sale completed, do not charge again — retry to reprint the same receipt.");
    } finally {
      checkoutLock.current = false;
      setPending(false);
    }
  }

  function newSale() {
    checkoutLock.current = false;
    idempotencyKey.current = null;
    cartKey.current = "";
    setCompleted(null);
    setAmountPaid("");
    setPaymentMethod("CASH");
    setError("");
  }

  function renderCart() {
    return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b p-5">
        <ShoppingCart className="text-[#a5821d]" />
        <h1 className="text-xl font-black">Current order</h1>
        <span className="ml-auto rounded-full bg-stone-100 px-3 py-1 text-sm font-bold">{itemCount}</span>
        {cart.length > 0 && (
          <button
            onClick={() => setCart([])}
            className="min-h-11 rounded-md px-3 text-sm font-bold text-red-700 hover:bg-red-50"
          >
            Clear
          </button>
        )}
      </div>
      <div className="min-h-32 flex-1 space-y-3 overflow-y-auto p-4">
        {cart.length === 0 && <p className="py-10 text-center text-sm text-stone-500">Tap a menu item to begin.</p>}
        {cart.map((line) => (
          <div key={line.variantId} className="rounded-md border border-stone-200 p-3">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-bold">{line.productName}</p>
                {line.variantName !== "Portion" && (
                  <p className="text-xs font-semibold text-[#947313]">{line.variantName}</p>
                )}
              </div>
              <button
                aria-label={`Remove ${displayName(line.productName, line.variantName)}`}
                onClick={() => setCart((items) => items.filter((item) => item.variantId !== line.variantId))}
              >
                <Trash2 size={17} className="text-stone-400 hover:text-red-600" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="grid size-9 place-items-center rounded border" onClick={() => changeQuantity(line.variantId, -1)}>
                  <Minus size={16} />
                </button>
                <span className="w-7 text-center font-black">{line.quantity}</span>
                <button className="grid size-9 place-items-center rounded border" onClick={() => changeQuantity(line.variantId, 1)}>
                  <Plus size={16} />
                </button>
              </div>
              <p className="font-bold">{formatMoney(Number(line.sellingPrice) * line.quantity, currency, 0)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-5">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><b>{formatMoney(subtotal, currency, 0)}</b></div>
          {Number(taxRate) > 0 && (
            <div className="flex justify-between"><span>Tax ({taxRate}%)</span><b>{formatMoney(tax, currency, 0)}</b></div>
          )}
          <div className="flex justify-between border-t pt-3 text-xl">
            <span className="font-black">Total</span>
            <b>{formatMoney(total, currency, 0)}</b>
          </div>
        </div>
        {error && !paymentOpen && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <button
          type="button"
          onClick={() => {
            setError("");
            setPaymentOpen(true);
          }}
          disabled={!cart.length || pending}
          className="mt-4 min-h-14 w-full rounded-md bg-black text-lg font-black text-[#d4af37] hover:bg-stone-900 disabled:opacity-40"
        >
          {`Pay ${formatMoney(total, currency, 0)}`}
        </button>
      </div>
    </>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-5rem)] gap-5 pb-24 xl:grid-cols-[1fr_400px] xl:pb-0">
      <section className="min-w-0">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search menu or SKU"
              className="min-h-12 w-full rounded-md border border-stone-300 bg-white pl-10 pr-4 outline-none focus:border-[#b38f20]"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-h-12 rounded-md border border-stone-300 bg-white px-4 font-semibold"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-12 text-center">
            <p className="font-bold">No menu items match your search.</p>
            <p className="mt-1 text-sm text-stone-500">Try another name, SKU, or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => {
              const stockTone =
                !product.trackInventory
                  ? ""
                  : product.stockQuantity < 0
                    ? "border-red-300 bg-red-50"
                    : product.stockQuantity === 0
                      ? "border-amber-200 bg-amber-50"
                      : product.stockQuantity <= 5
                        ? "border-amber-100"
                        : "border-stone-200 bg-white";
              const single = product.variants.length === 1;
              return (
                <article
                  key={product.id}
                  className={`rounded-lg border p-4 shadow-sm ${stockTone || "border-stone-200 bg-white"}`}
                >
                  <p className="line-clamp-2 font-bold">{product.name}</p>
                  {product.trackInventory && (
                    <p className={`mt-1 text-xs font-bold ${product.stockQuantity <= 0 ? "text-red-700" : "text-stone-500"}`}>
                      Available: {product.stockQuantity}
                      {product.stockQuantity <= 0 ? " · can still order" : ""}
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => addVariant(product, variant)}
                        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-md border px-3 text-left font-bold transition hover:border-[#d4af37] ${
                          single ? "border-stone-200 bg-white/80" : "border-stone-200"
                        }`}
                      >
                        <span>{variant.name === "Portion" && single ? "Add" : variant.name}</span>
                        <span className="text-[#947313]">{formatMoney(Number(variant.sellingPrice), currency, 0)}</span>
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="hidden max-h-[calc(100vh-5rem)] flex-col rounded-lg border border-stone-200 bg-white shadow-sm xl:sticky xl:top-8 xl:flex">
        {renderCart()}
      </aside>

      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed inset-x-4 bottom-4 z-40 flex min-h-14 items-center justify-between rounded-md bg-black px-5 font-black text-[#d4af37] shadow-lg xl:hidden"
      >
        <span className="flex items-center gap-2"><ShoppingCart size={18} /> Order · {itemCount}</span>
        <span>{formatMoney(total, currency, 0)}</span>
      </button>

      {cartOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button className="absolute inset-0 bg-black/60" aria-label="Close order" onClick={() => setCartOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-xl">
            <div className="flex justify-end p-2">
              <button aria-label="Close order" onClick={() => setCartOpen(false)} className="grid size-11 place-items-center rounded-md hover:bg-stone-100">
                <X />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderCart()}</div>
          </div>
        </div>
      )}

      {paymentOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-stone-500">Total</p>
                <p className="text-3xl font-black">{formatMoney(total, currency, 0)}</p>
              </div>
              <button
                aria-label="Close payment"
                onClick={() => setPaymentOpen(false)}
                className="grid size-11 place-items-center rounded-md hover:bg-stone-100"
              >
                <X />
              </button>
            </div>
            <p className="mt-6 text-sm font-bold">Payment method</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                ["CASH", "Cash"],
                ["MOBILE_MONEY", "Mobile money"],
                ["CARD", "Card"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    setPaymentMethod(value);
                    setError("");
                  }}
                  className={`min-h-14 rounded-md border px-2 font-bold ${
                    paymentMethod === value ? "border-black bg-black text-[#d4af37]" : "border-stone-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {paymentMethod === "CASH" && (
              <div className="mt-5">
                <label className="text-sm font-bold" htmlFor="cash-received">Cash received</label>
                <input
                  id="cash-received"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  inputMode="decimal"
                  autoFocus
                  className="mt-2 min-h-12 w-full rounded-md border border-stone-300 px-4 text-lg font-bold"
                />
                <div className="mt-3 flex justify-between rounded-md bg-stone-100 p-3">
                  <span>Change</span>
                  <b>{formatMoney(Math.max(0, Number(amountPaid || 0) - total), currency, 0)}</b>
                </div>
              </div>
            )}
            {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
            <button
              type="button"
              onClick={() => void checkout()}
              disabled={pending || (paymentMethod === "CASH" && Number(amountPaid) < total)}
              className="mt-6 min-h-14 w-full rounded-md bg-black text-lg font-black text-[#d4af37] disabled:opacity-40"
            >
              {pending ? "Completing sale…" : "Complete sale"}
            </button>
          </div>
        </div>
      )}

      {completed && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-xl">
            <CheckCircle2 className="mx-auto text-green-600" size={56} />
            <h2 className="mt-4 text-2xl font-black">Sale completed</h2>
            <p className="mt-2 font-mono text-sm">{completed.receiptNumber}</p>
            <p className="mt-5 text-3xl font-black">{formatMoney(Number(completed.total), currency, 0)}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => window.open(`/print/receipt/${completed.id}?autoprint=1`, "_blank", "noopener,noreferrer")}
                className="flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-black font-bold"
              >
                <Printer size={19} /> Print receipt
              </button>
              <button onClick={newSale} className="min-h-12 rounded-md bg-black font-bold text-[#d4af37]">
                New sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
