"use client";

import type { Role } from "@prisma/client";
import {
  BarChart3,
  Boxes,
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
    <div className="min-h-screen bg-stone-100 text-stone-950 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col border-b border-stone-800 bg-black text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex min-h-16 shrink-0 items-center gap-2 px-3 py-2 lg:px-4">
          <Link href={homePath(user.role)} className="flex min-w-0 flex-1 items-center gap-2">
            <BrandLogo size={40} className="size-9 rounded-md lg:size-10" />
            <span className="truncate text-sm font-black tracking-[0.14em] text-[#d4af37] lg:text-base">B-ZENITH</span>
          </Link>
          <span className="shrink-0 rounded-full border border-[#d4af37] px-2 py-1 text-[10px] font-bold text-[#d4af37]">
            {identity}
          </span>
          <Link
            href="/account"
            className="grid size-10 shrink-0 place-items-center rounded-md text-stone-200 hover:bg-stone-900 lg:hidden"
            aria-label={user.hasPin ? "Change PIN" : "Set PIN"}
          >
            <KeyRound size={18} />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="grid size-10 shrink-0 place-items-center rounded-md text-stone-200 hover:bg-stone-900 lg:hidden"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
        <nav className="flex gap-3 overflow-x-auto px-3 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-5 lg:overflow-y-auto lg:px-3 lg:pb-4">
          {sections.map((section) => (
            <div key={section.id} className="flex shrink-0 gap-1 lg:flex-col lg:gap-1">
              <p className="hidden px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#d4af37] lg:block">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = icons[item.id];
                const active = isNavItemActive(pathname, item);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-bold transition ${
                      active ? "bg-[#d4af37] text-black" : "text-stone-100 hover:bg-stone-900 hover:text-white"
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="truncate">{navLabelForRole(item, user.role)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="hidden shrink-0 border-t border-stone-800 p-4 lg:block">
          <p className="mb-1 truncate text-sm font-semibold text-white">{identity}</p>
          {user.role === "ADMIN" ? (
            <p className="mb-3 truncate text-xs text-stone-300">
              System admin{user.username ? ` · @${user.username}` : ""}
            </p>
          ) : (
            <p className="mb-3 truncate text-xs text-stone-300">{user.username ? `@${user.username}` : ""}</p>
          )}
          <Link
            href="/account"
            className="mb-1 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-stone-100 hover:bg-stone-900"
          >
            <KeyRound size={18} /> {user.hasPin ? "Change PIN" : "Set PIN"}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-stone-100 hover:bg-stone-900"
          >
            <LogOut size={18} /> Sign out
          </button>
          <PoweredBy className="mt-3 text-stone-400" />
        </div>
      </aside>
      <main className="min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
