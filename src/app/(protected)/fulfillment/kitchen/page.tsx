import { FulfillmentQueue } from "@/components/hospitality/FulfillmentQueue";
import { requireUser } from "@/lib/authorization";
import { tillRoles } from "@/lib/roles";

export default async function KitchenFulfillmentPage() {
  await requireUser(tillRoles);
  return <FulfillmentQueue locationCode="KITCHEN" />;
}
