import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  groupTableFloor,
  presentTableFloor,
  resolveTableSelection,
  tableChannelAction,
  tableOpenFailureMessage,
  TABLE_CHANNEL_ACTION,
  TABLE_UX,
} from "./table-selection";

const waiter = { operatorRole: "WAITER", operatorId: "waiter-1" };
const manager = { operatorRole: "MANAGER", operatorId: "manager-1" };

function tables(count: number, extra: Array<{ id: string; status: string; active?: boolean }> = []) {
  const base = Array.from({ length: count }, (_, index) => ({
    id: `t${index + 1}`,
    name: `T${index + 1}`,
    status: "AVAILABLE",
    sortOrder: index + 1,
    active: true,
  }));
  return base.map((row) => extra.find((item) => item.id === row.id) ? { ...row, ...extra.find((item) => item.id === row.id) } : row);
}

describe("table channel", () => {
  it("opens the table-selection interface instead of scrolling the floor map", () => {
    assert.equal(tableChannelAction(), TABLE_CHANNEL_ACTION);
    assert.notEqual(tableChannelAction(), "SCROLL_TO_TABLE_MAP");
  });
});

describe("presentTableFloor", () => {
  it("Case A: 5 tables and 0 sessions still shows every table as available", () => {
    const cards = presentTableFloor({ tables: tables(5), sessions: [], ...waiter });
    const grouped = groupTableFloor(cards);
    assert.equal(cards.length, 5);
    assert.equal(grouped.available.length, 5);
    assert.equal(grouped.inService.length, 0);
    assert.ok(cards.every((card) => card.statusLabel === "Available" && card.actionLabel === "Start service"));
  });

  it("Case B: 5 tables and 1 active session shows 4 available and 1 occupied", () => {
    const cards = presentTableFloor({
      tables: tables(5, [{ id: "t2", status: "OCCUPIED" }]),
      sessions: [{ id: "s1", waiterId: "waiter-1", tableId: "t2" }],
      ...waiter,
    });
    const grouped = groupTableFloor(cards);
    assert.equal(cards.length, 5);
    assert.equal(grouped.available.length, 4);
    assert.equal(grouped.inService.length, 1);
    assert.equal(grouped.inService[0].id, "t2");
  });

  it("Case C: current operator may continue their occupied table", () => {
    const cards = presentTableFloor({
      tables: tables(2, [{ id: "t2", status: "OCCUPIED" }]),
      sessions: [{ id: "s-own", waiterId: "waiter-1", tableId: "t2" }],
      ...waiter,
    });
    const own = cards.find((card) => card.id === "t2")!;
    assert.equal(own.selectable, true);
    assert.equal(own.actionLabel, "Continue service");
    assert.equal(own.statusLabel, "Your service");
    assert.deepEqual(own.selection, { action: "open", sessionId: "s-own" });
  });

  it("Case D: another operator's occupied table is visible but cannot be opened", () => {
    const cards = presentTableFloor({
      tables: tables(2, [{ id: "t2", status: "OCCUPIED" }]),
      sessions: [{ id: "s-other", waiterId: "waiter-2", tableId: "t2" }],
      ...waiter,
    });
    const other = cards.find((card) => card.id === "t2")!;
    assert.equal(other.selectable, false);
    assert.equal(other.group, "in-service");
    assert.equal(other.blockMessage, TABLE_UX.otherWaiter);
    assert.equal(other.selection.action, "block");
  });

  it("still shows an occupied table when the waiter has no matching session record", () => {
    const cards = presentTableFloor({
      tables: tables(3, [{ id: "t3", status: "OCCUPIED" }]),
      sessions: [],
      ...waiter,
    });
    assert.equal(cards.length, 3);
    const occupied = cards.find((card) => card.id === "t3")!;
    assert.equal(occupied.group, "in-service");
    assert.equal(occupied.selectable, false);
  });

  it("Case E: out-of-service tables stay visible and cannot be selected", () => {
    const cards = presentTableFloor({
      tables: tables(2, [{ id: "t2", status: "OUT_OF_SERVICE" }]),
      sessions: [],
      ...waiter,
    });
    const closed = cards.find((card) => card.id === "t2")!;
    assert.equal(closed.group, "unavailable");
    assert.equal(closed.selectable, false);
    assert.equal(closed.actionLabel, "Out of service");
  });

  it("Case F: unknown status explains rather than disappearing", () => {
    const cards = presentTableFloor({
      tables: [{ id: "t9", name: "T9", status: "RESERVED", sortOrder: 1, active: true }],
      sessions: [],
      ...waiter,
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0].selectable, false);
    assert.equal(cards[0].blockMessage, TABLE_UX.unknown);
  });
});

describe("resolveTableSelection", () => {
  it("starts a session on an available table", () => {
    assert.deepEqual(
      resolveTableSelection({
        table: { id: "t1", status: "AVAILABLE", active: true },
        session: undefined,
        ...waiter,
      }),
      { action: "start" },
    );
  });

  it("lets a manager open another waiter's occupied table when the session is present", () => {
    assert.deepEqual(
      resolveTableSelection({
        table: { id: "t2", status: "OCCUPIED", active: true },
        session: { id: "s-other", waiterId: "waiter-2", tableId: "t2" },
        ...manager,
      }),
      { action: "open", sessionId: "s-other" },
    );
  });
});

describe("tableOpenFailureMessage", () => {
  it("maps 403 to the other-staff message", () => {
    assert.equal(
      tableOpenFailureMessage(403, "You can only work on your assigned sessions."),
      TABLE_UX.otherWaiter,
    );
  });
});
