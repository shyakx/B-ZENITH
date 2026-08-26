"use client";

import type { ReactNode } from "react";

export function InventoryOperationDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black p-0 sm:items-center sm:p-6">
      <button type="button" aria-label="Close dialog" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-black bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-black px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-black">{title}</h2>
            {description ? <p className="mt-1 text-sm font-medium text-black">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-md border border-black text-xl font-semibold"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
