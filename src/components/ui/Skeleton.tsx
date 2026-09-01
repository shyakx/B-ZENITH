export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-zenith-raised ${className}`} />;
}

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl" aria-busy="true" aria-live="polite">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
      <Skeleton className="mt-6 h-40 w-full" />
    </div>
  );
}
