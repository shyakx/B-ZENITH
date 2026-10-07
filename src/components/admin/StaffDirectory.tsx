"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import { ListSearchField, matchesSearch } from "@/components/manager/ListSearchField";
import { Badge } from "@/components/ui/Badge";
import { roleLabel, ROLES } from "@/lib/auth/roles";
import { formatDate, toDateInput } from "@/lib/dates";

type StaffRow = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: Date;
};

export function StaffDirectory({
  users,
  view = "staff",
}: {
  users: StaffRow[];
  view?: "staff" | "assignments";
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const visible = useMemo(
    () =>
      users.filter((user) => {
        const created = toDateInput(user.createdAt);
        return (
          matchesSearch(query, user.name, roleLabel(user.role)) &&
          (!role || user.role === role) &&
          (!status || user.active === (status === "active")) &&
          (view === "assignments" || !from || created >= from) &&
          (view === "assignments" || !to || created <= to)
        );
      }),
    [users, query, role, status, from, to, view],
  );

  return (
    <div>
      <ListSearchField value={query} onChange={setQuery} placeholder="Search staff name…" />
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold">
            <option value="">All roles</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>{roleLabel(value)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        {view === "staff" ? (
          <>
            <label className="space-y-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Created from</span>
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold" />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-zenith-muted">Created to</span>
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-zenith-border bg-white px-3 py-2 font-semibold" />
            </label>
          </>
        ) : null}
      </div>
      <p className="mb-2 text-xs text-zenith-muted">{visible.length} staff shown.</p>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-zenith-border bg-white px-4 py-5 text-sm text-zenith-muted">
          {users.length ? "No staff match these filters." : "No staff members yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((user) => (
            view === "staff" ? (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="block min-w-0 rounded-xl border border-zenith-border bg-white px-3 py-2.5 hover:border-zenith-gold"
              >
                <StaffLine user={user} />
              </Link>
            ) : (
              <div key={user.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{user.name}</span>
                <span className="font-semibold uppercase tracking-wider text-zenith-gold">
                  {roleLabel(user.role)}{user.active ? "" : " · inactive"}
                </span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function StaffLine({ user }: { user: StaffRow }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-base font-semibold text-zenith-gold">{user.name}</div>
        <div className="mt-0.5 truncate text-sm text-zenith-muted">
          {roleLabel(user.role)} · {formatDate(user.createdAt)}
        </div>
      </div>
      <Badge className={user.active ? "border-emerald-200 bg-emerald-50 text-zenith-success" : "border-zenith-border bg-zenith-surface text-zenith-muted"}>
        {user.active ? "Active" : "Inactive"}
      </Badge>
    </div>
  );
}
