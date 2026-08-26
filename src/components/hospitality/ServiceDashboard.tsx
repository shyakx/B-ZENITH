"use client";

import { Users, Zap, Armchair, Bed, Truck, ShoppingBag } from "lucide-react";
import { ServiceChannel, SessionStatus } from "@prisma/client";
import { SessionInfo, TableInfo } from "./types";
import { formatMoney } from "@/lib/datetime";
import { StatusBadge } from "@/components/dashboard/ui";

interface ServiceDashboardProps {
  activeSessions: SessionInfo[];
  tables: TableInfo[];
  onSelectChannel: (channel: ServiceChannel) => void;
  onOpenSession: (sessionId: string) => void;
  onSelectTable: (tableId: string) => void;
}

export function ServiceDashboard({
  activeSessions,
  tables,
  onSelectChannel,
  onOpenSession,
  onSelectTable,
}: ServiceDashboardProps) {
  const channels = [
    { id: ServiceChannel.TABLE, label:"Table", icon: Users },
    { id: ServiceChannel.WALK_IN, label:"Walk-in", icon: Zap },
    { id: ServiceChannel.COUNTER, label:"Counter", icon: Armchair },
    { id: ServiceChannel.ACCOMMODATION, label:"Room", icon: Bed },
    { id: ServiceChannel.DELIVERY, label:"Delivery", icon: Truck },
    { id: ServiceChannel.TAKEAWAY, label:"Takeaway", icon: ShoppingBag },
  ];

  const occupiedTables = tables.filter((t) => t.status ==="OCCUPIED");
  const availableTables = tables.filter((t) => t.status ==="AVAILABLE");
  const outOfService = tables.filter((t) => t.status ==="OUT_OF_SERVICE");
  const settling = activeSessions.filter((s) => s.status === SessionStatus.SETTLING);
  const live = activeSessions.filter((s) => s.status === SessionStatus.ACTIVE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.12em] text-black">Point of sale</p>
          <h1 className="bz-page-title">Service floor</h1>
          <p className="mt-1 text-sm font-medium text-black">
            Choose a channel or tap a table. Checkout stays on the session screen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-widest">
          <StatusBadge tone="stop">{occupiedTables.length} occupied</StatusBadge>
          <StatusBadge tone="ok">{availableTables.length} free</StatusBadge>
          {settling.length > 0 ? <StatusBadge tone="warn">{settling.length} awaiting payment</StatusBadge> : null}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <article className="rounded-lg border border-black bg-white px-3 py-3">
          <p className="bz-label">Open sessions</p>
          <p className="bz-kpi">{activeSessions.length}</p>
        </article>
        <article className="rounded-lg border border-black bg-white px-3 py-3">
          <p className="bz-label">Active</p>
          <p className="bz-kpi">{live.length}</p>
        </article>
        <article className="rounded-lg border border-black bg-white px-3 py-3">
          <p className="bz-label">Awaiting payment</p>
          <p className="bz-kpi">{settling.length}</p>
        </article>
        <article className="rounded-lg border border-black bg-white px-3 py-3">
          <p className="bz-label">Tables free</p>
          <p className="bz-kpi">{availableTables.length}</p>
        </article>
        <article className="rounded-lg border border-black bg-white px-3 py-3">
          <p className="bz-label">Out of service</p>
          <p className="bz-kpi">{outOfService.length}</p>
        </article>
      </section>

      <section>
        <h2 className="bz-section-title mb-2">New service</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => {
                if (channel.id === ServiceChannel.TABLE) {
                  document.getElementById("table-map")?.scrollIntoView({ behavior:"smooth", block:"start" });
                  return;
                }
                onSelectChannel(channel.id);
              }}
              className="flex min-h-16 flex-col items-center justify-center gap-2 rounded-md border border-black bg-white px-3 py-3 text-sm font-medium"
            >
              <channel.icon size={22} />
              <span className="text-sm">{channel.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section id="table-map" className="overflow-hidden rounded-lg border border-black bg-white">
          <div className="flex items-center justify-between border-b border-black px-4 py-3">
            <h2 className="bz-section-title">Tables</h2>
            <span className="text-xs font-medium text-black">
              {occupiedTables.length}/{tables.length} occupied
            </span>
          </div>
          {tables.length === 0 ? (
            <p className="p-8 text-center text-sm text-black">No tables configured.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-5">
              {tables.map((table) => {
                const session = activeSessions.find((s) => s.tableId === table.id);
                const settlingTable = session?.status === SessionStatus.SETTLING;
                return (
                  <button
                    key={table.id}
                    onClick={() => onSelectTable(table.id)}
                    className={`flex min-h-20 flex-col items-center justify-center rounded-lg border px-2 py-2 ${
                      settlingTable
                        ?"border-black bg-white"
                        : table.status ==="OCCUPIED"
                          ?"border-black bg-black text-[#FFD758]"
                          : table.status ==="OUT_OF_SERVICE"
                            ?"border-black bg-white text-black"
                            :"border-black bg-white"
                    }`}
                  >
                    <span className="text-lg font-semibold">{table.name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest">
                      {settlingTable ?"Pay" : table.status.replaceAll("_","")}
                    </span>
                    {session ? (
                      <span className="mt-1 text-[10px] font-bold">
                        {formatMoney(session.totalAmount,"RWF", 0)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-black bg-white">
          <div className="border-b border-black px-4 py-3">
            <h2 className="bz-section-title">
              Open sessions ({activeSessions.length})
            </h2>
          </div>
          {activeSessions.length === 0 ? (
            <p className="p-8 text-center text-sm text-black">No active sessions.</p>
          ) : (
            <ul className="divide-y divide-black">
              {activeSessions.map((session) => (
                <li key={session.id}>
                  <button
                    onClick={() => onOpenSession(session.id)}
                    className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-black">
                          {session.channel.replaceAll("_","")}
                        </span>
                        <StatusBadge tone={session.status === SessionStatus.SETTLING ?"warn" :"ok"}>
                          {session.status === SessionStatus.SETTLING ?"Pay" :"Open"}
                        </StatusBadge>
                      </span>
                      <span className="mt-1 block font-semibold">
                        {session.table?.name || session.destinationLabel || session.customerName ||"Guest"}
                      </span>
                      <span className="block text-xs text-black">
                        {session.waiter.name ||"Staff"} · {session.roundCount} rounds
                      </span>
                    </span>
                    <span className="text-right font-semibold">{formatMoney(session.totalAmount,"RWF", 0)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
