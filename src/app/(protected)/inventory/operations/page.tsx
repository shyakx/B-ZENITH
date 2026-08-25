import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authorization";
import { stockViewRoles } from "@/lib/roles";

export default async function InventoryOperationsPage() {
  await requireUser(stockViewRoles);
  redirect("/inventory");
}
