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
        const className =
          variant === "sidebar"
            ? `block rounded-xl px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
                active ? "bg-zenith-gold text-white" : "text-zenith-cream hover:bg-zenith-raised"
              }`
            : `rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
                active ? "bg-zenith-gold text-white" : "text-zenith-cream"
              }`;

        return (
          <Link key={item.href} href={item.href} className={className} aria-current={active ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
