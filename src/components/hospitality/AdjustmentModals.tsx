"use client";

import { X, AlertTriangle, RefreshCw, Trash2, ArrowLeftRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ItemCondition } from "@prisma/client";

export type ManagerApprovalInput = { managerUserId: string; managerPin: string };

type Approver = { id: string; name: string; role: string };

export function ManagerApprovalFields({
  managerUserId,
  managerPin,
  onChange,
}: {
  managerUserId: string;
  managerPin: string;
  onChange: (next: ManagerApprovalInput) => void;
}) {
  const [approvers, setApprovers] = useState<Approver[]>([]);

  useEffect(() => {
    fetch("/api/staff?approvers=1")
      .then((res) => res.json())
      .then((rows) => {
        if (Array.isArray(rows)) setApprovers(rows);
      })
      .catch(() => setApprovers([]));
  }, []);

  return (
    <div className="space-y-3 rounded-md border border-black bg-white p-3">
      <p className="text-xs font-medium tracking-[0.16em] text-black">Manager approval required</p>
      <label className="block text-xs font-medium tracking-[0.16em] text-black">
        Approving manager
        <select
          value={managerUserId}
          onChange={(event) => onChange({ managerUserId: event.target.value, managerPin })}
          className="bz-input mt-2 font-medium"
        >
          <option value="">Select manager…</option>
          {approvers.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium tracking-[0.16em] text-black">
        Manager PIN
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={managerPin}
          maxLength={4}
          onChange={(event) => onChange({ managerUserId, managerPin: event.target.value.replace(/\D/g,"").slice(0, 4) })}
          className="bz-input mt-2 min-h-14 text-center text-2xl font-semibold tracking-[0.5em]"
          placeholder="••••"
        />
      </label>
    </div>
  );
}

interface VoidModalProps {
    itemId: string;
    onClose: () => void;
    onConfirm: (reason: string, approval: ManagerApprovalInput) => Promise<void>;
}

export function VoidModal({ itemId, onClose, onConfirm }: VoidModalProps) {
    const [reason, setReason] = useState("");
    const [approval, setApproval] = useState<ManagerApprovalInput>({ managerUserId:"", managerPin:"" });
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");

    const handleConfirm = async () => {
        if (reason.length < 3 || !approval.managerUserId || approval.managerPin.length !== 4) {
            setError("Reason and manager approval are required.");
            return;
        }
        setIsProcessing(true);
        setError("");
        try {
            await onConfirm(reason, approval);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message :"Void failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black p-4">
            <div className="w-full max-w-md rounded-md bg-white p-6 border border-black">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="flex items-center gap-2 text-xl font-semibold text-black">
                        <Trash2 size={20} /> VOID ITEM
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-black" /></button>
                </div>

                <div className="mb-6 rounded-lg bg-black p-4 text-sm text-white flex gap-3">
                    <AlertTriangle className="shrink-0" size={20} />
                    <p>Voiding will restore stock to the original location. <b>Manager approval is required.</b></p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-black">Reason for Void</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="mt-2 w-full rounded-md border-2 border-black p-3 outline-none focus:border-[#FFD758] h-24 resize-none"
                            placeholder="e.g., Customer changed mind, Kitchen mistake..."
                        />
                    </div>

                    <ManagerApprovalFields managerUserId={approval.managerUserId} managerPin={approval.managerPin} onChange={setApproval} />

                    {error && <p className="bz-alert">{error}</p>}

                    <button
                        disabled={isProcessing}
                        onClick={handleConfirm}
                        className="bz-btn-primary flex w-full items-center justify-center gap-2"
                    >
                        {isProcessing ?"PROCESSING..." :"CONFIRM VOID"}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ReturnModalProps {
    itemId: string;
    onClose: () => void;
    onConfirm: (data: { quantity: number; reason: string; condition: ItemCondition } & ManagerApprovalInput) => Promise<void>;
}

export function ReturnModal({ itemId, onClose, onConfirm }: ReturnModalProps) {
    const [reason, setReason] = useState("");
    const [condition, setCondition] = useState<ItemCondition>(ItemCondition.RESELLABLE);
    const [approval, setApproval] = useState<ManagerApprovalInput>({ managerUserId:"", managerPin:"" });
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");

    const handleConfirm = async () => {
        if (reason.length < 3 || !approval.managerUserId || approval.managerPin.length !== 4) {
            setError("Reason and manager approval are required.");
            return;
        }
        setIsProcessing(true);
        setError("");
        try {
            await onConfirm({ quantity: 1, reason, condition, ...approval });
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message :"Return failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black p-4">
            <div className="w-full max-w-md rounded-md bg-white p-6 border border-black">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="flex items-center gap-2 text-xl font-semibold text-black">
                        <RefreshCw size={20} /> RETURN ITEM
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-black" /></button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-black">Item Condition</label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {Object.values(ItemCondition).map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCondition(c)}
                                    className={`min-h-11 rounded-md border px-3 py-2 text-[10px] font-medium uppercase ${
                                        condition === c
                                            ?"border-black bg-[#FFD758] text-black"
                                            :"border-black bg-white text-black"
                                    }`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-[10px] text-black italic">
                            {condition === 'RESELLABLE' ?"Stock will be restored." :"Stock will be recorded as WASTE."}
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-black">Reason for Return</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="mt-2 w-full rounded-md border-2 border-black p-3 outline-none focus:border-black h-24 resize-none"
                            placeholder="e.g., Wrong item served, Bad quality..."
                        />
                    </div>

                    <ManagerApprovalFields managerUserId={approval.managerUserId} managerPin={approval.managerPin} onChange={setApproval} />

                    {error && <p className="bz-alert">{error}</p>}

                    <button
                        disabled={isProcessing}
                        onClick={handleConfirm}
                        className="bz-btn-primary flex w-full items-center justify-center gap-2"
                    >
                        {isProcessing ?"PROCESSING..." :"CONFIRM RETURN"}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface HandoverModalProps {
    sessionId: string;
    currentWaiterName: string;
    onClose: () => void;
    onConfirm: (data: { newWaiterId: string; reason: string } & ManagerApprovalInput) => Promise<void>;
}

export function HandoverModal({ sessionId, currentWaiterName, onClose, onConfirm }: HandoverModalProps) {
    const [newWaiterId, setNewWaiterId] = useState("");
    const [approval, setApproval] = useState<ManagerApprovalInput>({ managerUserId:"", managerPin:"" });
    const [reason, setReason] = useState("");
    const [waiters, setWaiters] = useState<Array<{ id: string; name: string }>>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/staff?role=WAITER")
          .then((res) => res.json())
          .then((rows) => {
            if (Array.isArray(rows)) setWaiters(rows);
          })
          .catch(() => setWaiters([]));
    }, []);

    const handleConfirm = async () => {
        if (!newWaiterId || reason.length < 3 || !approval.managerUserId || approval.managerPin.length !== 4) {
            setError("Please complete all fields.");
            return;
        }
        setIsProcessing(true);
        setError("");
        try {
            await onConfirm({ newWaiterId, reason, ...approval });
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message :"Handover failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black p-4">
            <div className="w-full max-w-md rounded-md bg-white p-6 border border-black">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="flex items-center gap-2 text-xl font-semibold text-black">
                        <ArrowLeftRight size={20} /> SESSION HANDOVER
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-black" /></button>
                </div>

                <div className="space-y-6">
                    <div>
                        <p className="text-xs font-bold text-black uppercase tracking-widest">Current Waiter</p>
                        <p className="text-lg font-semibold">{currentWaiterName}</p>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-black">Transfer To</label>
                        <select
                            value={newWaiterId}
                            onChange={(e) => setNewWaiterId(e.target.value)}
                            className="bz-input mt-2 font-medium"
                        >
                            <option value="">Select New Waiter...</option>
                            {waiters.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-black">Reason</label>
                        <input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="bz-input mt-2 font-medium"
                            placeholder="e.g., Shift end, Break..."
                        />
                    </div>

                    <ManagerApprovalFields managerUserId={approval.managerUserId} managerPin={approval.managerPin} onChange={setApproval} />

                    {error && <p className="bz-alert">{error}</p>}

                    <button
                        disabled={isProcessing}
                        onClick={handleConfirm}
                        className="bz-btn-primary flex w-full items-center justify-center gap-2"
                    >
                        {isProcessing ?"PROCESSING..." :"CONFIRM HANDOVER"}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ExchangeModalProps {
    originalItem: any;
    products: any[];
    onClose: () => void;
    onConfirm: (data: { replacement: any; reason: string; condition: ItemCondition } & ManagerApprovalInput) => Promise<void>;
}

export function ExchangeModal({ originalItem, products, onClose, onConfirm }: ExchangeModalProps) {
    const [reason, setReason] = useState("");
    const [condition, setCondition] = useState<ItemCondition>(ItemCondition.RESELLABLE);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [selectedVariant, setSelectedProductVariant] = useState<any>(null);
    const [approval, setApproval] = useState<ManagerApprovalInput>({ managerUserId:"", managerPin:"" });
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");

    const handleConfirm = async () => {
        if (!selectedProduct || !selectedVariant || reason.length < 3 || !approval.managerUserId || approval.managerPin.length !== 4) {
            setError("Please complete all fields.");
            return;
        }
        setIsProcessing(true);
        setError("");
        try {
            await onConfirm({
                replacement: {
                    productId: selectedProduct.id,
                    variantId: selectedVariant.id,
                    quantity: 1,
                    unitPrice: Number(selectedVariant.sellingPrice)
                },
                reason,
                condition,
                ...approval,
            });
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message :"Exchange failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black p-4">
            <div className="w-full max-w-lg rounded-md bg-white p-6 border border-black max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="flex items-center gap-2 text-xl font-semibold text-black">
                        <ArrowLeftRight size={20} /> EXCHANGE ITEM
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-black" /></button>
                </div>

                <div className="space-y-6">
                    <div className="rounded-lg bg-white p-4 border border-dashed">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-black">Original Item</p>
                        <p className="font-bold">{originalItem.product.name} ({originalItem.productVariant?.name ||"Portion"})</p>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-black">Replacement Product</label>
                        <select
                            onChange={(e) => {
                                const p = products.find(p => p.id === e.target.value);
                                setSelectedProduct(p);
                                setSelectedProductVariant(p?.variants[0] || null);
                            }}
                            className="bz-input mt-2 font-medium"
                        >
                            <option value="">Select Replacement...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        {selectedProduct && (
                            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                                {selectedProduct.variants.map((v: any) => (
                                    <button
                                        key={v.id}
                                        onClick={() => setSelectedProductVariant(v)}
                                        className={`min-h-11 px-3 py-2 rounded-lg border-2 text-[10px] font-semibold uppercase whitespace-nowrap ${
                                            selectedVariant?.id === v.id
                                                ?"border-black bg-[#FFD758] text-black"
                                                :"border-black bg-white text-black"
                                        }`}
                                    >
                                        {v.name} · {v.sellingPrice}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-black">Returned Condition</label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {Object.values(ItemCondition).map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCondition(c)}
                                    className={`min-h-11 px-3 py-2 rounded-lg border-2 text-[10px] font-semibold uppercase transition-all ${
                                        condition === c
                                            ?"border-black bg-[#FFD758] text-black"
                                            :"border-black bg-white text-black"
                                    }`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-widest text-black">Reason</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="mt-2 h-20 w-full resize-none rounded-md border border-black p-3 outline-none focus:border-[#FFD758]"
                            placeholder="Reason for exchange..."
                        />
                    </div>

                    <ManagerApprovalFields managerUserId={approval.managerUserId} managerPin={approval.managerPin} onChange={setApproval} />

                    {error && <p className="bz-alert">{error}</p>}

                    <button
                        disabled={isProcessing}
                        onClick={handleConfirm}
                        className="bz-btn-primary flex w-full items-center justify-center gap-2"
                    >
                        {isProcessing ?"PROCESSING..." :"CONFIRM EXCHANGE"}
                    </button>
                </div>
            </div>
        </div>
    );
}
