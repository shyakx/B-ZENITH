"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { homePath } from "@/lib/permissions";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password.");
      setPending(false);
      return;
    }
    const session = await getSession();
    router.push(session?.user ? homePath(session.user.role) : "/");
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-bold">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-12 w-full rounded-md border border-stone-300 px-4 outline-none focus:border-[#b38f20] focus:ring-2 focus:ring-[#d4af37]/30"
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
          className="min-h-12 w-full rounded-md border border-stone-300 px-4 outline-none focus:border-[#b38f20] focus:ring-2 focus:ring-[#d4af37]/30"
        />
      </label>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-md bg-black px-5 font-bold text-[#d4af37] hover:bg-stone-900 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
