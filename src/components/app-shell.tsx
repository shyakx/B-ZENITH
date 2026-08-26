"use client";

import type { Role } from "@prisma/client";
import {
  BarChart3,
  Boxes,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  FolderTree,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  RotateCcw,
  ScrollText,
  Settings,
  ShoppingCart,
  Tags,
  Target,
  Users,
  Wine,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { PoweredBy } from "@/components/powered-by";
import type { NavItemId } from "@/lib/navigation";
import { isNavItemActive, navigationForRole, navLabelForRole } from "@/lib/navigation";
import { homePath } from "@/lib/permissions";
import { publicStaffName } from "@/lib/roles";

const icons: Record<NavItemId, typeof ClipboardList> = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  sales: History,
  "fulfillment-bar": Wine,
  "fulfillment-kitchen": ChefHat,
  "inventory-overview": Boxes,
  "stock-operations": ClipboardList,
  suppliers: PackagePlus,
  menu: Tags,
  categories: FolderTree,
  expenses: CircleDollarSign,
  returns: RotateCcw,
  billiard: Target,
  reports: BarChart3,
  staff: Users,
  audit: ScrollText,
  settings: Settings,
};

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { name?: string | null; role: Role; username?: string; hasPin?: boolean };
}) {
  const pathname = usePathname();
  const sections = navigationForRole(user.role);
  const identity = publicStaffName(user);

  return (
    <div className="min-h-screen bg-white text-black lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="flex flex-col border-b border-black bg-black text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex min-h-14 shrink-0 items-center gap-3 px-3 py-2.5">
          <Link href={homePath(user.role)} className="flex min-w-0 flex-1 items-center gap-2.5">
            <BrandLogo size={36} className="size-9 rounded-md" />
            <span className="truncate text-xs font-medium tracking-[0.14em] text-[#FFD758]">B-ZENITH</span>
          </Link>
          <Link
            href="/account"
            className="grid size-10 shrink-0 place-items-center rounded-md text-[#FFD758] lg:hidden"
            aria-label={user.hasPin ? "Change PIN" : "Set PIN"}
          >
            <KeyRound size={16} />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="grid size-10 shrink-0 place-items-center rounded-md text-white lg:hidden"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
        <nav className="flex flex-wrap gap-1 px-2 pb-2 lg:min-h-0 lg:flex-1 lg:flex-col lg:flex-nowrap lg:gap-5 lg:overflow-y-auto lg:px-3 lg:py-4">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
              <p className="hidden px-3 pb-1.5 text-[10px] font-medium tracking-[0.14em] text-[#FFD758] lg:block">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = icons[item.id];
                const active = isNavItemActive(pathname, item);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex min-h-10 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium lg:min-h-11 lg:px-3 ${
                      active ? "bg-[#FFD758] text-black" : "text-white hover:border hover:border-[#FFD758]"
                    }`}
                  >
                    <Icon size={16} className={`shrink-0 ${active ? "text-black" : "text-[#FFD758]"}`} />
                    <span className="truncate">{navLabelForRole(item, user.role)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="hidden shrink-0 border-t border-white p-4 lg:block">
          <p className="truncate text-sm font-medium text-white">{identity}</p>
          <p className="mb-3 truncate text-xs font-normal text-[#FFD758]">
            {user.role === "ADMIN" ? "System admin" : user.username ? `@${user.username}` : ""}
          </p>
          <Link
            href="/account"
            className="mb-1 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-white hover:border hover:border-[#FFD758]"
          >
            <KeyRound size={18} className="text-[#FFD758]" /> {user.hasPin ? "Change PIN" : "Set PIN"}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-white hover:border hover:border-[#FFD758]"
          >
            <LogOut size={18} className="text-[#FFD758]" /> Sign out
          </button>
          <PoweredBy className="mt-3 text-[#FFD758]" />
        </div>
      </aside>
      <main className="min-w-0 overflow-x-hidden bg-white p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
