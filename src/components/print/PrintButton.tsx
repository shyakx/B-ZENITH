"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button className="no-print" onClick={() => window.print()}>
      Print facture
    </Button>
  );
}
