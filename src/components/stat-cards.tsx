import { formatMoney } from "@/lib/datetime";

export function StatCards({
  cards,
  currency,
}: {
  cards: Array<{ label: string; value: number | string; money?: boolean }>;
  currency: string;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-500">{card.label}</p>
          <p className="mt-2 text-2xl font-black">
            {card.money && typeof card.value === "number" ? formatMoney(card.value, currency) : card.value}
          </p>
        </article>
      ))}
    </section>
  );
}
