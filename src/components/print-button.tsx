"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden flex min-h-11 items-center justify-center gap-2 rounded-md bg-black px-5 font-bold text-[#d4af37]"
    >
      <Printer size={18} /> Print receipt
    </button>
  );
}
