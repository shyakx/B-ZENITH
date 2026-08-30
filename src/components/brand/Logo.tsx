import Image from "next/image";

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export function Logo({ size = 56, showWordmark = false, className = "" }: LogoProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <Image
        src="/brand/logo.png"
        alt="B-ZENITH"
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        priority
      />
      {showWordmark ? (
        <div className="min-w-0 leading-tight">
          <div className="font-display text-xl tracking-[0.12em] text-zenith-gold">B-ZENITH</div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-zenith-muted">
            Bar · Cafe · Kitchen
          </div>
        </div>
      ) : null}
    </div>
  );
}
