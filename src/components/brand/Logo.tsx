import Image from "next/image";

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  /** Use on the first paint hero (login). Avoid on chrome that repeats every page. */
  priority?: boolean;
};

export function Logo({ size = 56, showWordmark = false, className = "", priority = false }: LogoProps) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <Image
        src="/brand/logo-mark.webp"
        alt="B-ZENITH"
        width={size}
        height={size}
        sizes={`${size}px`}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        priority={priority}
      />
      {showWordmark ? (
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] font-semibold tracking-wide text-zenith-gold">B-ZENITH</div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-zenith-muted">
            Bar · Cafe · Kitchen
          </div>
        </div>
      ) : null}
    </div>
  );
}
