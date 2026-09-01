import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-zenith-gold text-white hover:bg-zenith-gold-bright disabled:bg-zenith-border disabled:text-zenith-muted",
  secondary:
    "border-2 border-zenith-gold bg-white text-zenith-gold hover:bg-zenith-raised",
  ghost: "text-zenith-gold hover:bg-zenith-raised",
  danger: "bg-zenith-danger text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`touch-btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold focus-visible:ring-offset-1 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
