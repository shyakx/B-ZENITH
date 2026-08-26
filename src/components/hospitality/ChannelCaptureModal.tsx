"use client";

import { useState } from "react";
import { ServiceChannel } from "@prisma/client";
import { X } from "lucide-react";

export type ChannelCaptureValues = {
  destinationLabel?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
};

const COPY: Record<
  Exclude<ServiceChannel,"TABLE">,
  { title: string; destinationPlaceholder?: string; destinationRequired?: boolean; guestOptional?: boolean; delivery?: boolean }
> = {
  WALK_IN: {
    title:"Walk-in",
    destinationPlaceholder:"Bar, lounge, patio…",
    guestOptional: true,
  },
  COUNTER: {
    title:"Counter",
    destinationPlaceholder:"Bar Seat 1, Patio, Counter 3",
    destinationRequired: true,
  },
  ACCOMMODATION: {
    title:"Accommodation",
    destinationPlaceholder:"Room 204",
    destinationRequired: true,
    guestOptional: true,
  },
  DELIVERY: {
    title:"Delivery",
    delivery: true,
  },
  TAKEAWAY: {
    title:"Takeaway",
    destinationPlaceholder:"Pickup name or ticket",
    destinationRequired: true,
    guestOptional: true,
  },
};

export function ChannelCaptureModal({
  channel,
  onCancel,
  onConfirm,
}: {
  channel: Exclude<ServiceChannel,"TABLE">;
  onCancel: () => void;
  onConfirm: (values: ChannelCaptureValues) => Promise<void>;
}) {
  const copy = COPY[channel];
  const [destinationLabel, setDestinationLabel] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (skipOptional: boolean) => {
    if (busy) return;
    setError("");
    const values: ChannelCaptureValues = skipOptional
      ? {}
      : {
          destinationLabel: destinationLabel.trim() || undefined,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          deliveryAddress: deliveryAddress.trim() || undefined,
        };
    if (!skipOptional && copy.destinationRequired && !values.destinationLabel) {
      setError("Enter a destination.");
      return;
    }
    if (!skipOptional && copy.delivery) {
      if (!values.customerName || !values.customerPhone || !values.deliveryAddress) {
        setError("Delivery needs name, phone, and address.");
        return;
      }
    }
    setBusy(true);
    try {
      await onConfirm(values);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message :"Could not start session.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black p-4">
      <div className="w-full max-w-md overflow-y-auto rounded-md bg-white p-6 border border-black max-h-[90vh]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{copy.title}</h2>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 hover:border hover:border-black" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          {(copy.destinationPlaceholder || copy.destinationRequired) && (
            <label className="block text-sm font-bold">
              {channel ==="ACCOMMODATION" ?"Room" :"Destination"}
              <input
                value={destinationLabel}
                onChange={(event) => setDestinationLabel(event.target.value)}
                placeholder={copy.destinationPlaceholder}
                className="bz-input mt-1 h-12"
              />
            </label>
          )}
          {(copy.guestOptional || copy.delivery) && (
            <label className="block text-sm font-bold">
              Guest name
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="bz-input mt-1 h-12"
              />
            </label>
          )}
          {copy.delivery && (
            <>
              <label className="block text-sm font-bold">
                Phone
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className="bz-input mt-1 h-12"
                />
              </label>
              <label className="block text-sm font-bold">
                Delivery address
                <textarea
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  rows={3}
                  className="bz-input mt-1"
                />
              </label>
            </>
          )}
        </div>
        {error && <p className="bz-alert mt-3">{error}</p>}
        <div className="mt-6 grid gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(false)}
            className="bz-btn-primary min-h-14 disabled:border-2 disabled:border-dashed"
          >
            {busy ?"Starting…" :"START SESSION"}
          </button>
          {channel ==="WALK_IN" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => submit(true)}
              className="min-h-12 rounded-md border font-bold"
            >
              Skip details
            </button>
          )}
          <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 text-sm font-bold text-black">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
