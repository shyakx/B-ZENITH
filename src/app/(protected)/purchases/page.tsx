import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authorization";
import { catalogRoles } from "@/lib/roles";

export default async function PurchasesPage() {
  await requireUser(catalogRoles);
  redirect("/inventory/operations?tab=receive");
}
