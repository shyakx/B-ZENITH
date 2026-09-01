"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, type NavItem } from "@/lib/navigation";

export function AppNav({
  items,
  variant,
}: {
  items: NavItem[];
  variant: "sidebar" | "mobile";
}) {
  const pathname = usePathname() ?? "";
  const hrefs = items.map((item) => item.href);

  return (
    <>
      {items.map((item) => {
        const active = isNavActive(pathname, item.href, hrefs);
        if (variant === "mobile") {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
                active ? "bg-zenith-gold text-white" : "text-zenith-cream"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block min-w-0 rounded-xl px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
              active ? "bg-zenith-gold text-white" : "text-zenith-cream hover:bg-zenith-raised"
            }`}
            aria-current={active ? "page" : undefined}
            title={`${item.label} — ${item.hint}`}
          >
            <span className="block truncate text-[13px] font-semibold leading-tight">{item.label}</span>
            <span className={`mt-0.5 block text-[10px] leading-snug ${active ? "text-white/80" : "text-zenith-muted"}`}>
              {item.hint}
            </span>
          </Link>
        );
      })}
    </>
  );
}
