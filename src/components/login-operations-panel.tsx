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
  { label: "Inventory", icon: Package },
] as const;

const BOARDS = [
  { kicker: "Floor", title: "Table service", status: "Open", delay: false },
  { kicker: "Pass", title: "Kitchen & bar", status: "Firing", delay: true },
  { kicker: "Till", title: "Payments", status: "Live", delay: false },
] as const;

export function LoginOperationsPanel() {
  return (
    <aside className="relative overflow-hidden bg-black px-4 py-3 text-white sm:px-6 sm:py-5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border-[14px] border-[#d4af37] lg:size-[28rem] lg:border-[22px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-20 size-80 rounded-full border-[18px] border-[#d4af37] lg:size-[32rem]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-2 bg-[#d4af37] max-lg:hidden" />

      <div className="relative flex items-center gap-3 lg:block">
        <BrandLogo size={192} priority className="size-12 rounded-lg sm:size-16 lg:mb-8 lg:size-40 xl:size-48" />
        <div className="min-w-0 lg:max-w-lg">
          <p className="text-[9px] font-black tracking-[0.16em] text-[#d4af37] sm:text-[11px] sm:tracking-[0.28em]">RESTAURANT · CAFÉ · BAR · LOUNGE</p>
          <h2 className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl lg:mt-4 lg:text-5xl xl:text-6xl">
            One system.
            <span className="block text-[#d4af37]">Every operation.</span>
          </h2>
          <p className="mt-2 hidden max-w-md text-sm font-medium text-white lg:mt-4 lg:block lg:text-base">
            Tables, orders, kitchen, bar, payments, and stock — one workspace for the floor.
          </p>
        </div>
      </div>

      <ol
        className="relative mt-3 grid grid-cols-6 gap-1 lg:mt-10 lg:gap-3"
        aria-label="Table, order, kitchen, bar, payment, inventory"
      >
        {FLOW.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.label}>
              <div
                className={`flex min-h-10 w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-[#d4af37] bg-black px-0.5 lg:min-h-[5.5rem] lg:gap-2 lg:px-3 ${index % 2 === 0 ? "login-ops-float" : "login-ops-float-delay"}`}
              >
                <Icon className="size-4 shrink-0 text-[#d4af37] lg:size-6" aria-hidden />
                <span className="hidden max-w-full px-0.5 text-center text-[9px] font-black uppercase tracking-wide sm:block lg:text-xs">
                  {step.label}
                </span>
                <span className="sr-only sm:hidden">{step.label}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <ul className="relative mt-4 hidden gap-3 lg:grid lg:grid-cols-3">
        {BOARDS.map((board) => (
          <li
            key={board.title}
            className={`rounded-xl border-2 border-[#d4af37] bg-black p-4 ${board.delay ? "login-ops-float-delay" : "login-ops-float"}`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d4af37]">{board.kicker}</p>
            <p className="mt-2 font-black">{board.title}</p>
            <p className="mt-3 flex items-center gap-2 text-xs font-bold text-white">
              <span className="login-ops-dot size-2.5 rounded-full bg-[#d4af37]" aria-hidden />
              {board.status}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
