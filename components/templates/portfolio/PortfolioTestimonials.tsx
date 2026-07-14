import type { BlockProps } from "@/lib/blocks/schema";

// Inline quote mark (no lucide) — echoes the source's oversized Quote icon.
function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9.5 4C6 5.5 4 8.5 4 12.5c0 3 2 5.5 4.5 5.5 2 0 3.5-1.5 3.5-3.5 0-1.8-1.2-3.2-3-3.4.3-2 1.7-3.6 3.7-4.4L9.5 4Zm9 0C15 5.5 13 8.5 13 12.5c0 3 2 5.5 4.5 5.5 2 0 3.5-1.5 3.5-3.5 0-1.8-1.2-3.2-3-3.4.3-2 1.7-3.6 3.7-4.4L18.5 4Z" />
    </svg>
  );
}

/*
 * Testimonials — a static glass-card grid rather than the source's
 * single-card carousel: every quote gets its own card, so the section
 * scales to any item count without client-side state.
 */
export default function PortfolioTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="py-16 sm:py-24">
      <div className="container mx-auto px-6">
        {d.title && (
          <h2 className="font-serif mb-12 text-center text-3xl text-foreground sm:text-4xl">
            {d.title}
          </h2>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div key={i} className="glass animate-fade-in flex flex-col rounded-2xl p-6 sm:p-8">
              <QuoteIcon className="h-8 w-8 text-primary" />
              <blockquote className="text-foreground/90 mt-4 flex-1 leading-relaxed">
                &ldquo;{item.quote}&rdquo;
              </blockquote>
              <div className="border-border mt-6 border-t pt-4">
                <p className="font-semibold text-foreground">{item.author}</p>
                {item.role && <p className="text-sm text-primary">{item.role}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
