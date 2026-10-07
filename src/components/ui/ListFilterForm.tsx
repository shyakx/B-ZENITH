import Link from "next/link";

export type ListFilterOption = { value: string; label: string };

export type ListFilterField = {
  name: string;
  label: string;
  type: "search" | "date" | "number" | "select";
  value?: string;
  placeholder?: string;
  options?: ListFilterOption[];
};

export function ListFilterForm({
  fields,
  action,
}: {
  fields: ListFilterField[];
  action: string;
}) {
  const hasFilters = fields.some((field) => field.value);

  return (
    <form action={action} method="get" className="mb-5 flex flex-wrap items-end gap-3">
      {fields.map((field) => (
        <label key={field.name} className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">
            {field.label}
          </span>
          {field.type === "select" ? (
            <select
              name={field.name}
              defaultValue={field.value ?? ""}
              className="min-w-36 rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
            >
              {(field.options ?? []).map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              name={field.name}
              defaultValue={field.value ?? ""}
              placeholder={field.placeholder}
              maxLength={field.type === "search" ? 120 : undefined}
              min={field.type === "number" ? 0 : undefined}
              step={field.type === "number" ? 1 : undefined}
              className="min-w-36 rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
            />
          )}
        </label>
      ))}
      <button className="rounded-xl bg-zenith-gold px-4 py-2 font-semibold text-white">Apply filters</button>
      {hasFilters ? (
        <Link href={action} className="self-center text-sm font-semibold text-zenith-gold">
          Clear filters
        </Link>
      ) : null}
    </form>
  );
}
