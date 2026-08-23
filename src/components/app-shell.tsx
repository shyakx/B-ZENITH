"use client";

import type { Role } from "@prisma/client";
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  RotateCcw,
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
import { homePath } from "@/lib/permissions";
import { billiardRoles, businessRoles, catalogRoles, publicStaffName, tillRoles, userAdminRoles } from "@/lib/roles";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: businessRoles },
  { href: "/pos", label: "Point of sale", icon: ShoppingCart, roles: tillRoles },
  { href: "/billiard", label: "Billiard sales", icon: Target, roles: billiardRoles },
  { href: "/sales", label: "Sales", icon: History, roles: tillRoles },
  { href: "/menu", label: "Menu", icon: Tags, roles: catalogRoles },
  { href: "/inventory", label: "Inventory overview", icon: Boxes, roles: catalogRoles },
  { href: "/inventory/operations", label: "Stock operations", icon: ClipboardList, roles: catalogRoles },
  { href: "/suppliers", label: "Suppliers", icon: PackagePlus, roles: catalogRoles },
  { href: "/expenses", label: "Expenses", icon: CircleDollarSign, roles: businessRoles },
  { href: "/returns", label: "Returns", icon: RotateCcw, roles: businessRoles },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: businessRoles },
  { href: "/employees", label: "Users", icon: Users, roles: userAdminRoles },
  { href: "/audit", label: "Audit logs", icon: ClipboardList, roles: userAdminRoles },
  { href: "/settings", label: "Settings", icon: Settings, roles: userAdminRoles },
] satisfies Array<{ href: string; label: string; icon: typeof ClipboardList; roles: readonly Role[] }>;

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { name?: string | null; role: Role; username?: string; hasPin?: boolean };
}) {
  const pathname = usePathname();
  const availableLinks = links.filter((link) => link.roles.some((role: Role) => role === user.role));
  const identity = publicStaffName(user);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-950 lg:grid lg:grid-cols-[250px_1fr]">
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
            className="grid size-10 shrink-0 place-items-center rounded-md text-stone-300 hover:bg-stone-900 lg:hidden"
            aria-label={user.hasPin ? "Change PIN" : "Set PIN"}
          >
            <KeyRound size={18} />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="grid size-10 shrink-0 place-items-center rounded-md text-stone-300 hover:bg-stone-900 lg:hidden"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:pb-2">
          {availableLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/inventory" && pathname.startsWith(`${href}/`)) || (href === "/inventory" && pathname === "/inventory");
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
                  active ? "bg-[#d4af37] text-black" : "text-stone-300 hover:bg-stone-900 hover:text-white"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden shrink-0 border-t border-stone-800 p-4 lg:block">
          <p className="mb-1 truncate text-sm font-semibold text-white">{identity}</p>
          {user.role === "ADMIN" ? (
            <p className="mb-3 truncate text-xs text-stone-400">
              System admin{user.username ? ` · @${user.username}` : ""}
            </p>
          ) : (
            <p className="mb-3 truncate text-xs text-stone-400">{user.username ? `@${user.username}` : ""}</p>
          )}
          <Link
            href="/account"
            className="mb-1 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-stone-300 hover:bg-stone-900"
          >
            <KeyRound size={18} /> {user.hasPin ? "Change PIN" : "Set PIN"}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-stone-300 hover:bg-stone-900"
          >
            <LogOut size={18} /> Sign out
          </button>
          <PoweredBy className="mt-3 text-stone-500" />
        </div>
      </aside>
      <main className="min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
