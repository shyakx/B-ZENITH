import {
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutGrid,
  Package,
  Wine,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const FLOW = [
  { label: "Table", icon: LayoutGrid },
  { label: "Order", icon: ClipboardList },
  { label: "Kitchen", icon: ChefHat },
  { label: "Bar", icon: Wine },
  { label: "Payment", icon: CreditCard },
  { label: "Stock", icon: Package },
] as const;

export function LoginOperationsPanel() {
  return (
    <aside className="relative overflow-hidden bg-black px-4 py-4 text-white sm:px-8 sm:py-6 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
      <div className="relative flex items-center gap-3 lg:block">
        <BrandLogo size={160} priority className="size-12 rounded-md sm:size-14 lg:mb-8 lg:size-32 xl:size-36" />
        <div className="min-w-0 lg:max-w-lg">
          <p className="text-[10px] font-medium tracking-[0.18em] text-[#FFD758] sm:text-xs">
            Restaurant · café · bar · lounge
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl lg:mt-3 lg:text-3xl">
            One system.
            <span className="mt-1 block font-medium text-[#FFD758]">Every operation.</span>
          </h2>
          <p className="mt-3 hidden max-w-md text-sm font-normal leading-relaxed text-white lg:block">
            Tables, orders, kitchen, bar, payments, and stock — one workspace for the floor.
          </p>
        </div>
      </div>

      <ol className="relative mt-5 grid grid-cols-6 gap-1.5 lg:mt-10 lg:gap-2" aria-label="Service flow">
        {FLOW.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.label}>
              <div className="flex min-h-10 w-full flex-col items-center justify-center gap-1 rounded-md border border-[#FFD758] bg-black px-0.5 lg:min-h-[4.75rem] lg:gap-1.5 lg:px-2">
                <Icon className="size-4 shrink-0 text-[#FFD758] lg:size-5" aria-hidden />
                <span className="hidden max-w-full px-0.5 text-center text-[9px] font-medium text-white sm:block lg:text-[11px]">
                  {step.label}
                </span>
                <span className="sr-only sm:hidden">{step.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
