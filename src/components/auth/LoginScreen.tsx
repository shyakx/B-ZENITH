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

function StaffFace({ person, compact }: { person: Staff; compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-zenith-gold font-semibold tracking-wide text-white ${
          compact ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-sm"
        }`}
      >
        {staffInitials(person.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">{person.name}</span>
        <span className="block text-[11px] font-medium leading-tight text-zenith-gold">
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
      aria-label={`Choose ${person.name}, ${roleLabel(person.role)}`}
      className={`flex h-10 min-w-0 w-full items-center rounded-xl border px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
        selected
          ? "border-zenith-gold bg-zenith-raised"
          : "border-zenith-border bg-white hover:border-zenith-gold"
      }`}
    >
      <StaffFace person={person} compact />
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
      <div className="flex w-full max-w-md flex-col rounded-2xl border border-zenith-border bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex shrink-0 flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-2 text-xl font-semibold tracking-wide text-zenith-gold">B-ZENITH</h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-zenith-muted">
            Staff login
          </p>
          <PoweredByCloudSync className="mt-1.5" />
        </div>

        {!selected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-2 shrink-0 text-center text-sm font-semibold">
              Choose your account
            </p>
            {currentUser ? (
              <div className="mb-2 shrink-0 rounded-xl border border-zenith-gold bg-zenith-raised px-3 py-2 text-center text-sm">
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
            <div
              className="max-h-[min(16.5rem,42vh)] space-y-2 overflow-y-auto overscroll-contain pr-0.5"
              role="group"
              aria-label="Staff accounts"
            >
              {groups.map((group) => (
                <section key={group.role}>
                  <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zenith-gold">
                    {roleLabel(group.role)}
                  </h2>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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
          <div className="mx-auto w-full max-w-sm shrink-0">
            <Button
              type="button"
              variant="secondary"
              className="mb-3 h-11 w-full"
              onClick={() => {
                setSelected(null);
                setPin("");
                setError("");
              }}
            >
              ← Change staff
            </Button>
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
          <div className="mt-4 shrink-0 rounded-2xl border border-zenith-border bg-zenith-surface p-3 text-sm text-zenith-muted">
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
