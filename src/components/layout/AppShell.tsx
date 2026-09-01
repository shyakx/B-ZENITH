import { Suspense } from "react";
import { Lock } from "lucide-react";
import { lockAction } from "@/actions/auth";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { ROLE_NAV } from "@/lib/navigation";
import { Logo } from "@/components/brand/Logo";
import { PoweredByCloudSync } from "@/components/brand/PoweredByCloudSync";
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
        <div className="min-w-0 shrink-0 border-b border-zenith-border px-3 py-3">
          <Logo size={40} showWordmark />
        </div>
        <nav className="app-sidebar-nav space-y-0.5 p-2">
          <Suspense fallback={null}>
            <AppNav items={items} variant="sidebar" />
          </Suspense>
        </nav>
        <div className="app-sidebar-lock border-t border-zenith-border p-3">
          <PoweredByCloudSync className="mb-2 text-center" />
          <form action={lockAction}>
            <button className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-zenith-gold px-3 py-2 text-sm font-semibold text-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold">
              <Lock size={15} />
              Lock / Switch user
            </button>
          </form>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-zenith-border bg-white px-3 py-2">
          <div className="md:hidden">
            <Logo size={36} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{user.name}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zenith-gold">
              {roleLabel(user.role)}
            </div>
          </div>
          <form action={lockAction} className="md:hidden">
            <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-zenith-gold px-3 py-2 text-sm font-semibold text-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold">
              <Lock size={15} />
              Lock
            </button>
          </form>
        </header>

        <nav className="flex min-w-0 shrink-0 flex-wrap gap-1.5 border-b border-zenith-border bg-zenith-surface px-3 py-2 md:hidden">
          <Suspense fallback={null}>
            <AppNav items={items} variant="mobile" />
          </Suspense>
        </nav>

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
