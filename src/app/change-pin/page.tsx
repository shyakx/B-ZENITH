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
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <BrandLogo size={96} className="mb-6 rounded-full" priority />
      <section className="w-full max-w-md rounded-md border border-black bg-white p-7">
        <p className="text-sm font-medium tracking-[0.16em] text-black">B-ZENITH</p>
        <h1 className="mt-2 text-2xl font-medium text-black">Create your PIN</h1>
        <p className="mb-6 mt-2 text-sm text-black">
          {session.user.name}, you signed in with a temporary PIN. Choose a personal 4-digit PIN before using the POS.
        </p>
        <ChangePinForm userId={session.user.id} role={session.user.role} />
      </section>
      <PoweredBy className="mt-6 text-black" />
    </main>
  );
}
