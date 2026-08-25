"use client";

import {
  ShoppingCart,
  Search,
  Trash2,
  Plus,
  Minus,
  ChevronRight,
  Clock,
  User,
  History,
  Send,
  CreditCard,
  UserPlus,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
  PosProduct,
  PosVariant,
  Category,
  SessionInfo
} from "./types";
import { formatMoney } from "@/lib/datetime";
import { ItemStatus, FulfillmentStatus } from "@prisma/client";

interface SessionInterfaceProps {
  session: SessionInfo;
  products: PosProduct[];
  categories: Category[];
  currency: string;
  taxRate: string;
  onPostOrder: (items: DraftItem[]) => Promise<void>;
  onSettlement: () => void;
  onHandover: () => void;
  onVoidItem: (itemId: string) => void;
  onReturnItem: (itemId: string) => void;
  onExchangeItem: (itemId: string) => void;
  onUpdateFulfillment: (itemId: string, status: FulfillmentStatus) => void;
  onBack: () => void;
}

interface DraftItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
}

export function SessionInterface({
  session,
  products,
  categories,
  currency,
  taxRate,
  onPostOrder,
  onSettlement,
  onHandover,
  onVoidItem,
  onReturnItem,
  onExchangeItem,
  onUpdateFulfillment: _onUpdateFulfillment,
  onBack,
}: SessionInterfaceProps) {
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState("");
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});

  const [sessionRounds, setSessionRounds] = useState<any[]>([]);

  useEffect(() => {
    const fetchSessionDetails = async () => {
        try {
            const res = await fetch(`/api/sessions/${session.id}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.rounds) {
                setSessionRounds(data.rounds);
                if (data.rounds.length > 0) {
                    setExpandedRounds(prev => ({ ...prev, [data.rounds[0].id]: true }));
                }
            }
        } catch (err) {
            console.error("Failed to fetch session details", err);
        }
    };
    fetchSessionDetails();
  }, [session.id]);

  const filteredProducts = products.filter((product) => {
    if (category !== "all" && product.categoryId !== category) return false;
    const haystack = `${product.name} ${product.variants.map((v) => `${v.name} ${v.sku}`).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const draftTotal = useMemo(
    () => draft.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [draft]
  );

  const addVariant = (product: PosProduct, variant: PosVariant) => {
    setDraft((current) => {
      const existing = current.find((line) => line.variantId === variant.id);
      if (existing) {
        return current.map((line) =>
          line.variantId === variant.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          variantId: variant.id,
          name: product.name,
          variantName: variant.name,
          quantity: 1,
          unitPrice: Number(variant.sellingPrice),
        },
      ];
    });
  };

  const updateDraftQty = (variantId: string | undefined, delta: number) => {
    setDraft((current) =>
      current
        .map((line) => {
          if (line.variantId !== variantId) return line;
          return { ...line, quantity: Math.max(0, line.quantity + delta) };
        })
        .filter((line) => line.quantity > 0)
    );
  };

  const handlePost = async () => {
    if (draft.length === 0 || isPosting) return;
    setIsPosting(true);
    setError("");
    try {
      await onPostOrder(draft);
      setDraft([]);
      // Refresh rounds
      const res = await fetch(`/api/sessions/${session.id}`);
      const data = await res.json();
      if (data.rounds) setSessionRounds(data.rounds);
    } catch (err: any) {
      setError(err.message || "Failed to post order.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden overflow-x-hidden lg:flex-row">
      {/* LEFT: Product Browser */}
      <section className="flex min-h-0 flex-1 flex-col border-r bg-stone-50 p-4 lg:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <button onClick={onBack} className="min-h-11 text-sm font-bold text-[#947313]">← Back to Dashboard</button>
            <button onClick={onHandover} className="flex min-h-11 items-center gap-2 rounded-md border bg-white px-3 text-sm font-bold hover:bg-stone-50">
                <UserPlus size={16} /> Handover
            </button>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="h-11 w-full rounded-lg border bg-white pl-10 pr-4 outline-none focus:border-[#d4af37]"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 rounded-lg border bg-white px-4 font-semibold outline-none focus:border-[#d4af37]"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <div key={product.id} className="flex flex-col rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="line-clamp-2 font-bold">{product.name}</h3>
                <div className="mt-auto pt-3 space-y-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => addVariant(product, variant)}
                      className="flex min-h-12 w-full items-center justify-between rounded-md border border-stone-100 bg-stone-50 px-3 py-3 text-sm font-bold hover:border-[#d4af37] hover:bg-white"
                    >
                      <span className="text-stone-600">{variant.name === "Portion" ? "Add" : variant.name}</span>
                      <span className="text-[#947313]">{formatMoney(Number(variant.sellingPrice), currency, 0)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RIGHT: Session Panel */}
      <aside className="flex max-h-[48vh] w-full shrink-0 flex-col border-t bg-white shadow-2xl lg:max-h-none lg:w-[420px] lg:border-t-0 xl:w-[450px]">
        {/* Session Header */}
        <div className="border-b p-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                {session.channel}
              </span>
              <h2 className="text-xl font-black">
                {session.table ? session.table.name : session.destinationLabel || "Service Session"}
              </h2>
            </div>
            <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                    session.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                    {session.status}
                </span>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs text-stone-500">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><User size={12} /> Current waiter</span>
              <span className="font-bold text-stone-700">{session.waiter.name}</span>
            </div>
            {session.customerName && (
              <div className="flex justify-between"><span>Guest</span><span className="font-bold text-stone-700">{session.customerName}</span></div>
            )}
            {session.customerPhone && (
              <div className="flex justify-between"><span>Phone</span><span className="font-bold text-stone-700">{session.customerPhone}</span></div>
            )}
            {session.deliveryAddress && (
              <p className="break-words font-bold text-stone-700">{session.deliveryAddress}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><Clock size={12} /> Opened</span>
              <span>{new Date(session.openedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Persisted Rounds */}
        <div className="flex-1 overflow-y-auto bg-stone-50 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-stone-500">
                <History size={16} /> Order History
            </h3>

            {sessionRounds.length === 0 ? (
                <div className="py-10 text-center text-sm text-stone-400">No items posted yet.</div>
            ) : (
                <div className="space-y-4">
                    {sessionRounds.map((round, idx) => (
                        <div key={round.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                            <button
                                onClick={() => setExpandedRounds(prev => ({ ...prev, [round.id]: !prev[round.id] }))}
                                className="flex w-full items-center justify-between bg-stone-100/50 p-3 text-left font-bold"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="grid size-6 place-items-center rounded-full bg-stone-200 text-xs">
                                        {sessionRounds.length - idx}
                                    </span>
                                    <span>Round {sessionRounds.length - idx}</span>
                                    <span className="text-[10px] font-normal text-stone-500">
                                        by {round.postedBy.name} · {new Date(round.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                {expandedRounds[round.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {expandedRounds[round.id] && (
                                <div className="divide-y p-3">
                                    {round.items.map((item: any) => (
                                        <div key={item.id} className="py-2 group">
                                            <div className="flex justify-between">
                                                <div>
                                                    <p className="font-bold text-sm">
                                                        {item.qty} × {item.product.name}
                                                        {item.productVariant && ` (${item.productVariant.name})`}
                                                    </p>
                                                    <div className="flex gap-2 items-center mt-1">
                                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                            item.status === ItemStatus.ACTIVE ? 'bg-blue-50 text-blue-600' :
                                                            item.status === ItemStatus.VOIDED ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-600'
                                                        }`}>
                                                            {item.status}
                                                        </span>
                                                        <span className="text-[9px] text-stone-400">
                                                            {item.fulfillmentStatus}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold">{formatMoney(item.qty * Number(item.unitPrice), currency, 0)}</p>
                                                    {item.status === ItemStatus.ACTIVE && (
                                                        <div className="mt-2 flex flex-wrap justify-end gap-1">
                                                            <button onClick={() => onVoidItem(item.id)} className="min-h-11 rounded-md border border-red-200 px-2 text-xs font-bold text-red-700">Void</button>
                                                            <button onClick={() => onReturnItem(item.id)} className="min-h-11 rounded-md border border-amber-200 px-2 text-xs font-bold text-amber-700">Return</button>
                                                            <button onClick={() => onExchangeItem(item.id)} className="min-h-11 rounded-md border border-stone-200 px-2 text-xs font-bold text-stone-700">Exchange</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Draft Items */}
        {draft.length > 0 && (
            <div className="border-t border-[#d4af37]/30 bg-[#fffbeb] p-5 shadow-inner">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#a5821d]">
                        <ShoppingCart size={16} /> Current Draft
                    </h3>
                    <button onClick={() => setDraft([])} className="text-xs font-bold text-red-600">Clear</button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-3 mb-4">
                    {draft.map((item) => (
                        <div key={item.variantId} className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-sm font-bold">{item.name}</p>
                                {item.variantName && item.variantName !== "Portion" && (
                                    <p className="text-[10px] text-[#947313]">{item.variantName}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => updateDraftQty(item.variantId, -1)} className="grid size-11 place-items-center rounded border border-[#d4af37] bg-white text-[#a5821d]">
                                        <Minus size={14} />
                                    </button>
                                    <span className="w-6 text-center text-sm font-black">{item.quantity}</span>
                                    <button onClick={() => updateDraftQty(item.variantId, 1)} className="grid size-11 place-items-center rounded border border-[#d4af37] bg-white text-[#a5821d]">
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <span className="w-20 text-right text-sm font-bold">
                                    {formatMoney(item.quantity * item.unitPrice, currency, 0)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                {error && <p className="mb-3 text-xs font-bold text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
                <button
                    disabled={isPosting}
                    onClick={handlePost}
                    className="flex w-full min-h-12 items-center justify-center gap-2 rounded-lg bg-[#d4af37] font-black text-black shadow-md hover:bg-[#c49f2d] disabled:opacity-50"
                >
                    <Send size={18} /> {isPosting ? "Posting Order..." : "POST ORDER"}
                </button>
            </div>
        )}

        {/* Settlement Area */}
        <div className="border-t p-5 bg-white">
            <div className="mb-4 space-y-1">
                <div className="flex justify-between text-sm text-stone-500">
                    <span>Session Total</span>
                    <span>{formatMoney(session.totalAmount, currency, 0)}</span>
                </div>
                <div className="flex justify-between text-xl font-black">
                    <span>Total Due</span>
                    <span>{formatMoney(session.totalAmount + draftTotal, currency, 0)}</span>
                </div>
            </div>

            <button
                onClick={onSettlement}
                disabled={draft.length > 0}
                className="flex w-full min-h-14 items-center justify-center gap-3 rounded-lg bg-black font-black text-[#d4af37] shadow-lg hover:bg-stone-900 disabled:opacity-50"
            >
                <CreditCard size={20} /> REQUEST SETTLEMENT
            </button>
            {draft.length > 0 && (
                <p className="mt-2 text-center text-[10px] font-bold text-stone-400">
                    Post draft items before settlement.
                </p>
            )}
        </div>
      </aside>
    </div>
  );
}
