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
            ? `block rounded-2xl px-4 py-3 text-base font-semibold ${
                active ? "bg-zenith-gold text-white" : "text-zenith-cream hover:bg-zenith-raised"
              }`
            : `rounded-full px-4 py-2 text-sm font-semibold ${
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
