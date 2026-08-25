import { StatCard, StatGrid } from "@/components/dashboard/ui";
import { formatMoney } from "@/lib/datetime";

export function StatCards({
  cards,
  currency,
}: {
  cards: Array<{ label: string; value: number | string; money?: boolean }>;
  currency: string;
}) {
  return (
    <StatGrid columns={cards.length >= 5 ? 5 : 4}>
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.money && typeof card.value === "number" ? formatMoney(card.value, currency) : String(card.value)}
        />
      ))}
    </StatGrid>
  );
}
