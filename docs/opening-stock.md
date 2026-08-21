# Opening stock (tracked drinks)

Do not invent quantities. Count what is on the shelf.

Production currently tracks bottled/canned **Drinks**. Food, shots, and glasses do not decrement stock. Only enter counts for products that show as tracked in Inventory.

## Tomorrow morning

1. Print or open **Inventory**.
2. For every tracked product, count bottles/cans on the shelf.
3. In **Physical stock take**:
   - Select the product.
   - Enter the **actual counted quantity**.
   - Reason example: `Opening stock 22 Aug 2026`.
   - If the count is below the current system quantity, confirm the negative adjustment.
   - Review current / counted / adjustment.
   - Confirm stock take.
4. Confirm a new row appears in **Stock-take history** and **Inventory history** (type `ADJUSTMENT`, note starts with `Stock take:`).
5. Repeat until every tracked drink has a real count.

Do **not** type stock on the Menu edit screen. That field is read-only and does not write stock.

## After opening stock

A controlled test sale of a tracked **bottle or can** should decrement stock by the sold quantity and write an `InventoryMovement` of type `SALE`.

Do not run that test against production automatically. If you need a production confidence check, sell one real opening item to a staff account, print the receipt, then confirm:

- Sales history shows one new receipt
- Inventory quantity dropped by 1
- Inventory history shows the sale movement

If the item is then not needed, process a return (OWNER/ADMIN) so stock is restored.
