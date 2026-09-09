/**
 * Pure helpers for current-day operational order lists.
 * Uses the same Kigali day window as startOfDay/endOfDay — callers pass that range.
 */
export function selectCurrentDayOrders<T extends { createdAt: Date }>(
  orders: T[],
  dayFrom: Date,
  dayTo: Date,
): T[] {
  const fromMs = dayFrom.getTime();
  const toMs = dayTo.getTime();
  return orders
    .filter((order) => {
      const at = order.createdAt.getTime();
      return at >= fromMs && at <= toMs;
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}
