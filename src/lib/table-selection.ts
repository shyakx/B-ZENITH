export const TABLE_CHANNEL_ACTION = "OPEN_TABLE_SELECTION" as const;

export const TABLE_UX = {
  channelHint: "Choose a table",
  title: "Table Service",
  subtitle: "Choose a table to start or continue service",
  otherWaiter: "Currently being served by another staff member.",
  unavailable: "Table unavailable",
  occupiedMissing: "This table is occupied, but the session could not be loaded.",
  unknown: "This table cannot currently be selected.",
  emptyConfigured: "No tables configured.",
} as const;

export type TableSelectionTable = {
  id: string;
  name?: string;
  status: string;
  sortOrder?: number;
  active?: boolean;
};

export type TableSelectionSession = {
  id: string;
  waiterId: string;
  tableId: string | null;
};

export type TableSelection =
  | { action: "start" }
  | { action: "open"; sessionId: string }
  | { action: "block"; message: string };

export type TableFloorGroup = "available" | "in-service" | "unavailable";

export type TableFloorCard = {
  id: string;
  name: string;
  group: TableFloorGroup;
  statusLabel: string;
  actionLabel: string;
  selectable: boolean;
  blockMessage?: string;
  selection: TableSelection;
};

export function tableChannelAction() {
  return TABLE_CHANNEL_ACTION;
}

export function sessionListedForOperator(
  session: { waiterId: string },
  operator: { id: string; role: string },
) {
  return operator.role !== "WAITER" || session.waiterId === operator.id;
}

export function resolveTableSelection(input: {
  table: TableSelectionTable | undefined;
  session: TableSelectionSession | undefined;
  operatorRole: string;
  operatorId: string;
}): TableSelection {
  if (!input.table) {
    return { action: "block", message: TABLE_UX.unknown };
  }

  if (input.table.active === false || input.table.status === "OUT_OF_SERVICE") {
    return { action: "block", message: TABLE_UX.unavailable };
  }

  if (input.table.status === "AVAILABLE") {
    return { action: "start" };
  }

  if (input.table.status === "OCCUPIED") {
    if (!input.session) {
      if (input.operatorRole === "WAITER") {
        return { action: "block", message: TABLE_UX.otherWaiter };
      }
      return { action: "block", message: TABLE_UX.occupiedMissing };
    }

    if (input.operatorRole === "WAITER" && input.session.waiterId !== input.operatorId) {
      return { action: "block", message: TABLE_UX.otherWaiter };
    }

    return { action: "open", sessionId: input.session.id };
  }

  return { action: "block", message: TABLE_UX.unknown };
}

export function presentTableFloor(input: {
  tables: TableSelectionTable[];
  sessions: TableSelectionSession[];
  operatorRole: string;
  operatorId: string;
}): TableFloorCard[] {
  const ordered = [...input.tables].sort((a, b) => {
    const sort = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (sort !== 0) return sort;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return ordered.map((table) => {
    const session = input.sessions.find((row) => row.tableId === table.id);
    const selection = resolveTableSelection({
      table,
      session,
      operatorRole: input.operatorRole,
      operatorId: input.operatorId,
    });
    return decorateTableCard(table, session, selection, input.operatorId);
  });
}

export function groupTableFloor(cards: TableFloorCard[]) {
  return {
    available: cards.filter((card) => card.group === "available"),
    inService: cards.filter((card) => card.group === "in-service"),
    unavailable: cards.filter((card) => card.group === "unavailable"),
  };
}

function decorateTableCard(
  table: TableSelectionTable,
  session: TableSelectionSession | undefined,
  selection: TableSelection,
  operatorId: string,
): TableFloorCard {
  const name = table.name?.trim() || "Table";
  const own = Boolean(session && session.waiterId === operatorId);

  if (table.active === false || table.status === "OUT_OF_SERVICE") {
    return {
      id: table.id,
      name,
      group: "unavailable",
      statusLabel: "Unavailable",
      actionLabel: "Out of service",
      selectable: false,
      blockMessage: TABLE_UX.unavailable,
      selection,
    };
  }

  if (table.status === "AVAILABLE") {
    return {
      id: table.id,
      name,
      group: "available",
      statusLabel: "Available",
      actionLabel: "Start service",
      selectable: selection.action === "start",
      selection,
    };
  }

  if (table.status === "OCCUPIED") {
    if (selection.action === "open") {
      return {
        id: table.id,
        name,
        group: "in-service",
        statusLabel: own ? "Your service" : "Occupied",
        actionLabel: "Continue service",
        selectable: true,
        selection,
      };
    }
    return {
      id: table.id,
      name,
      group: "in-service",
      statusLabel: "Occupied",
      actionLabel: "Currently being served",
      selectable: false,
      blockMessage: selection.action === "block" ? selection.message : TABLE_UX.otherWaiter,
      selection,
    };
  }

  return {
    id: table.id,
    name,
    group: "unavailable",
    statusLabel: "Unavailable",
    actionLabel: "Cannot select",
    selectable: false,
    blockMessage: selection.action === "block" ? selection.message : TABLE_UX.unknown,
    selection,
  };
}

export function tableOpenFailureMessage(status: number, serverError?: string) {
  if (status === 403) return TABLE_UX.otherWaiter;
  if (status === 409) return serverError?.trim() || TABLE_UX.unavailable;
  return serverError?.trim() || "Unable to open this table.";
}
