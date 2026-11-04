"use client";

import { usePathname } from "next/navigation";

const GUIDES: Array<{ match: string; title: string; text: string }> = [
  { match: "/admin/users/", title: "Staff account", text: "Review this person’s role and account status. Sensitive actions such as PIN changes and deactivation are recorded in the audit log." },
  { match: "/admin/users", title: "Staff and access", text: "Create staff accounts, assign the right role, and manage active access. Roles determine which operational areas each person can use." },
  { match: "/admin/access", title: "Role permissions", text: "Use this reference to understand what each role can do. Current assignments show who is responsible for each area." },
  { match: "/admin/settings", title: "Business settings", text: "Update the business details and receipt options shown on printed factures. Changes apply to future printouts." },
  { match: "/admin/data", title: "Data control", text: "Use this area only for removing test or obsolete operational records. Deletions are permanent and require typing DELETE." },
  { match: "/admin/audit", title: "Activity history", text: "Trace important business and administration changes by date, staff member, action, or record type." },
  { match: "/admin", title: "Administration control center", text: "Manage staff access, business configuration, audit history, and safe data maintenance from one place." },
  { match: "/manager/inventory/packaging", title: "Packaging", text: "Define how purchase packages convert into stock units. This keeps receiving and transfers consistent." },
  { match: "/manager/inventory/movements", title: "Stock history", text: "Review every receipt, sale, transfer, count, waste, and adjustment that changed stock." },
  { match: "/manager/inventory", title: "Stock", text: "Receive deliveries, move stock between locations, and review current levels. Counts and adjustments should reflect the physical stock on hand." },
  { match: "/manager/products", title: "Products and categories", text: "Maintain the sales menu and stock catalogue. A product can be visible for ordering, tracked in stock, or both." },
  { match: "/manager/purchases", title: "Purchases", text: "Review purchase records and the cost information captured when stock is received." },
  { match: "/manager/reports", title: "Reports and history", text: "Use the filters to investigate sales, payments, products, staff activity, and outstanding balances for a date range." },
  { match: "/manager/maison", title: "Maison de Passage", text: "Record guest stays separately from restaurant POS sales. Maison balances are tracked on this page." },
  { match: "/manager/orders", title: "Orders", text: "Review table orders across the business. Open orders can still change; completed and cancelled orders are historical records." },
  { match: "/manager/tables", title: "Tables", text: "Maintain the active table list used when waiters create orders and cashiers settle bills." },
  { match: "/manager", title: "Manager workspace", text: "Monitor today’s sales and move quickly to orders, reports, products, or stock operations." },
  { match: "/cashier/outstanding", title: "Customer credit", text: "Find unpaid pay-later balances, review the customer and order details, then record settlement when money is received." },
  { match: "/cashier/payments", title: "Payments", text: "Review recorded payments by date, method, staff member, waiter, or table. Printed factures remain available from each payment." },
  { match: "/cashier/factures", title: "Factures", text: "Find an order and print its customer bill. A facture shows the order total, payments, and remaining balance." },
  { match: "/cashier/bills/", title: "Table bill", text: "Settle one order or the remaining balance for the table. Payment actions update the bill and stock records together." },
  { match: "/cashier/bills", title: "Orders and bills", text: "Find open table bills and begin payment. Filters help you locate a bill by table, order, waiter, or date." },
  { match: "/cashier", title: "Cashier workspace", text: "Manage open bills, record payments, settle customer credit, and review today’s cash activity." },
  { match: "/waiter/orders/new", title: "New order", text: "Choose a table, add menu items, review the order, and submit it. Submitted orders are immediately available to the kitchen and cashier." },
  { match: "/waiter/orders", title: "My orders", text: "Review the orders you opened, print a commande slip, order again, or void an eligible unpaid order." },
  { match: "/waiter", title: "Waiter workspace", text: "Start a new table order and monitor the orders you opened today." },
  { match: "/owner", title: "Business overview", text: "Review the whole business at a glance, including today’s sales, balances, and staff coverage." },
];

export function PageGuide() {
  const pathname = usePathname() ?? "/";
  const guide = GUIDES.find((entry) => pathname === entry.match || pathname.startsWith(entry.match));
  if (!guide) return null;

  return (
    <aside className="mb-5 border-l-2 border-zenith-gold pl-3" aria-label={`${guide.title} guidance`}>
      <p className="text-sm font-semibold text-zenith-ink">{guide.title}</p>
      <p className="mt-0.5 max-w-3xl text-sm leading-6 text-zenith-muted">{guide.text}</p>
    </aside>
  );
}
