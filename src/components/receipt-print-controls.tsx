"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";

async function waitForImages() {
  await Promise.all(
    Array.from(document.images).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

async function printReceipt() {
  await waitForImages();
  window.print();
}

export function ReceiptPrintControls({ autoprint = false }: { autoprint?: boolean }) {
  useEffect(() => {
    if (!autoprint) return;
    void printReceipt();
  }, [autoprint]);

  return (
    <div className="print-hidden mx-auto mb-5 w-full max-w-[58mm]">
      <button
        type="button"
        onClick={() => void printReceipt()}
        className="bz-btn-primary flex w-full items-center justify-center gap-2"
      >
        <Printer size={18} /> Print
      </button>
    </div>
  );
}
