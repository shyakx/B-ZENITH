"use client";

import {
  ArrowLeft,
  Briefcase,
  CircleDot,
  Crown,
  Delete,
  Search,
  Shield,
  UtensilsCrossed,
} from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LOGIN_STAFF_PATH } from "@/lib/login-staff";
import { homePath } from "@/lib/permissions";
import { loginRoles, publicStaffName, roleTitle } from "@/lib/roles";

type Staff = { username: string; firstName: string; lastName: string; name: string; role: string };
type LoginRoleId = (typeof loginRoles)[number]["id"];

const ROLE_ORDER: LoginRoleId[] = ["OWNER", "ADMIN", "MANAGER", "WAITER", "BILLIARD"];

const ROLE_COPY: Record<LoginRoleId, { title: string; hint: string; Icon: typeof Crown }> = {
  OWNER: { title: "OWNER", hint: "Full business control", Icon: Crown },
  ADMIN: { title: "ADMIN", hint: "Administration & operations", Icon: Shield },
  MANAGER: { title: "MANAGER", hint: "Inventory & management", Icon: Briefcase },
  WAITER: { title: "WAITER", hint: "POS & service", Icon: UtensilsCrossed },
  BILLIARD: { title: "BILLIARD", hint: "Billiard operations", Icon: CircleDot },
};

function staffInitials(person: Staff) {
  const first = person.firstName?.trim().charAt(0);
  const last = person.lastName?.trim().charAt(0);
  if (first && last) return `${first}${last}`.toUpperCase();
  const parts = publicStaffName(person).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  return publicStaffName(person).slice(0, 2).toUpperCase() || "BZ";
}

function welcomeFirstName(person: Staff) {
  const first = person.firstName?.trim();
  if (first) return first;
  return publicStaffName(person).split(/\s+/).filter(Boolean)[0] ?? publicStaffName(person);
}

function matchesStaffSearch(person: Staff, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return publicStaffName(person).toLowerCase().includes(needle) || person.username.toLowerCase().includes(needle);
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#b8860b] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2"
    >
      <ArrowLeft size={16} aria-hidden />
      {label}
    </button>
  );
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

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="PIN keypad">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => press(key)}
          className="min-h-12 rounded-xl border-2 border-black bg-white text-2xl font-black transition duration-150 hover:-translate-y-0.5 hover:border-[#d4af37] hover:bg-[#d4af37] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 disabled:opacity-50 sm:min-h-16"
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("")}
        className="min-h-12 rounded-xl border-2 border-black text-sm font-black transition duration-150 hover:bg-black hover:text-[#d4af37] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 disabled:opacity-50 sm:min-h-16"
      >
        Clear
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => press("0")}
        className="min-h-12 rounded-xl border-2 border-black bg-white text-2xl font-black transition duration-150 hover:-translate-y-0.5 hover:border-[#d4af37] hover:bg-[#d4af37] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 disabled:opacity-50 sm:min-h-16"
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value.slice(0, -1))}
        className="grid min-h-12 place-items-center rounded-xl border-2 border-black font-bold transition duration-150 hover:bg-black hover:text-[#d4af37] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 disabled:opacity-50 sm:min-h-16"
        aria-label="Delete last digit"
      >
        <Delete size={22} />
      </button>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<LoginRoleId | null>(null);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [staffQuery, setStaffQuery] = useState("");

  async function chooseRole(next: LoginRoleId) {
    setRole(next);
    setSelected(null);
    setPin("");
    setError("");
    setStaff(null);
    setLoadFailed(false);
    setStaffQuery("");
    try {
      const response = await fetch(`${LOGIN_STAFF_PATH}?role=${encodeURIComponent(next)}`);
      const payload = (await response.json().catch(() => null)) as Staff[] | { error?: string } | null;
      if (!response.ok || !Array.isArray(payload)) {
        setLoadFailed(true);
        setStaff([]);
        return;
      }
      setStaff(payload);
    } catch {
      setLoadFailed(true);
      setStaff([]);
    }
  }

  const submitPin = useCallback(async () => {
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
  }, [selected, pin, pending, router]);

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

  useEffect(() => {
    if (!selected || emailMode) return;
    function onKeyDown(event: KeyboardEvent) {
      if (pending) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key >= "0" && event.key <= "9") {
        event.preventDefault();
        setPin((current) => (current.length >= 4 ? current : `${current}${event.key}`));
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        setPin((current) => current.slice(0, -1));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void submitPin();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, emailMode, pending, pin, submitPin]);

  const visibleStaff = useMemo(
    () => (staff ?? []).filter((person) => matchesStaffSearch(person, staffQuery)),
    [staff, staffQuery],
  );

  const fieldClass =
    "min-h-12 w-full rounded-xl border-2 border-black px-4 outline-none focus-visible:border-[#d4af37] focus-visible:ring-2 focus-visible:ring-[#d4af37]";
  const primaryButtonClass =
    "min-h-12 w-full rounded-xl bg-black px-5 text-base font-black text-[#d4af37] transition duration-150 hover:bg-[#111] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 disabled:bg-black disabled:text-[#d4af37] disabled:opacity-40 sm:min-h-14";

  if (emailMode) {
    return (
      <form action={submitEmail} className="login-step mt-4 space-y-5">
        <h1 className="text-3xl font-black tracking-tight text-black">Welcome back</h1>
        <p className="text-sm font-semibold text-black">Sign in to your restaurant workspace</p>
        <BackButton label="Sign in with PIN" onClick={() => setEmailMode(false)} />
        <label className="block">
          <span className="mb-2 block text-sm font-black">Email</span>
          <input name="email" type="email" autoComplete="email" required className={fieldClass} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-black">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
            className={fieldClass}
          />
        </label>
        {error ? (
          <p className="rounded-xl border-2 border-red-700 bg-red-50 p-3 text-sm font-bold text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    );
  }

  if (!role) {
    return (
      <div className="login-step mt-4">
        <h1 className="text-3xl font-black tracking-tight text-black sm:text-4xl">Welcome back</h1>
        <p className="mt-2 text-sm font-semibold text-black">Sign in to your restaurant workspace</p>
        <h2 className="mb-3 mt-7 text-xs font-black uppercase tracking-[0.2em] text-[#b8860b]">Select your role</h2>
        <div className="grid gap-2.5">
          {ROLE_ORDER.map((id) => {
            const item = ROLE_COPY[id];
            const Icon = item.Icon;
            return (
              <button
                key={id}
                type="button"
                onClick={() => void chooseRole(id)}
                className="flex min-h-[4.5rem] items-center gap-4 rounded-xl border-2 border-black bg-white px-4 py-3 text-left transition duration-150 hover:-translate-y-0.5 hover:border-[#d4af37] hover:bg-[#d4af37] hover:shadow-md active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-black text-[#d4af37]">
                  <Icon size={22} aria-hidden />
                </span>
                <span>
                  <span className="block text-lg font-black tracking-wide">{item.title}</span>
                  <span className="text-sm font-semibold text-black">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setEmailMode(true)}
          className="mt-5 min-h-11 text-sm font-black text-[#b8860b] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2"
        >
          Use email and password
        </button>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="login-step mt-4 space-y-4">
        <BackButton
          label="All roles"
          onClick={() => {
            setRole(null);
            setStaff(null);
            setLoadFailed(false);
            setStaffQuery("");
          }}
        />
        <h1 className="text-3xl font-black tracking-tight">Select your account</h1>
        <p className="text-sm font-semibold text-black">
          {ROLE_COPY[role].title} · {ROLE_COPY[role].hint}
        </p>

        {staff === null ? (
          <div aria-live="polite" aria-busy="true">
            <p className="mb-3 text-sm font-black text-black">Loading team...</p>
            <div className="grid gap-2">
              {["a", "b", "c", "d"].map((slot) => (
                <div key={slot} className="flex min-h-16 items-center gap-3 rounded-xl border-2 border-[#d4af37] bg-[#fff4cc] px-4">
                  <span className="size-11 rounded-lg bg-[#d4af37]" />
                  <span className="h-4 flex-1 rounded bg-[#d4af37]" />
                </div>
              ))}
            </div>
          </div>
        ) : loadFailed ? (
          <div className="rounded-xl border-2 border-black p-5" role="alert">
            <p className="text-lg font-black">We couldn&apos;t load the team</p>
            <p className="mt-1 text-sm font-semibold">Please try again.</p>
            <button type="button" onClick={() => void chooseRole(role)} className={`${primaryButtonClass} mt-4`}>
              Retry
            </button>
          </div>
        ) : staff.length === 0 ? (
          <p className="rounded-xl border-2 border-[#d4af37] bg-[#fff4cc] p-4 text-sm font-bold text-black">
            No active {roleTitle(role).toLowerCase()} accounts with a PIN. Ask an owner or admin to create a temporary PIN.
          </p>
        ) : (
          <>
            {staff.length > 1 ? (
              <label className="relative block">
                <span className="sr-only">Search staff</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black" aria-hidden />
                <input
                  type="search"
                  value={staffQuery}
                  onChange={(event) => setStaffQuery(event.target.value)}
                  placeholder="Search staff..."
                  autoComplete="off"
                  className={`${fieldClass} pl-10`}
                />
              </label>
            ) : null}
            {visibleStaff.length === 0 ? (
              <p className="rounded-xl border-2 border-black p-4 text-sm font-bold">No matching staff.</p>
            ) : (
              <div className="grid gap-2">
                {visibleStaff.map((person) => (
                  <button
                    key={person.username}
                    type="button"
                    onClick={() => {
                      setSelected(person);
                      setPin("");
                      setError("");
                    }}
                    className="flex min-h-16 items-center gap-3 rounded-xl border-2 border-black bg-white px-3 text-left transition duration-150 hover:-translate-y-0.5 hover:border-[#d4af37] hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-black text-sm font-black text-[#d4af37]">
                      {staffInitials(person)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black">{publicStaffName(person)}</span>
                      <span className="mt-1 inline-flex rounded-full bg-[#d4af37] px-2 py-0.5 text-[10px] font-black tracking-[0.14em] text-black">
                        {person.role}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="login-step mt-4 space-y-5">
      <BackButton
        label="Change account"
        onClick={() => {
          setSelected(null);
          setPin("");
          setError("");
        }}
      />
      <div className="rounded-xl border-2 border-black p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-lg bg-black text-sm font-black text-[#d4af37]">
            {staffInitials(selected)}
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Welcome, {welcomeFirstName(selected)}</h1>
            <p className="mt-1 inline-flex rounded-full bg-[#d4af37] px-2 py-0.5 text-[10px] font-black tracking-[0.14em] text-black">
              {selected.role}
            </p>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-[#b8860b]">Enter your PIN</p>
        <div
          className="mt-3 flex justify-center gap-3"
          role="img"
          aria-label={`PIN, ${pin.length} of 4 digits entered`}
        >
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`size-4 rounded-full ${index < pin.length ? "bg-black" : "border-2 border-black bg-white"}`}
            />
          ))}
        </div>
      </div>
      <PinPad value={pin} onChange={setPin} disabled={pending} />
      {error ? (
        <p className="rounded-xl border-2 border-red-700 bg-red-50 p-3 text-sm font-bold text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" disabled={pending || pin.length !== 4} onClick={() => void submitPin()} className={primaryButtonClass}>
        {pending ? "Signing in…" : "Login"}
      </button>
    </div>
  );
}
