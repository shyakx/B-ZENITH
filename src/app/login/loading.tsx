export default function LoginLoading() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-black lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:overflow-hidden">
      <aside className="bg-black px-5 py-6 lg:min-h-dvh lg:px-12 lg:py-12">
        <p className="font-medium tracking-[0.22em] text-[#FFD758]">B-ZENITH</p>
        <p className="mt-3 text-xl font-medium text-white">Signing in</p>
      </aside>
      <section className="border-t-4 border-[#FFD758] bg-white px-5 py-8 lg:border-l-4 lg:border-t-0 lg:px-12">
        <div className="mx-auto max-w-md space-y-3">
          <div className="h-14 rounded-md border border-black bg-white" />
          <div className="h-14 rounded-md border border-black bg-white" />
          <div className="h-14 rounded-md border border-black bg-white" />
        </div>
      </section>
    </main>
  );
}
