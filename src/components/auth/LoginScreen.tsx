"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { Logo } from "@/components/brand/Logo";
import { PoweredByCloudSync } from "@/components/brand/PoweredByCloudSync";
import { Button } from "@/components/ui/Button";

type Staff = { id: string; name: string; role: Role };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"];

export function LoginScreen({
  staff,
  showDevHelp,
}: {
  staff: Staff[];
  showDevHelp: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Staff | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function press(key: string) {
    setError("");
    if (key === "C") {
      setPin("");
      return;
    }
    if (key === "←") {
      setPin((value) => value.slice(0, -1));
      return;
    }
    setPin((value) => (value.length < 6 ? value + key : value));
  }

  async function submit() {
    if (!selected) return;
    setBusy(true);
    const result = await loginAction({ userId: selected.id, pin });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setPin("");
      return;
    }
    router.push(result.data.home);
    router.refresh();
  }

  return (
    <div className="brand-pattern flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-xl border border-zenith-border bg-white p-5 shadow-sm md:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={88} />
          <h1 className="mt-3 font-display text-3xl tracking-[0.18em] text-zenith-gold">B-ZENITH</h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.22em] text-zenith-muted">
            Staff login
          </p>
          <PoweredByCloudSync className="mt-3" />
        </div>

        {!selected ? (
          <div>
            <p className="mb-4 text-center text-base text-zenith-muted">Who is using this device?</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((person) => (
                <button
                  key={person.id}
                  onClick={() => setSelected(person)}
                  className="min-h-16 rounded-xl border-2 border-zenith-border bg-white px-4 py-4 text-left hover:border-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold"
                >
                  <div className="text-lg font-semibold">{person.name}</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zenith-gold">
                    {roleLabel(person.role)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-sm">
            <button
              className="mb-4 text-base font-semibold text-zenith-gold"
              onClick={() => {
                setSelected(null);
                setPin("");
                setError("");
              }}
            >
              ← Change staff
            </button>
            <div className="mb-4 text-center">
              <div className="text-2xl font-semibold">{selected.name}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-zenith-gold">
                {roleLabel(selected.role)}
              </div>
              <div className="mt-4 text-3xl tracking-[0.35em] text-zenith-gold">
                {pin ? "•".repeat(pin.length) : "PIN"}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => press(key)}
                  className="h-14 rounded-xl border-2 border-zenith-border bg-white text-xl font-semibold hover:border-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold"
                >
                  {key}
                </button>
              ))}
            </div>
            {error ? <p className="mt-4 text-center text-sm text-zenith-danger">{error}</p> : null}
            <Button className="pos-tap mt-5 h-12 w-full" disabled={pin.length < 4 || busy} onClick={submit}>
              {busy ? "Checking…" : "Enter"}
            </Button>
          </div>
        )}

        {showDevHelp ? (
          <div className="mt-8 rounded-2xl border border-zenith-border bg-zenith-surface p-4 text-sm text-zenith-muted">
            <div className="mb-2 font-semibold text-zenith-gold">Development credentials</div>
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
