import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-zenith-border/80 bg-zenith-card p-5 ${className}`}
      {...props}
    />
  );
}
