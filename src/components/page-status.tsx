export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-md border border-dashed border-black bg-white p-10 text-center">
      <p className="font-semibold text-black">{title}</p>
      {hint && <p className="mt-1 text-sm font-normal text-black">{hint}</p>}
    </div>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-4 p-1" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 rounded-md border border-black bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-28 rounded-md border border-black bg-white" />
        <div className="h-28 rounded-md border border-black bg-white" />
        <div className="h-28 rounded-md border border-black bg-white" />
      </div>
      <div className="h-64 rounded-md border border-black bg-white" />
      <p className="text-sm font-medium text-black">{label}</p>
    </div>
  );
}
