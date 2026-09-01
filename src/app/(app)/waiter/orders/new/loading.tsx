import { Skeleton } from "@/components/ui/Skeleton";

export default function PosLoading() {
  return (
    <div className="order-page" aria-busy="true">
      <Skeleton className="h-7 w-40" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    </div>
  );
}
