import { Suspense } from "react";
import { Lock } from "lucide-react";
import { lockAction } from "@/actions/auth";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { ROLE_NAV } from "@/lib/navigation";
import { Logo } from "@/components/brand/Logo";
import { PoweredByCloudSync } from "@/components/brand/PoweredByCloudSync";
import { ChangeOwnPinButton } from "@/components/auth/ChangeOwnPinButton";
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
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <Logo size={32} />
          <div className="min-w-0">
            <div className="app-sidebar-wordmark">B-ZENITH</div>
            <div className="app-sidebar-role">{roleLabel(user.role)}</div>
          </div>
        </div>

        <nav className="app-sidebar-nav">
          <Suspense fallback={null}>
            <AppNav items={items} variant="sidebar" />
          </Suspense>
        </nav>

        <div className="app-sidebar-session">
          <PoweredByCloudSync className="mb-2.5 text-center" />
          <div className="app-session-actions">
            <ChangeOwnPinButton className="app-session-btn" />
            <form action={lockAction}>
              <button type="submit" className="app-session-btn">
                <Lock size={15} strokeWidth={2} />
                Lock / Switch user
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-zenith-border bg-white px-3 py-2">
          <div className="md:hidden">
            <Logo size={36} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">{user.name}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-zenith-gold">
              {roleLabel(user.role)}
            </div>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <ChangeOwnPinButton compact />
            <form action={lockAction}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-zenith-gold px-3 py-2 text-sm font-semibold text-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold"
              >
                <Lock size={15} />
                Lock
              </button>
            </form>
          </div>
        </header>

        <nav className="app-mobile-nav md:hidden">
          <Suspense fallback={null}>
            <AppNav items={items} variant="mobile" />
          </Suspense>
        </nav>

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
