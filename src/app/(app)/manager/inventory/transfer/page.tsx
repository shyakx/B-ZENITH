import { redirect } from "next/navigation";

export default function TransferRedirectPage() {
  redirect("/manager/inventory?kind=transfer");
}
