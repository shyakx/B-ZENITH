import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { LoginOperationsPanel } from "@/components/login-operations-panel";
import { PoweredBy } from "@/components/powered-by";
import { authOptions } from "@/lib/auth";
import { homePath } from "@/lib/permissions";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.mustChangePin) redirect("/change-pin");
  if (session?.user) redirect(homePath(session.user.role));

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:overflow-hidden">
      <LoginOperationsPanel />
      <section className="flex min-h-0 flex-col overflow-y-auto border-t-8 border-[#d4af37] bg-white lg:border-l-8 lg:border-t-0">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4 sm:max-w-lg sm:px-8 sm:py-6 lg:justify-center lg:py-12">
          <p className="text-xs font-black tracking-[0.28em] text-[#b8860b]">B-ZENITH</p>
          <LoginForm />
          <PoweredBy className="mt-8 text-[#b8860b] lg:mt-10" />
        </div>
      </section>
    </main>
  );
}
