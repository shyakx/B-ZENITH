"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Category = { id: string; name: string };

export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = categories.find((category) => category.id === selectedId) ?? categories[0];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative mb-4 w-full min-w-0 max-w-xl">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-zenith-muted">Category</p>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border-2 border-zenith-gold bg-white px-4 py-3 text-left text-lg font-semibold text-zenith-gold"
      >
        <span className="min-w-0 break-words">{selected?.name ?? "Category"}</span>
        <ChevronDown
          size={20}
          className={`shrink-0 transition-transform duration-150 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Categories"
          className="absolute left-0 top-full z-20 mt-2 w-full min-w-0 max-w-full rounded-2xl border border-zenith-border bg-white p-3 shadow-[0_8px_24px_rgba(36,22,15,0.08)]"
        >
          <div className="order-categories max-h-[min(20rem,70vh)] overflow-x-hidden overflow-y-auto">
            {categories.map((category) => {
              const active = category.id === selectedId;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onSelect(category.id);
                    setOpen(false);
                  }}
                  className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold ${
                    active ? "bg-zenith-gold text-white" : "border border-zenith-border bg-white"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
