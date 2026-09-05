"use client";

import { Delete } from "lucide-react";
import { nextPinValue } from "@/lib/domain/pin-input";

export { nextPinValue };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"] as const;

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
          aria-label={key === "←" ? "Delete last PIN digit" : key === "C" ? "Delete all PIN digits" : key}
          onClick={() => onKey(key)}
          className={`inline-flex w-full items-center justify-center rounded-xl border-2 border-zenith-border bg-white font-semibold hover:border-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
            compact ? "h-11 text-lg" : "h-14 text-xl"
          }`}
        >
          {key === "←" ? (
            <Delete size={compact ? 18 : 22} strokeWidth={2.25} />
          ) : key === "C" ? (
            <span className="px-1 text-center text-xs font-semibold leading-tight sm:text-sm">
              Delete All
            </span>
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  );
}
