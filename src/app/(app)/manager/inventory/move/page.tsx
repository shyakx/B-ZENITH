import { redirect } from "next/navigation";

export default async function StockMovePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; productId?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.kind) query.set("kind", params.kind);
  if (params.productId) query.set("productId", params.productId);
  const suffix = query.toString();
  redirect(suffix ? `/manager/inventory?${suffix}` : "/manager/inventory?kind=receive");
}
