import { redirect } from "next/navigation";

export default function AdjustRedirectPage() {
  redirect("/manager/inventory?kind=adjust");
}
