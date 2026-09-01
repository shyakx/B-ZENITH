"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BedDouble,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock,
  Home,
  LayoutGrid,
  MapPin,
  Package,
  ScrollText,
  Settings,
  Shield,
  SlidersHorizontal,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { groupNavItems, isNavActive, type NavItem } from "@/lib/navigation";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/owner": Home,
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
  "/manager/inventory/transfer": ArrowLeftRight,
  "/manager/inventory/count": ClipboardCheck,
  "/manager/inventory/adjust": SlidersHorizontal,
  "/manager/inventory/suppliers": Store,
  "/manager/inventory/locations": MapPin,
  "/manager/orders": ClipboardList,
  "/manager/reports": BarChart3,
  "/manager/maison": BedDouble,
  "/admin": Home,
  "/admin/users": Users,
  "/admin/access": Shield,
  "/admin/settings": Settings,
  "/admin/audit": ScrollText,
};

function NavLink({
  item,
  active,
  variant,
}: {
  item: NavItem;
  active: boolean;
  variant: "sidebar" | "mobile";
}) {
  const Icon = NAV_ICONS[item.href] ?? Home;

  if (variant === "mobile") {
    return (
      <Link
        href={item.href}
        className={`app-mobile-nav-item ${active ? "is-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        <Icon size={14} strokeWidth={2} />
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className={`app-nav-item ${active ? "is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={`${item.label} — ${item.hint}`}
    >
      <Icon size={18} strokeWidth={1.9} className="app-nav-icon" />
      <span className="app-nav-copy">
        <span className="app-nav-label">{item.label}</span>
        <span className="app-nav-hint">{item.hint}</span>
      </span>
    </Link>
  );
}

export function AppNav({
  items,
  variant,
}: {
  items: NavItem[];
  variant: "sidebar" | "mobile";
}) {
  const pathname = usePathname() ?? "";
  const hrefs = items.map((item) => item.href);

  if (variant === "mobile") {
    return (
      <>
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isNavActive(pathname, item.href, hrefs)}
            variant="mobile"
          />
        ))}
      </>
    );
  }

  const groups = groupNavItems(items);

  return (
    <>
      {groups.map((group, index) => (
        <div key={`${group.label ?? "nav"}-${index}`} className="app-nav-group">
          {group.label ? <p className="app-nav-group-label">{group.label}</p> : null}
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isNavActive(pathname, item.href, hrefs)}
              variant="sidebar"
            />
          ))}
        </div>
      ))}
    </>
  );
}
