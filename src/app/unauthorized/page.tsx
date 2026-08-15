import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PoweredBy } from "@/components/powered-by";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-4">
      <section className="max-w-md rounded-lg border bg-white p-8 text-center">
        <BrandLogo size={88} className="mx-auto mb-4 rounded-lg" />
        <p className="text-sm font-black tracking-widest text-[#947313]">B-ZENITH</p>
        <h1 className="mt-2 text-3xl font-black">Access denied</h1>
        <p className="mt-3 text-stone-600">Your staff role does not permit access to this area.</p>
        <Link href="/" className="mt-6 inline-grid min-h-11 place-items-center rounded-md bg-black px-5 font-bold text-[#d4af37]">Return to home</Link>
        <PoweredBy className="mt-6 text-stone-400" />
      </section>
    </main>
  );
}
