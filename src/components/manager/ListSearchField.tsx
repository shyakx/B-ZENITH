"use client";

import { Input } from "@/components/ui/Input";

export function matchesSearch(query: string, ...parts: Array<string | null | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((part) => (part ?? "").toLowerCase().includes(needle));
}

export function ListSearchField({
  value,
  onChange,
  placeholder = "Search…",
  label = "Search",
  showLabel = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  showLabel?: boolean;
}) {
  return (
    <label className="mb-3 block">
      <span className={showLabel ? "mb-1.5 block text-sm font-semibold text-zenith-ink" : "sr-only"}>
        {label}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        autoComplete="off"
      />
    </label>
  );
}
