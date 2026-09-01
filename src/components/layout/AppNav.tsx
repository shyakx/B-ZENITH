"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BarChart3,
  BedDouble,
  Boxes,
  ClipboardList,
  ClipboardPlus,
  Clock,
  Home,
  LayoutGrid,
  Package,
  ScrollText,
  Settings,
  Shield,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { isNavActive, type NavItem } from "@/lib/navigation";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/waiter": Home,
  "/waiter/orders/new": ClipboardPlus,
  "/waiter/orders": ClipboardList,
  "/cashier": Home,
  "/cashier/bills": ClipboardList,
  "/cashier/outstanding": Clock,
  "/cashier/payments": Banknote,
  "/manager": Home,
  "/manager/tables": LayoutGrid,
  "/manager/products": Package,
  "/manager/inventory": Boxes,
  "/manager/purchases": Truck,
  "/manager/orders": ClipboardList,
  "/manager/reports": BarChart3,
  "/manager/maison": BedDouble,
  "/admin": Home,
  "/admin/users": Users,
  "/admin/access": Shield,
  "/admin/settings": Settings,
  "/admin/audit": ScrollText,
};

export function AppNav({
  items,
  variant,
}: {
  items: NavItem[];
  variant: "sidebar" | "mobile";
}) {
  const pathname = usePathname() ?? "";
  const hrefs = items.map((item) => item.href);

  return (
    <>
      {items.map((item) => {
        const active = isNavActive(pathname, item.href, hrefs);
        const Icon = NAV_ICONS[item.href] ?? Home;
        if (variant === "mobile") {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
                active ? "bg-zenith-gold text-white" : "text-zenith-cream"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
              active ? "bg-zenith-gold text-white" : "text-zenith-cream hover:bg-zenith-raised"
            }`}
            aria-current={active ? "page" : undefined}
            title={`${item.label} — ${item.hint}`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">{item.label}</span>
              <span className={`mt-0.5 block text-[11px] leading-snug ${active ? "text-white/85" : "text-zenith-muted"}`}>
                {item.hint}
              </span>
            </span>
          </Link>
        );
      })}
    </>
  );
}
