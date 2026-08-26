"use client";

import { useState } from "react";
import { ArrowLeft, Users, Zap, Armchair, Bed, Truck, ShoppingBag } from "lucide-react";
import { ServiceChannel, SessionStatus, type Role } from "@prisma/client";
import { SessionInfo, TableInfo } from "./types";
import { formatMoney } from "@/lib/datetime";
import { StatusBadge } from "@/components/dashboard/ui";
import {
  groupTableFloor,
  presentTableFloor,
  TABLE_UX,
  type TableFloorCard,
} from "@/lib/table-selection";

interface ServiceDashboardProps {
  operator: { id: string; role: Role };
  activeSessions: SessionInfo[];
  tables: TableInfo[];
  onSelectChannel: (channel: ServiceChannel) => void;
  onOpenSession: (sessionId: string) => void;
  onSelectTable: (tableId: string) => void;
}

export function ServiceDashboard({
  operator,
  activeSessions,
  tables,
  onSelectChannel,
  onOpenSession,
  onSelectTable,
}: ServiceDashboardProps) {
  const [floor, setFloor] = useState<"CHANNELS" | "TABLES">("CHANNELS");

  const channels = [
    { id: ServiceChannel.TABLE, label: "Table", hint: TABLE_UX.channelHint, icon: Users },
    { id: ServiceChannel.WALK_IN, label: "Walk-in", icon: Zap },
    { id: ServiceChannel.COUNTER, label: "Counter", icon: Armchair },
    { id: ServiceChannel.ACCOMMODATION, label: "Room", icon: Bed },
    { id: ServiceChannel.DELIVERY, label: "Delivery", icon: Truck },
    { id: ServiceChannel.TAKEAWAY, label: "Takeaway", icon: ShoppingBag },
  ];

  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED");
  const availableTables = tables.filter((t) => t.status === "AVAILABLE");
  const outOfService = tables.filter((t) => t.status === "OUT_OF_SERVICE");
  const settling = activeSessions.filter((s) => s.status === SessionStatus.SETTLING);
  const live = activeSessions.filter((s) => s.status === SessionStatus.ACTIVE);

  if (floor === "TABLES") {
    return (
      <TableSelectionScreen
        operator={operator}
        tables={tables}
        sessions={activeSessions}
        onBack={() => setFloor("CHANNELS")}
        onSelectTable={onSelectTable}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.12em] text-black">Point of sale</p>
          <h1 className="bz-page-title">Service floor</h1>
          <p className="mt-1 text-sm font-medium text-black">
            Choose a channel to start service. Checkout stays on the session screen.
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
              type="button"
              onClick={() => {
                if (channel.id === ServiceChannel.TABLE) {
                  setFloor("TABLES");
                  return;
                }
                onSelectChannel(channel.id);
              }}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border border-black bg-white px-3 py-3 text-sm font-medium"
            >
              <channel.icon size={22} />
              <span className="text-sm">{channel.label}</span>
              {"hint" in channel && channel.hint ? (
                <span className="text-[11px] font-medium text-black">{channel.hint}</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-black bg-white">
        <div className="border-b border-black px-4 py-3">
          <h2 className="bz-section-title">Open sessions ({activeSessions.length})</h2>
        </div>
        {activeSessions.length === 0 ? (
          <p className="p-8 text-center text-sm text-black">No active sessions.</p>
        ) : (
          <ul className="divide-y divide-black">
            {activeSessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onOpenSession(session.id)}
                  className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-black">
                        {session.channel.replaceAll("_", "")}
                      </span>
                      <StatusBadge tone={session.status === SessionStatus.SETTLING ? "warn" : "ok"}>
                        {session.status === SessionStatus.SETTLING ? "Pay" : "Open"}
                      </StatusBadge>
                    </span>
                    <span className="mt-1 block font-semibold">
                      {session.table?.name || session.destinationLabel || session.customerName || "Guest"}
                    </span>
                    <span className="block text-xs text-black">
                      {session.waiter.name || "Staff"} · {session.roundCount} rounds
                    </span>
                  </span>
                  <span className="text-right font-semibold">{formatMoney(session.totalAmount, "RWF", 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TableSelectionScreen({
  operator,
  tables,
  sessions,
  onBack,
  onSelectTable,
}: {
  operator: { id: string; role: Role };
  tables: TableInfo[];
  sessions: SessionInfo[];
  onBack: () => void;
  onSelectTable: (tableId: string) => void;
}) {
  const cards = presentTableFloor({
    tables,
    sessions,
    operatorRole: operator.role,
    operatorId: operator.id,
  });
  const grouped = groupTableFloor(cards);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="bz-kicker text-black">POS</p>
          <h1 className="bz-page-title">{TABLE_UX.title}</h1>
          <p className="bz-subtitle">{TABLE_UX.subtitle}</p>
        </div>
        <button type="button" onClick={onBack} className="bz-btn-outline inline-flex min-h-11 items-center gap-2 px-4">
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {tables.length === 0 ? (
        <p className="rounded-md border border-black bg-white px-4 py-8 text-center text-sm text-black">
          {TABLE_UX.emptyConfigured}
        </p>
      ) : (
        <div className="space-y-6">
          <TableGroup title="Available" cards={grouped.available} onSelectTable={onSelectTable} />
          <TableGroup title="In service" cards={grouped.inService} onSelectTable={onSelectTable} />
          <TableGroup title="Unavailable" cards={grouped.unavailable} onSelectTable={onSelectTable} />
        </div>
      )}
    </div>
  );
}

function TableGroup({
  title,
  cards,
  onSelectTable,
}: {
  title: string;
  cards: TableFloorCard[];
  onSelectTable: (tableId: string) => void;
}) {
  if (cards.length === 0) return null;

  return (
    <section>
      <h2 className="bz-section-title mb-2 border-b border-black pb-2">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            aria-disabled={!card.selectable}
            onClick={() => onSelectTable(card.id)}
            className={`flex min-h-28 flex-col items-start justify-between rounded-md border px-3 py-3 text-left ${
              card.group === "available"
                ? "border-black bg-white"
                : card.selectable
                  ? "border-[#FFD758] bg-[#FFD758] text-black"
                  : card.group === "in-service"
                    ? "border-black bg-black text-[#FFD758]"
                    : "border-black bg-white text-black"
            }`}
          >
            <span className="text-lg font-semibold">{card.name}</span>
            <span>
              <span className="block text-sm font-medium">{card.statusLabel}</span>
              <span className="mt-1 block text-xs font-medium">{card.actionLabel}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
