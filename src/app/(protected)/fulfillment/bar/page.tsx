import { FulfillmentQueue } from "@/components/hospitality/FulfillmentQueue";
import { requireUser } from "@/lib/authorization";
import { tillRoles } from "@/lib/roles";

export default async function BarFulfillmentPage() {
  await requireUser(tillRoles);
  return <FulfillmentQueue locationCode="BAR" />;
}
