import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";

export default async function SalesPage() {
  await requireRole("MANAGER");
  redirect("/manager/reports");
}
