export function PoweredBy({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "receipt";
}) {
  if (variant === "receipt") {
    return (
      <p className={`receipt-powered-by mt-1 text-center text-[9px] font-semibold leading-none text-[#d4af37] ${className}`}>
        Powered by Cloud Sync
      </p>
    );
  }

  return (
    <p className={`text-center text-[10px] tracking-wide ${className}`}>
      Powered by Cloud Sync Company
    </p>
  );
}
