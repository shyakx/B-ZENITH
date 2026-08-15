"use client";

import type { Role } from "@prisma/client";
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  RotateCcw,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { PoweredBy } from "@/components/powered-by";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER", "ADMIN"] },
  { href: "/pos", label: "Point of sale", icon: ShoppingCart, roles: ["OWNER", "ADMIN", "WAITER"] },
  { href: "/sales", label: "Sales", icon: History, roles: ["OWNER", "ADMIN", "WAITER"] },
  { href: "/menu", label: "Menu", icon: Tags, roles: ["OWNER", "ADMIN", "INVENTORY"] },
  { href: "/inventory", label: "Inventory", icon: Boxes, roles: ["OWNER", "ADMIN", "INVENTORY"] },
  { href: "/purchases", label: "Purchases", icon: PackagePlus, roles: ["OWNER", "ADMIN", "INVENTORY"] },
  { href: "/suppliers", label: "Suppliers", icon: Truck, roles: ["OWNER", "ADMIN", "INVENTORY"] },
  { href: "/expenses", label: "Expenses", icon: CircleDollarSign, roles: ["OWNER", "ADMIN"] },
  { href: "/returns", label: "Returns", icon: RotateCcw, roles: ["OWNER", "ADMIN"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
  { href: "/employees", label: "Employees", icon: Users, roles: ["OWNER"] },
  { href: "/audit", label: "Audit logs", icon: ClipboardList, roles: ["OWNER"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["OWNER", "ADMIN"] },
] satisfies Array<{ href: string; label: string; icon: typeof ClipboardList; roles: Role[] }>;

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { name?: string | null; role: Role };
}) {
  const pathname = usePathname();
  const availableLinks = links.filter((link) => link.roles.some((role: Role) => role === user.role));

  return (
    <div className="min-h-screen bg-stone-100 text-stone-950 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-stone-800 bg-black text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:h-24 lg:px-5">
          <Link href="/pos" className="flex min-w-0 items-center gap-2">
            <BrandLogo size={52} className="rounded-md" />
            <span className="truncate text-sm font-black tracking-[0.14em] text-[#d4af37] lg:text-base">B-ZENITH</span>
          </Link>
          <span className="rounded-full border border-[#d4af37] px-2 py-1 text-[10px] font-bold text-[#d4af37]">
            {user.role}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="grid size-10 place-items-center rounded-md text-stone-300 hover:bg-stone-900 lg:hidden"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible">
          {availableLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
                  active ? "bg-[#d4af37] text-black" : "text-stone-300 hover:bg-stone-900 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-stone-800 p-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="mb-3 truncate text-sm text-stone-400">{user.name}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-stone-300 hover:bg-stone-900"
          >
            <LogOut size={18} /> Sign out
          </button>
          <PoweredBy className="mt-3 text-stone-500" />
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
