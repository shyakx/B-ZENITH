"use client";

import { Delete, UserRound } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { homePath } from "@/lib/permissions";

type Staff = { username: string; firstName: string; lastName: string; name: string; role: string };

const roles = [
  { id: "OWNER", label: "Owner", hint: "Dashboard, staff, and settings" },
  { id: "ADMIN", label: "Admin", hint: "POS, inventory, and users" },
  { id: "WAITER", label: "Waiter", hint: "Point of sale" },
  { id: "INVENTORY", label: "Inventory", hint: "Stock, purchases, and suppliers" },
] as const;

function roleLabel(role: string) {
  return roles.find((item) => item.id === role)?.label ?? role;
}

function PinPad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  function press(digit: string) {
    if (disabled || value.length >= 4) return;
    onChange(`${value}${digit}`);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => press(key)}
          className="min-h-16 rounded-md border text-2xl font-black hover:bg-stone-50 disabled:opacity-50"
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("")}
        className="min-h-16 rounded-md border text-sm font-bold hover:bg-stone-50 disabled:opacity-50"
      >
        Clear
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => press("0")}
        className="min-h-16 rounded-md border text-2xl font-black hover:bg-stone-50 disabled:opacity-50"
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value.slice(0, -1))}
        className="grid min-h-16 place-items-center rounded-md border font-bold hover:bg-stone-50 disabled:opacity-50"
        aria-label="Delete"
      >
        <Delete size={22} />
      </button>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<(typeof roles)[number]["id"] | null>(null);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [emailMode, setEmailMode] = useState(false);

  async function chooseRole(next: (typeof roles)[number]["id"]) {
    setRole(next);
    setSelected(null);
    setPin("");
    setError("");
    setStaff(null);
    try {
      const response = await fetch(`/api/staff?role=${next}`);
      const payload = (await response.json().catch(() => null)) as Staff[] | { error?: string } | null;
      if (!response.ok || !Array.isArray(payload)) {
        setError("Unable to load staff right now.");
        setStaff([]);
        return;
      }
      setStaff(payload);
    } catch {
      setError("Unable to load staff right now.");
      setStaff([]);
    }
  }

  async function submitPin() {
    if (!selected || pin.length !== 4 || pending) return;
    setPending(true);
    setError("");
    const result = await signIn("credentials", {
      username: selected.username,
      pin,
      redirect: false,
    });
    if (result?.error) {
      setError("Could not sign in. Check your PIN or try again later.");
      setPin("");
      setPending(false);
      return;
    }
    const session = await getSession();
    if (session?.user?.mustChangePin) {
      router.push("/change-pin");
    } else {
      router.push(session?.user ? homePath(session.user.role) : "/");
    }
    router.refresh();
  }

  async function submitEmail(formData: FormData) {
    setPending(true);
    setError("");
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    if (result?.error) {
      setError("Could not sign in. Check your details or try again later.");
      setPending(false);
      return;
    }
    const session = await getSession();
    if (session?.user?.mustChangePin) {
      router.push("/change-pin");
    } else {
      router.push(session?.user ? homePath(session.user.role) : "/");
    }
    router.refresh();
  }

  if (emailMode) {
    return (
      <form action={submitEmail} className="space-y-5">
        <button type="button" onClick={() => setEmailMode(false)} className="text-sm font-bold text-[#947313]">
          ← Sign in with PIN
        </button>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="min-h-12 w-full rounded-md border border-stone-300 px-4 outline-none focus:border-[#b38f20]"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
            className="min-h-12 w-full rounded-md border border-stone-300 px-4 outline-none focus:border-[#b38f20]"
          />
        </label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full rounded-md bg-black px-5 font-bold text-[#d4af37] disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    );
  }

  if (!role) {
    return (
      <div className="grid gap-3">
        {roles.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void chooseRole(item.id)}
            className="min-h-20 rounded-lg border-2 border-stone-200 px-5 py-4 text-left hover:border-black"
          >
            <span className="block text-xl font-black tracking-wide">{item.label}</span>
            <span className="text-sm text-stone-500">{item.hint}</span>
          </button>
        ))}
        <button type="button" onClick={() => setEmailMode(true)} className="pt-2 text-sm font-bold text-[#947313]">
          Use email and password
        </button>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setRole(null)} className="text-sm font-bold text-[#947313]">
          ← All roles
        </button>
        <h2 className="text-lg font-black">{roleLabel(role)}s</h2>
        {staff === null ? (
          <p className="text-sm text-stone-500">Loading staff…</p>
        ) : staff.length === 0 ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            No active {roleLabel(role).toLowerCase()} accounts with a PIN. Ask an owner or admin to create a temporary PIN.
          </p>
        ) : (
          <div className="grid gap-2">
            {staff.map((person) => (
              <button
                key={person.username}
                type="button"
                onClick={() => {
                  setSelected(person);
                  setPin("");
                  setError("");
                }}
                className="flex min-h-14 items-center gap-3 rounded-md border px-4 text-left hover:border-black"
              >
                <UserRound className="text-stone-500" size={22} />
                <span className="font-bold">{person.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => {
          setSelected(null);
          setPin("");
          setError("");
        }}
        className="text-sm font-bold text-[#947313]"
      >
        ← {roleLabel(role)}s
      </button>
      <div className="text-center">
        <p className="text-xl font-black">{selected.name}</p>
        <p className="text-sm text-stone-500">{roleLabel(selected.role)}</p>
        <p className="mt-4 text-sm font-bold">Enter your PIN</p>
        <p className="mt-2 font-mono text-3xl tracking-[0.5em]">{"●".repeat(pin.length)}{"○".repeat(4 - pin.length)}</p>
      </div>
      <PinPad value={pin} onChange={setPin} disabled={pending} />
      {error && <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="button"
        disabled={pending || pin.length !== 4}
        onClick={() => void submitPin()}
        className="min-h-12 w-full rounded-md bg-black font-bold text-[#d4af37] disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Login"}
      </button>
    </div>
  );
}
