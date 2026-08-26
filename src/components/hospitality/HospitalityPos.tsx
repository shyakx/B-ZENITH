"use client";

import { useState } from "react";
import { ServiceDashboard } from "./ServiceDashboard";
import { SessionInterface } from "./SessionInterface";
import { SettlementModal, type SettlementSubmit } from "./SettlementModal";
import { VoidModal, ReturnModal, ExchangeModal, HandoverModal } from "./AdjustmentModals";
import { ChannelCaptureModal, type ChannelCaptureValues } from "./ChannelCaptureModal";
import {
    PosProduct,
    Category,
    SessionInfo,
    TableInfo
} from "./types";
import { ServiceChannel } from "@prisma/client";

interface HospitalityPosProps {
  initialSessions: SessionInfo[];
  initialTables: TableInfo[];
  products: PosProduct[];
  categories: Category[];
  currency: string;
  taxRate: string;
}

export function HospitalityPos({
  initialSessions,
  initialTables,
  products,
  categories,
  currency,
  taxRate,
}: HospitalityPosProps) {
  const [view, setView] = useState<"DASHBOARD" |"SESSION">("DASHBOARD");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>(initialSessions);
  const [tables, setTables] = useState<TableInfo[]>(initialTables);
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [voidItem, setVoidItem] = useState<any | null>(null);
  const [returnItem, setReturnItem] = useState<any | null>(null);
  const [exchangeItem, setExchangeItem] = useState<any | null>(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [channelCapture, setChannelCapture] = useState<Exclude<ServiceChannel,"TABLE"> | null>(null);

  const mapSession = (s: any): SessionInfo => ({
            id: s.id,
            channel: s.channel,
            status: s.status,
            waiterId: s.waiterId,
            waiter: s.waiter,
            tableId: s.tableId,
            table: s.table,
            destinationLabel: s.destinationLabel,
            customerName: s.customerName,
            customerPhone: s.customerPhone ?? null,
            deliveryAddress: s.deliveryAddress ?? null,
            openedAt: s.openedAt,
            totalAmount: s.totalAmount || 0,
            roundCount: s.roundCount || 0,
            rounds: s.rounds,
  });

  const refreshDashboard = async () => {
    try {
        const [activeRes, settlingRes, tRes] = await Promise.all([
            fetch("/api/sessions?status=ACTIVE"),
            fetch("/api/sessions?status=SETTLING"),
            fetch("/api/tables")
        ]);
        if (!activeRes.ok || !settlingRes.ok || !tRes.ok) throw new Error("Dashboard refresh failed");
        const activeData = await activeRes.json();
        const settlingData = await settlingRes.json();
        const tData = await tRes.json();
        if (!Array.isArray(activeData) || !Array.isArray(settlingData) || !Array.isArray(tData)) throw new Error("Dashboard refresh failed");

        const mappedSessions = [...activeData, ...settlingData].map((s: any) => mapSession(s));

        setSessions(mappedSessions);
        setTables(tData);
    } catch (err) {
        console.error("Failed to refresh dashboard", err);
    }
  };

  const createSession = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/sessions", {
      method:"POST",
      headers: {"Content-Type":"application/json" },
      body: JSON.stringify(payload),
    });
    const newSession = await res.json();
    if (!res.ok) {
      throw new Error(newSession.error ||"Failed to start session");
    }
    if (newSession.id) {
      await handleOpenSession(newSession.id);
    }
  };

  const handleSelectChannel = async (channel: ServiceChannel) => {
    if (channel === ServiceChannel.TABLE) return;
    setChannelCapture(channel);
  };

  const handleChannelCapture = async (values: ChannelCaptureValues) => {
    if (!channelCapture) return;
    await createSession({ channel: channelCapture, ...values });
    setChannelCapture(null);
  };

  const handleOpenSession = async (sessionId: string) => {
    try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const session = await res.json();
        if (!res.ok) throw new Error(session.error ||"Failed to open session");
        setActiveSession(mapSession(session));
        setActiveSessionId(sessionId);
        setView("SESSION");
    } catch (err) {
        alert("Failed to open session");
    }
  };

  const handleSelectTable = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    if (table.status ==="OCCUPIED") {
        const session = sessions.find(s => s.tableId === tableId);
        if (session) {
            handleOpenSession(session.id);
        }
    } else if (table.status ==="AVAILABLE") {
        try {
            const res = await fetch("/api/sessions", {
                method:"POST",
                headers: {"Content-Type":"application/json" },
                body: JSON.stringify({
                    channel: ServiceChannel.TABLE,
                    tableId: table.id
                })
            });
            const newSession = await res.json();
            if (!res.ok) throw new Error(newSession.error ||"Failed to start table session");
            if (newSession.id) {
                handleOpenSession(newSession.id);
            }
        } catch (err) {
            alert(err instanceof Error ? err.message :"Failed to start table session");
        }
    }
  };

  const handlePostOrder = async (items: any[]) => {
    if (!activeSessionId) return;

    const res = await fetch("/api/sessions/post", {
        method:"POST",
        headers: {"Content-Type":"application/json" },
        body: JSON.stringify({
            sessionId: activeSessionId,
            items: items.map(i => ({
                productId: i.productId,
                variantId: i.variantId,
                quantity: i.quantity,
                unitPrice: i.unitPrice
            })),
            idempotencyKey: crypto.randomUUID()
        })
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ||"Failed to post order");
    }

    // Refresh active session data
    const updatedRes = await fetch(`/api/sessions/${activeSessionId}`);
    const updatedSession = await updatedRes.json();
    setActiveSession(mapSession(updatedSession));
  };

  const handleSettlement = () => {
      setSettlementOpen(true);
  };

  const handleSettlementComplete = async (payload: SettlementSubmit) => {
    if (!activeSessionId) return;

    const res = await fetch("/api/sessions/settle", {
        method:"POST",
        headers: {"Content-Type":"application/json" },
        body: JSON.stringify({
            sessionId: activeSessionId,
            ...payload,
        })
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ||"Failed to settle session");
    }
    return res.json();
  };

  const handleVoidConfirm = async (reason: string, approval: { managerUserId: string; managerPin: string }) => {
    const res = await fetch("/api/sessions/adjustments/void", {
        method:"POST",
        headers: {"Content-Type":"application/json" },
        body: JSON.stringify({ sessionItemId: voidItem.id, reason, ...approval })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ||"Void failed");
    }
    handleOpenSession(activeSessionId!);
  };

  const handleReturnConfirm = async (data: any) => {
    const res = await fetch("/api/sessions/adjustments/return", {
        method:"POST",
        headers: {"Content-Type":"application/json" },
        body: JSON.stringify({ sessionItemId: returnItem.id, ...data })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ||"Return failed");
    }
    handleOpenSession(activeSessionId!);
  };

  const handleExchangeConfirm = async (data: any) => {
    const res = await fetch("/api/sessions/adjustments/exchange", {
        method:"POST",
        headers: {"Content-Type":"application/json" },
        body: JSON.stringify({ originalItemId: exchangeItem.id, ...data })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ||"Exchange failed");
    }
    handleOpenSession(activeSessionId!);
  };

  const handleBack = () => {
    refreshDashboard();
    setView("DASHBOARD");
    setActiveSessionId(null);
    setActiveSession(null);
  };

  if (view ==="SESSION" && activeSession) {
    return (
      <>
        <SessionInterface
          session={activeSession}
          products={products}
          categories={categories}
          currency={currency}
          taxRate={taxRate}
          onPostOrder={handlePostOrder}
          onSettlement={handleSettlement}
          onHandover={() => setHandoverOpen(true)}
          onVoidItem={(id) => {
            const allItems = activeSession.rounds?.flatMap((r: any) => r.items) || [];
            setVoidItem(allItems.find((i: any) => i.id === id));
          }}
          onReturnItem={(id) => {
            const allItems = activeSession.rounds?.flatMap((r: any) => r.items) || [];
            setReturnItem(allItems.find((i: any) => i.id === id));
          }}
          onExchangeItem={(id) => {
            const allItems = activeSession.rounds?.flatMap((r: any) => r.items) || [];
            setExchangeItem(allItems.find((i: any) => i.id === id));
          }}
          onUpdateFulfillment={() => undefined}
          onBack={handleBack}
        />
        {settlementOpen && (
            <SettlementModal
                session={activeSession}
                currency={currency}
                onClose={() => setSettlementOpen(false)}
                onComplete={handleSettlementComplete}
            />
        )}
        {voidItem && (
            <VoidModal
                itemId={voidItem.id}
                onClose={() => setVoidItem(null)}
                onConfirm={handleVoidConfirm}
            />
        )}
        {returnItem && (
            <ReturnModal
                itemId={returnItem.id}
                onClose={() => setReturnItem(null)}
                onConfirm={handleReturnConfirm}
            />
        )}
        {exchangeItem && (
            <ExchangeModal
                originalItem={exchangeItem}
                products={products}
                onClose={() => setExchangeItem(null)}
                onConfirm={handleExchangeConfirm}
            />
        )}
        {handoverOpen && (
            <HandoverModal
                sessionId={activeSession.id}
                currentWaiterName={activeSession.waiter.name ||"Unknown"}
                onClose={() => setHandoverOpen(false)}
                onConfirm={async (data) => {
                    const res = await fetch("/api/sessions/handover", {
                        method:"POST",
                        headers: {"Content-Type":"application/json" },
                        body: JSON.stringify({ sessionId: activeSession.id, ...data })
                    });
                    if (!res.ok) throw new Error("Handover failed");
                    handleOpenSession(activeSessionId!);
                }}
            />
        )}
      </>
    );
  }

  return (
    <>
    <ServiceDashboard
      activeSessions={sessions}
      tables={tables}
      onSelectChannel={handleSelectChannel}
      onOpenSession={handleOpenSession}
      onSelectTable={handleSelectTable}
    />
    {channelCapture && (
      <ChannelCaptureModal
        channel={channelCapture}
        onCancel={() => setChannelCapture(null)}
        onConfirm={handleChannelCapture}
      />
    )}
    </>
  );
}
