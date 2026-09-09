"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/** A4 report print toolbar — Save as PDF from the browser print dialog. */
export function ReportPrintToolbar({
  autoPrint = false,
  printLabel = "Export PDF",
}: {
  autoPrint?: boolean;
  printLabel?: string;
}) {
  useEffect(() => {
    document.documentElement.dataset.reportPrint = "a4";
    let style = document.getElementById("report-page-size");
    if (!style) {
      style = document.createElement("style");
      style.id = "report-page-size";
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: A4 portrait; margin: 12mm; }`;
    return () => {
      delete document.documentElement.dataset.reportPrint;
      document.getElementById("report-page-size")?.remove();
    };
  }, []);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="print-toolbar no-print">
      <p>
        Choose <strong>Save as PDF</strong> (or Microsoft Print to PDF) in the print window. Use A4 and
        default margins.
      </p>
      <Button onClick={() => window.print()}>{printLabel}</Button>
    </div>
  );
}
