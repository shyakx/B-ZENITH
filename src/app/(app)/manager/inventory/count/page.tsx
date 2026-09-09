import { redirect } from "next/navigation";

export default function CountRedirectPage() {
  redirect("/manager/inventory?kind=count");
}
