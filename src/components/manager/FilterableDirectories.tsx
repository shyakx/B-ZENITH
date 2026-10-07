"use client";

import { useMemo, useState } from "react";
import { SupplierActiveButton } from "@/components/manager/InventoryForms";
import { TableRenameForm } from "@/components/manager/TableManager";
import { TableRow } from "@/components/manager/ProductForm";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
};

export function SupplierDirectory({ suppliers }: { suppliers: SupplierRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const visible = useMemo(
    () =>
      suppliers.filter(
        (supplier) =>
          (!status || supplier.active === (status === "active")) &&
          matchesSearch(query, supplier.name, supplier.phone, supplier.email),
      ),
    [suppliers, query, status],
  );

  return (
    <div>
      <ListSearchField value={query} onChange={setQuery} placeholder="Search supplier or contact…" />
      <label className="mb-3 block space-y-1">
        <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Status</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold"
        >
          <option value="">All suppliers</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <p className="mb-2 text-xs text-zenith-muted">{visible.length} suppliers shown.</p>
      <div className="space-y-3">
        {visible.map((supplier) => (
          <div key={supplier.id} className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{supplier.name}</div>
              <div className="text-sm text-zenith-muted">
                {supplier.active ? "Active" : "Inactive"}
                {supplier.phone ? ` · ${supplier.phone}` : ""}
                {supplier.email ? ` · ${supplier.email}` : ""}
              </div>
            </div>
            <SupplierActiveButton id={supplier.id} active={supplier.active} />
          </div>
        ))}
        {visible.length === 0 ? (
          <p className="text-sm text-zenith-muted">
            {suppliers.length ? "No suppliers match these filters." : "No suppliers yet."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type TableRowData = {
  id: string;
  name: string;
  active: boolean;
  inUse: boolean;
};

export function TableDirectory({ tables }: { tables: TableRowData[] }) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("");
  const [status, setStatus] = useState("");
  const visible = useMemo(
    () =>
      tables.filter(
        (table) =>
          matchesSearch(query, table.name) &&
          (!status || table.active === (status === "active")) &&
          (!availability || table.inUse === (availability === "inUse")),
      ),
    [tables, query, status, availability],
  );

  return (
    <div>
      <ListSearchField value={query} onChange={setQuery} placeholder="Search table name…" />
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold">
            <option value="">All tables</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Availability</span>
          <select value={availability} onChange={(event) => setAvailability(event.target.value)} className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold">
            <option value="">Any availability</option>
            <option value="inUse">In use</option>
            <option value="available">Available</option>
          </select>
        </label>
      </div>
      <p className="mb-2 text-xs text-zenith-muted">{visible.length} tables shown.</p>
      {visible.length === 0 ? (
        <p className="text-sm font-semibold">
          {tables.length ? "No tables match these filters." : "No tables yet. Add the first table above."}
        </p>
      ) : (
        <div className="min-w-0 space-y-3">
          {visible.map((table) => (
            <div key={table.id} className="rounded-xl border border-zenith-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{table.name}</div>
                  <div className="text-sm text-zenith-muted">
                    {table.active ? "Active" : "Inactive"}
                    {table.inUse ? " · In use" : table.active ? " · Available" : ""}
                  </div>
                </div>
                <TableRow table={table} showLabel={false} />
              </div>
              <TableRenameForm table={table} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
