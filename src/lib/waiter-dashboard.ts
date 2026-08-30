export type WaiterDashboardOrder = {
  tableId: string;
  table: { name: string };
  items: { quantity: number }[];
};

export function itemQuantity(order: { items: { quantity: number }[] }): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function waiterTodayStats(orders: WaiterDashboardOrder[]) {
  const tables = new Map<string, string>();
  let items = 0;
  for (const order of orders) {
    tables.set(order.tableId, order.table.name);
    items += itemQuantity(order);
  }
  return {
    orderCount: orders.length,
    tableCount: tables.size,
    tableNames: [...tables.values()],
    itemCount: items,
  };
}
