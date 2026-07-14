import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Stats — number band, standing in for the source's inline hero stats row
 * (no dedicated stats section there). Big glow-text teal values over
 * uppercase muted labels, held inside a glass rounded-2xl band so it reads
 * as its own section wherever it's placed.
 */
export default function PortfolioStats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="py-16 sm:py-24">
      <div className="container mx-auto px-6">
        {d.title && (
          <h2 className="font-serif mb-10 text-center text-3xl text-foreground sm:text-4xl">
            {d.title}
          </h2>
        )}

        <div className="glass animate-fade-in rounded-2xl p-8 sm:p-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {d.items.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="glow-text text-4xl font-bold text-primary sm:text-5xl">
                  {stat.value}
                </p>
                <p className="text-muted-foreground mt-2 text-xs tracking-wider uppercase sm:text-sm">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
