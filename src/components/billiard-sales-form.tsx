import { saveTodayBilliardSales } from "@/actions/billiard";
import { ActionForm } from "@/components/action-form";

export function BilliardSalesForm({
  defaultAmount,
  defaultNote,
  compact = false,
}: {
  defaultAmount?: number;
  defaultNote?: string;
  compact?: boolean;
}) {
  return (
    <ActionForm
      action={saveTodayBilliardSales}
      className={
        compact
          ? "grid min-w-0 gap-3"
          : "grid min-w-0 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
      }
    >
      <label className="grid min-w-0 gap-1 text-sm font-bold">
        Today’s billiard sales (RWF)
        <input
          required
          name="amount"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          defaultValue={defaultAmount ? String(defaultAmount) : ""}
          placeholder="e.g. 45000"
          className="min-h-11 min-w-0 w-full rounded-md border px-3 font-normal"
        />
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-bold">
        Note (optional)
        <input
          name="note"
          maxLength={200}
          defaultValue={defaultNote ?? ""}
          placeholder="Shift or table notes"
          className="min-h-11 min-w-0 w-full rounded-md border px-3 font-normal"
        />
      </label>
      <button className={`min-h-11 self-end rounded-md bg-black px-5 font-bold text-[#d4af37] ${compact ? "w-full" : ""}`}>
        {defaultAmount ? "Update today’s total" : "Save today’s total"}
      </button>
    </ActionForm>
  );
}
