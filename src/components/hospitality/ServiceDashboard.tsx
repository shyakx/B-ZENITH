"use client";

import {
  Users,
  Zap,
  Armchair,
  Bed,
  Truck,
  ShoppingBag,
  PlusCircle,
  Clock,
  LayoutGrid,
  List
} from "lucide-react";
import { ServiceChannel } from "@prisma/client";
import { SessionInfo, TableInfo } from "./types";
import { formatDateTime } from "@/lib/datetime";

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
    { id: ServiceChannel.TABLE, label: "Table Service", icon: Users, color: "bg-blue-500" },
    { id: ServiceChannel.WALK_IN, label: "Walk-In", icon: Zap, color: "bg-green-500" },
    { id: ServiceChannel.COUNTER, label: "Counter", icon: Armchair, color: "bg-purple-500" },
    { id: ServiceChannel.ACCOMMODATION, label: "Accommodation", icon: Bed, color: "bg-amber-500" },
    { id: ServiceChannel.DELIVERY, label: "Delivery", icon: Truck, color: "bg-rose-500" },
    { id: ServiceChannel.TAKEAWAY, label: "Takeaway", icon: ShoppingBag, color: "bg-cyan-500" },
  ];

  const occupiedTables = tables.filter(t => t.status === "OCCUPIED");
  const availableTables = tables.filter(t => t.status === "AVAILABLE");

  return (
    <div className="space-y-6 p-4 sm:space-y-8 sm:p-6">
      <header>
        <h1 className="text-3xl font-black">Service Dashboard</h1>
        <p className="text-stone-500">Select a service channel to start or manage active sessions.</p>
      </header>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <PlusCircle size={20} className="text-[#a5821d]" />
          New Service
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel.id)}
              className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border-2 border-transparent bg-white p-4 shadow-sm sm:min-h-32 sm:p-6"
            >
              <div className={`rounded-full ${channel.color} p-4 text-white`}>
                <channel.icon size={32} />
              </div>
              <span className="text-center text-sm font-bold sm:text-base">{channel.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Clock size={20} className="text-[#a5821d]" />
            Active Sessions ({activeSessions.length})
          </h2>
          <div className="space-y-3">
            {activeSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-white p-8 text-center text-stone-500">
                No active sessions.
              </div>
            ) : (
              activeSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onOpenSession(session.id)}
                  className="flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left transition hover:border-[#d4af37]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-stone-400">
                        {session.channel}
                      </span>
                      {session.table && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                          {session.table.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-bold">
                      {session.destinationLabel || session.customerName || "Anonymous Guest"}
                    </p>
                    <p className="text-xs text-stone-500">
                      Waiter: {session.waiter.name || "Unknown"} · Started {new Date(session.openedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black">RWF {session.totalAmount.toLocaleString()}</p>
                    <p className="text-xs text-stone-400">{session.roundCount} Rounds</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <LayoutGrid size={20} className="text-[#a5821d]" />
              Table Map ({occupiedTables.length}/{tables.length})
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {tables.map((table) => {
              const isOccupied = table.status === "OCCUPIED";
              const session = activeSessions.find(s => s.tableId === table.id);

              return (
                <button
                  key={table.id}
                  onClick={() => onSelectTable(table.id)}
                  className={`flex min-h-20 flex-col items-center justify-center rounded-xl border-2 sm:min-h-24 ${
                    isOccupied
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                      : table.status === "OUT_OF_SERVICE"
                      ? "border-stone-200 bg-stone-100 text-stone-400"
                      : "border-stone-200 bg-white hover:border-[#d4af37]"
                  }`}
                >
                  <span className="text-xl font-black">{table.name}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {table.status.replace("_", " ")}
                  </span>
                  {session && (
                    <span className="mt-1 text-[10px] font-bold">
                      RWF {(session.totalAmount / 1000).toFixed(1)}k
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
