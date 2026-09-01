import { InventoryNav } from "@/components/manager/InventoryNav";

export const maxDuration = 30;

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <InventoryNav />
      {children}
    </div>
  );
}
