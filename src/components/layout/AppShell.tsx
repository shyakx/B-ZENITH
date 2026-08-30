import { Suspense } from "react";
import { Lock } from "lucide-react";
import { lockAction } from "@/actions/auth";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { ROLE_NAV } from "@/lib/navigation";
import { Logo } from "@/components/brand/Logo";
import { AppNav } from "@/components/layout/AppNav";

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: Role };
  children: React.ReactNode;
}) {
  const items = ROLE_NAV[user.role];

  return (
    <div className="app-shell bg-zenith-bg text-zenith-cream">
      <aside className="app-sidebar border-r border-zenith-border bg-white">
        <div className="min-w-0 shrink-0 border-b border-zenith-border px-5 py-5">
          <Logo size={52} showWordmark />
        </div>
        <nav className="app-sidebar-nav space-y-1 p-3">
          <Suspense fallback={null}>
            <AppNav items={items} variant="sidebar" />
          </Suspense>
        </nav>
        <form action={lockAction} className="app-sidebar-lock border-t border-zenith-border p-4">
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-zenith-gold px-4 py-3 text-sm font-semibold text-zenith-gold">
            <Lock size={16} />
            Lock / Switch user
          </button>
        </form>
      </aside>

      <div className="app-main-column">
        <header className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-zenith-border bg-white px-4 py-3">
          <div className="md:hidden">
            <Logo size={44} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{user.name}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zenith-gold">
              {roleLabel(user.role)}
            </div>
          </div>
          <form action={lockAction} className="md:hidden">
            <button className="inline-flex items-center gap-2 rounded-2xl border-2 border-zenith-gold px-3 py-2 text-sm font-semibold text-zenith-gold">
              <Lock size={16} />
              Lock
            </button>
          </form>
        </header>

        <nav className="flex min-w-0 shrink-0 flex-wrap gap-2 border-b border-zenith-border bg-zenith-surface px-3 py-2 md:hidden">
          <Suspense fallback={null}>
            <AppNav items={items} variant="mobile" />
          </Suspense>
        </nav>

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
