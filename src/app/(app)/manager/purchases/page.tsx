import { redirect } from "next/navigation";

export default function PurchasesRedirectPage() {
  redirect("/manager/inventory?kind=receive");
}
