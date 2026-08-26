"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InventoryOperationDialog } from "@/components/inventory-operation-dialog";

export type ManagedTable = {
  id: string;
  name: string;
  status: string;
  active: boolean;
  sortOrder: number;
  openSession?: { waiterName: string | null } | null;
};

export function TableManagement({ tables }: { tables: ManagedTable[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ManagedTable | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const sorted = useMemo(
    () => [...tables].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [tables],
  );

  function openCreate() {
    setEditing(null);
    setName("");
    setActive(true);
    setError("");
    setDialog("create");
  }

  function openEdit(table: ManagedTable) {
    setEditing(table);
    setName(table.name);
    setActive(table.active);
    setError("");
    setDialog("edit");
  }

  function closeDialog() {
    if (pending) return;
    setDialog(null);
    setEditing(null);
    setError("");
  }

  async function submit() {
    setPending(true);
    setError("");
    try {
      const res = await fetch(dialog === "create" ? "/api/tables" : `/api/tables/${editing!.id}`, {
        method: dialog === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to save table.");
      setDialog(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save table.");
    } finally {
      setPending(false);
    }
  }

  async function setActiveState(table: ManagedTable, nextActive: boolean) {
    setPending(true);
    setError("");
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to update table.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update table.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openCreate} className="bz-btn-primary min-h-11 px-4">
          Add Table
        </button>
      </div>

      {error && !dialog ? <p className="bz-alert">{error}</p> : null}

      {sorted.length === 0 ? (
        <div className="rounded-md border border-black bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-black">No tables configured</p>
          <p className="mt-2 text-sm font-normal text-black">
            Add the restaurant’s real tables. Waiters will see them in POS → Table.
          </p>
          <button type="button" onClick={openCreate} className="bz-btn-primary mt-4 min-h-11 px-4">
            Add Table
          </button>
        </div>
      ) : (
        <ul className="grid gap-2">
          {sorted.map((table) => {
            const occupied = table.status === "OCCUPIED" || Boolean(table.openSession);
            const serviceLabel = !table.active
              ? "Inactive"
              : occupied
                ? "Occupied"
                : table.status === "OUT_OF_SERVICE"
                  ? "Out of service"
                  : "Available";
            return (
              <li key={table.id} className="rounded-md border border-black bg-white px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-black">{table.name}</p>
                    <p className="mt-1 text-sm font-medium text-black">{serviceLabel}</p>
                    {occupied && table.openSession?.waiterName ? (
                      <p className="text-sm font-normal text-black">Serving: {table.openSession.waiterName}</p>
                    ) : null}
                    <p className="text-xs font-medium uppercase tracking-widest text-black">
                      {table.active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEdit(table)} className="bz-btn-outline min-h-11 px-4">
                      Edit
                    </button>
                    {table.active ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void setActiveState(table, false)}
                        className="bz-btn-outline min-h-11 px-4 disabled:border-2 disabled:border-dashed"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void setActiveState(table, true)}
                        className="bz-btn-primary min-h-11 px-4 disabled:border-2 disabled:border-dashed"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog ? (
        <InventoryOperationDialog
          title={dialog === "create" ? "Add Table" : "Edit Table"}
          description={dialog === "create" ? "Use the real floor name, such as T1 or VIP 1." : "Renaming a table does not change existing sessions."}
          onClose={closeDialog}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="block text-sm font-medium text-black">
              Table name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="bz-input mt-1"
                placeholder="T1"
                autoFocus
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-black">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              Active
            </label>
            {error ? <p className="bz-alert">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={pending} className="bz-btn-primary min-h-11 px-4 disabled:border-2 disabled:border-dashed">
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" disabled={pending} onClick={closeDialog} className="bz-btn-outline min-h-11 px-4">
                Cancel
              </button>
            </div>
          </form>
        </InventoryOperationDialog>
      ) : null}
    </div>
  );
}
