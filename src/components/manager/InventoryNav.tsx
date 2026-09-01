"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { INVENTORY_NAV } from "@/lib/inventory-nav";
import { isNavActive } from "@/lib/navigation";

export function InventoryNav() {
  const pathname = usePathname() ?? "";
  const hrefs = INVENTORY_NAV.map((item) => item.href);

  return (
    <nav className="mb-4 flex min-w-0 flex-wrap gap-1.5">
      {INVENTORY_NAV.map((item) => {
        const active = isNavActive(pathname, item.href, hrefs);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
              active ? "bg-zenith-gold text-white" : "border border-zenith-border bg-white text-zenith-ink"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/manager/purchases"
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
          pathname.startsWith("/manager/purchases")
            ? "bg-zenith-gold text-white"
            : "border border-zenith-border bg-white text-zenith-ink"
        }`}
      >
        Receive Stock
      </Link>
    </nav>
  );
}
