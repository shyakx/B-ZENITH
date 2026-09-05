"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseReceiptPaperMm, type ReceiptPaperMm } from "@/lib/settings";

function applyPaper(paperMm: ReceiptPaperMm) {
  document.documentElement.dataset.receiptPaper = paperMm;
  document.querySelector(".print-page")?.setAttribute("data-paper", paperMm);
  let style = document.getElementById("receipt-page-size");
  if (!style) {
    style = document.createElement("style");
    style.id = "receipt-page-size";
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${paperMm}mm auto; margin: 2mm; }`;
}

export function PrintToolbar({
  autoPrint = false,
  paperMm,
  printLabel = "Print facture",
}: {
  autoPrint?: boolean;
  paperMm: ReceiptPaperMm;
  printLabel?: string;
}) {
  const [paper, setPaper] = useState(paperMm);

  useEffect(() => {
    applyPaper(paper);
    return () => {
      delete document.documentElement.dataset.receiptPaper;
      document.getElementById("receipt-page-size")?.remove();
    };
  }, [paper]);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="print-toolbar no-print">
      <div className="print-toolbar-sizes" role="group" aria-label="Receipt paper">
        <Button type="button" variant={paper === "80" ? "primary" : "secondary"} onClick={() => setPaper("80")}>
          80mm
        </Button>
        <Button type="button" variant={paper === "58" ? "primary" : "secondary"} onClick={() => setPaper("58")}>
          58mm
        </Button>
      </div>
      <p>
        Match the bill roll. In the print window choose <strong>{paper}mm</strong> or Receipt paper and{" "}
        <strong>100% scale</strong>. Do not pick A4 or Fit to page — that stretches the bill and makes it
        long.
      </p>
      <Button onClick={() => window.print()}>{printLabel}</Button>
    </div>
  );
}

export function PrintButton({
  autoPrint = false,
  paperMm = "80",
}: {
  autoPrint?: boolean;
  paperMm?: ReceiptPaperMm;
}) {
  return <PrintToolbar autoPrint={autoPrint} paperMm={parseReceiptPaperMm(paperMm)} />;
}
