-- READ-ONLY production inspection for Phase 4A (C-01 / PAY_LATER cancel).
-- Do NOT run this in the implementation phase unless separately authorized.
-- Do NOT use these results to auto-repair rows.
--
-- 1. Cancelled orders that already show money on the order row
SELECT
  id,
  "orderNumber",
  status,
  "paymentStatus",
  total,
  "paidAmount",
  "createdAt"
FROM "Order"
WHERE status = 'CANCELLED'
  AND "paidAmount" > 0
ORDER BY "createdAt";

-- 2. Cancelled orders that still have Payment rows
SELECT
  o.id,
  o."orderNumber",
  o.status,
  o."paidAmount",
  COUNT(p.id) AS payment_count,
  COALESCE(SUM(p.amount), 0) AS payment_sum
FROM "Order" o
JOIN "Payment" p ON p."orderId" = o.id
WHERE o.status = 'CANCELLED'
GROUP BY o.id
ORDER BY o."createdAt";

-- 3. Orders with more than one VOID_RESTORE movement
SELECT
  "orderId",
  COUNT(*) AS void_restore_count,
  SUM(quantity) AS void_restore_qty
FROM "InventoryMovement"
WHERE type = 'VOID_RESTORE'
  AND "orderId" IS NOT NULL
GROUP BY "orderId"
HAVING COUNT(*) > 1
ORDER BY void_restore_count DESC;

-- 4. VOID_RESTORE quantity that does not net to zero against SALE for the same order
SELECT
  o.id,
  o."orderNumber",
  o.status,
  COALESCE(SUM(CASE WHEN m.type = 'SALE' THEN m.quantity ELSE 0 END), 0) AS sale_qty,
  COALESCE(SUM(CASE WHEN m.type = 'VOID_RESTORE' THEN m.quantity ELSE 0 END), 0) AS void_qty
FROM "Order" o
JOIN "InventoryMovement" m ON m."orderId" = o.id
WHERE m.type IN ('SALE', 'VOID_RESTORE')
GROUP BY o.id
HAVING
  COALESCE(SUM(CASE WHEN m.type = 'SALE' THEN m.quantity ELSE 0 END), 0)
  + COALESCE(SUM(CASE WHEN m.type = 'VOID_RESTORE' THEN m.quantity ELSE 0 END), 0) <> 0
ORDER BY o."orderNumber";

-- 5. Active (unsettled) customer credit still attached to a cancelled order
SELECT
  c.id AS credit_id,
  c."orderId",
  o."orderNumber",
  o.status,
  o."paymentStatus",
  c."customerName",
  c."amountOwed",
  c.settled
FROM "CreditRecord" c
JOIN "Order" o ON o.id = c."orderId"
WHERE o.status = 'CANCELLED'
  AND c.settled = FALSE
ORDER BY c."createdAt";
