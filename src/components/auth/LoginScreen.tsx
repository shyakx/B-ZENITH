"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { ROLE_HOME, ROLES, roleLabel, type Role } from "@/lib/auth/roles";
import { staffInitials } from "@/lib/domain/staff-name";
import { Logo } from "@/components/brand/Logo";
import { PoweredByCloudSync } from "@/components/brand/PoweredByCloudSync";
import { nextPinValue, PinKeypad } from "@/components/auth/PinKeypad";
import { Button } from "@/components/ui/Button";

type Staff = { id: string; name: string; role: Role };

function StaffFace({ person }: { person: Staff }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zenith-gold text-sm font-semibold tracking-wide text-white">
        {staffInitials(person.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">{person.name}</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-zenith-gold">
          {roleLabel(person.role)}
        </span>
      </span>
    </span>
  );
}

function StaffTile({
  person,
  selected,
  onSelect,
}: {
  person: Staff;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-w-0 items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
        selected
          ? "border-zenith-gold bg-zenith-raised"
          : "border-zenith-border bg-white hover:border-zenith-gold"
      }`}
    >
      <StaffFace person={person} />
    </button>
  );
}

export function LoginScreen({
  staff,
  currentUser,
  showDevHelp,
}: {
  staff: Staff[];
  currentUser: { id: string; name: string; role: Role } | null;
  showDevHelp: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Staff | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const groups = ROLES.map((role) => ({
    role,
    people: staff.filter((person) => person.role === role),
  })).filter((group) => group.people.length > 0);

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await loginAction({ userId: selected.id, pin });
      if (!result.ok) {
        setError(result.error);
        setPin("");
        return;
      }
      router.push(result.data.home);
      router.refresh();
    } catch {
      setError("Could not sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-pattern flex min-h-screen items-center justify-center p-3 md:p-5">
      <div className="w-full max-w-3xl rounded-2xl border border-zenith-border bg-white/95 p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-2 text-2xl font-semibold tracking-[0.18em] text-zenith-gold">B-ZENITH</h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-zenith-muted">
            Staff login
          </p>
          <PoweredByCloudSync className="mt-2" />
        </div>

        {!selected ? (
          <div>
            <p className="mb-3 text-center text-sm text-zenith-muted">Who is using this device?</p>
            {currentUser ? (
              <div className="mb-3 rounded-2xl border border-zenith-gold bg-zenith-raised px-3 py-2.5 text-center text-sm">
                <p>
                  {currentUser.name} is signed in. Choose another person to switch.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => router.push(ROLE_HOME[currentUser.role])}
                >
                  Continue as {currentUser.name}
                </Button>
              </div>
            ) : null}
            <div className="space-y-3">
              {groups.map((group) => (
                <section key={group.role}>
                  <h2 className="mb-1.5 text-sm font-semibold tracking-wide text-zenith-gold">
                    {roleLabel(group.role)}
                  </h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {group.people.map((person) => (
                      <StaffTile
                        key={person.id}
                        person={person}
                        selected={currentUser?.id === person.id}
                        onSelect={() => setSelected(person)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-sm">
            <button
              type="button"
              className="mb-3 text-sm font-semibold text-zenith-gold"
              onClick={() => {
                setSelected(null);
                setPin("");
                setError("");
              }}
            >
              ← Change staff
            </button>
            <div className="mb-3 flex flex-col items-center text-center">
              <div className="rounded-2xl border border-zenith-gold bg-zenith-raised px-3 py-2">
                <StaffFace person={selected} />
              </div>
              <div className="mt-3 text-3xl tracking-[0.35em] text-zenith-gold">
                {pin ? "•".repeat(pin.length) : "PIN"}
              </div>
            </div>
            <PinKeypad onKey={(key) => { setError(""); setPin((value) => nextPinValue(value, key)); }} />
            {error ? <p className="mt-3 text-center text-sm text-zenith-danger">{error}</p> : null}
            <Button className="pos-tap mt-4 h-12 w-full" disabled={pin.length < 4 || busy} onClick={submit}>
              {busy ? "Checking…" : "Enter"}
            </Button>
          </div>
        )}

        {showDevHelp ? (
          <div className="mt-5 rounded-2xl border border-zenith-border bg-zenith-surface p-3 text-sm text-zenith-muted">
            <div className="mb-1 font-semibold text-zenith-gold">Development credentials</div>
            <div>John — Waiter — 1111</div>
            <div>Mary — Waiter — 1112</div>
            <div>Grace — Cashier — 2222</div>
            <div>Patrick — Manager — 3333</div>
            <div>Admin — Admin — 4444</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
