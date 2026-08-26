import Image from "next/image";

export function BrandLogo({
  size = 48,
  className ="",
  priority = false,
  variant ="full",
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  variant?:"full" |"receipt";
}) {
  const src = variant ==="receipt" ?"/brand/bzenith-receipt.png" :"/brand/bzenith-logo.png";
  return (
    <Image
      src={src}
      alt="B-ZENITH"
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

