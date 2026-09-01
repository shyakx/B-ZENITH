import { Skeleton } from "@/components/ui/Skeleton";

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-zenith-border bg-white p-6">
        <Skeleton className="mx-auto h-20 w-20 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-7 w-40" />
        <Skeleton className="mx-auto mt-6 h-16 w-full" />
        <Skeleton className="mx-auto mt-3 h-16 w-full" />
      </div>
    </div>
  );
}
