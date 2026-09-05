import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function withAutoPrint(href: string) {
  if (href.includes("print=1")) return href;
  return href.includes("?") ? `${href}&print=1` : `${href}?print=1`;
}

export function PrintSlipLink({
  href,
  label = "Print slip",
  variant = "secondary",
  className = "",
}: {
  href: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return <PrintFactureLink href={href} label={label} variant={variant} className={className} />;
}

export function PrintFactureLink({
  href,
  label = "Print facture",
  variant = "secondary",
  className = "",
}: {
  href: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={withAutoPrint(href)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-w-0 ${className.includes("w-full") ? "w-full" : ""}`}
    >
      <Button type="button" variant={variant} className={className}>
        {label}
      </Button>
    </Link>
  );
}
