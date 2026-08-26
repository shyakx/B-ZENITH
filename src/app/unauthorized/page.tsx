import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PoweredBy } from "@/components/powered-by";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-white p-4">
      <section className="max-w-md rounded-lg border bg-white p-8 text-center">
        <BrandLogo size={88} className="mx-auto mb-4 rounded-lg" />
        <p className="text-sm font-semibold tracking-widest text-black">B-ZENITH</p>
        <h1 className="mt-2 text-3xl font-semibold">Access denied</h1>
        <p className="mt-3 text-black">Your staff role does not permit access to this area.</p>
        <Link href="/" className="bz-btn-primary mt-6 inline-grid place-items-center">Return to home</Link>
        <PoweredBy className="mt-6 text-black" />
      </section>
    </main>
  );
}
