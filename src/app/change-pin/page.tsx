import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { ChangePinForm } from "@/components/change-pin-form";
import { PoweredBy } from "@/components/powered-by";
import { authOptions } from "@/lib/auth";
import { homePath } from "@/lib/permissions";

export default async function ChangePinPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!session.user.mustChangePin) redirect(homePath(session.user.role));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <BrandLogo size={120} className="mb-6 rounded-xl" priority />
      <section className="w-full max-w-md rounded-lg border-t-4 border-[#d4af37] bg-white p-7 shadow-2xl">
        <p className="text-sm font-black tracking-[0.2em] text-[#9a7818]">B-ZENITH</p>
        <h1 className="mt-2 text-3xl font-black">Create your PIN</h1>
        <p className="mb-6 mt-2 text-sm text-stone-500">
          {session.user.name}, you signed in with a temporary PIN. Choose a personal 4-digit PIN before using the POS.
        </p>
        <ChangePinForm userId={session.user.id} role={session.user.role} />
      </section>
      <PoweredBy className="mt-6 text-stone-400" />
    </main>
  );
}
