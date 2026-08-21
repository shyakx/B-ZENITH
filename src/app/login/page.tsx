import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";
import { PoweredBy } from "@/components/powered-by";
import { authOptions } from "@/lib/auth";
import { homePath } from "@/lib/permissions";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.mustChangePin) redirect("/change-pin");
  if (session?.user) redirect(homePath(session.user.role));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <BrandLogo size={160} className="mb-6 rounded-xl" priority />
      <section className="w-full max-w-md rounded-lg border-t-4 border-[#d4af37] bg-white p-7 shadow-2xl sm:p-10">
        <p className="text-sm font-black tracking-[0.2em] text-[#9a7818]">B-ZENITH</p>
        <h1 className="mt-2 text-3xl font-black">Welcome to B-ZENITH</h1>
        <p className="mb-8 mt-2 text-sm text-stone-500">Select your role, tap your name, then enter your PIN.</p>
        <LoginForm />
      </section>
      <PoweredBy className="mt-6 text-stone-400" />
    </main>
  );
}
