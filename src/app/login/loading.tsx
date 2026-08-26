export default function LoginLoading() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-black lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:overflow-hidden">
      <aside className="bg-black px-5 py-6 lg:min-h-dvh lg:px-12 lg:py-12">
        <p className="font-black tracking-[0.28em] text-[#d4af37]">B-ZENITH</p>
        <p className="mt-3 text-2xl font-black text-white">Signing in…</p>
      </aside>
      <section className="border-t-8 border-[#d4af37] bg-white px-5 py-8 lg:border-l-8 lg:border-t-0 lg:px-12">
        <div className="mx-auto max-w-md space-y-3">
          <div className="h-16 rounded-xl bg-[#d4af37]" />
          <div className="h-16 rounded-xl bg-[#d4af37]" />
          <div className="h-16 rounded-xl bg-[#d4af37]" />
        </div>
      </section>
    </main>
  );
}
