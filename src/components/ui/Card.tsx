import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-zenith-border bg-zenith-card p-3 ${className}`}
      {...props}
    />
  );
}
