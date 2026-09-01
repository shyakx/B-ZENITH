import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const field =
  "min-h-10 w-full rounded-xl border border-zenith-border bg-white px-3 py-2 text-sm text-zenith-cream outline-none placeholder:text-zenith-muted focus:border-zenith-gold focus-visible:ring-2 focus-visible:ring-zenith-gold";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${field} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${field} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${field} ${className}`} {...props} />;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-zenith-muted">{label}</span>
      {children}
    </label>
  );
}
