"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export function PrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <Button className="no-print" onClick={() => window.print()}>
      Print facture
    </Button>
  );
}
