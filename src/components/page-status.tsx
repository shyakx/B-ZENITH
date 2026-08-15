export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center">
      <p className="font-bold">{title}</p>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
    </div>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-4 p-1" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded-md bg-stone-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-28 animate-pulse rounded-lg bg-stone-200" />
        <div className="h-28 animate-pulse rounded-lg bg-stone-200" />
        <div className="h-28 animate-pulse rounded-lg bg-stone-200" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
      <p className="text-sm font-semibold text-stone-500">{label}</p>
    </div>
  );
}
