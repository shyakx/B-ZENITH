"use client";

import { nextPinValue } from "@/lib/domain/pin-input";

export { nextPinValue };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"];

export function PinKeypad({
  onKey,
  compact = false,
}: {
  onKey: (key: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKey(key)}
          className={`rounded-xl border-2 border-zenith-border bg-white font-semibold hover:border-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
            compact ? "h-11 text-lg" : "h-14 text-xl"
          }`}
        >
          {key}
        </button>
      ))}
    </div>
  );
}
