"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  Printer,
  ScrollText,
  Settings,
  Shield,
  Trash2,
  SlidersHorizontal,
  Store,
  Truck,
  Users,
  Menu,
  X,
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
  "/cashier/factures": Printer,
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
  "/admin/data": Trash2,
  "/admin/audit": ScrollText,
};

function NavLink({
  item,
  active,
  variant,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  variant: "sidebar" | "mobile" | "mobileSheet";
  onClick?: () => void;
}) {
  const Icon = NAV_ICONS[item.href] ?? Home;

  if (variant === "mobile") {
    return (
      <Link
        href={item.href}
        className={`app-mobile-nav-item ${active ? "is-active" : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        <Icon size={14} strokeWidth={2} />
        {item.label}
      </Link>
    );
  }

  if (variant === "mobileSheet") {
    return (
      <Link
        href={item.href}
        className={`app-mobile-sheet-link ${active ? "is-active" : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        <span className="app-mobile-sheet-link-main">
          <Icon size={16} strokeWidth={1.9} />
          <span>{item.label}</span>
        </span>
        <span className="app-mobile-sheet-link-hint">{item.hint}</span>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const hrefs = items.map((item) => item.href);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (variant === "mobile") {
    const activeItem = items.find((item) => isNavActive(pathname, item.href, hrefs));
    const groups = groupNavItems(items);

    return (
      <div className="app-mobile-collapse">
        <button
          type="button"
          className="app-mobile-nav-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-panel"
        >
          <span className="app-mobile-nav-toggle-main">
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
            {menuOpen ? "Close menu" : "Navigation"}
          </span>
          <span className="app-mobile-nav-toggle-current">
            {activeItem?.label ?? "Menu"}
          </span>
        </button>
        {menuOpen ? (
          <div id="mobile-nav-panel" className="app-mobile-collapse-panel">
            {groups.map((group, index) => (
              <section key={`${group.label ?? "nav"}-${index}`} className="app-mobile-sheet-group">
                {group.label ? <p className="app-mobile-sheet-group-label">{group.label}</p> : null}
                <div className="app-mobile-sheet-links">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={isNavActive(pathname, item.href, hrefs)}
                      variant="mobileSheet"
                      onClick={() => setMenuOpen(false)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
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
