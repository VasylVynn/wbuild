import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Publications — case studies, articles, press mentions and awards, rendered in
 * the aisaas soft-pastel language. No images (the `publications` block carries
 * none), so it leans on colour + type: a pastel year chip, ink title, italic
 * subtitle and a muted source. Only real, grounded entries render — every field
 * but the title is optional and guarded. Plain server component.
 *
 * Default: responsive grid of soft lavender cards.
 * `list` variant: an editorial hairline-divided credits list.
 */
function PublicationsHeader({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <span className="mb-3 inline-block text-sm font-semibold text-[#E07A5F]">Публікації</span>
      <h2 className="text-3xl font-bold text-[#2F4550] md:text-4xl">{title}</h2>
    </div>
  );
}

export default function AiSaasPublications({ data }: { data: unknown }) {
  const d = data as BlockProps["publications"];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <PublicationsHeader title={d.title} />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="flex h-full flex-col rounded-3xl bg-[#F1F0FB] p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              {item.year && (
                <span className="mb-4 inline-flex w-fit rounded-full bg-[#D3E4FD] px-3 py-1 text-xs font-semibold text-[#3D8690]">
                  {item.year}
                </span>
              )}
              <h3 className="text-lg font-bold text-[#2F4550]">{item.title}</h3>
              {item.subtitle && <p className="mt-2 text-sm italic text-[#2F4550]/70">{item.subtitle}</p>}
              {item.source && <p className="mt-3 text-sm text-[#2F4550]/60">{item.source}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AiSaasPublicationsList({ data }: { data: unknown }) {
  const d = data as BlockProps["publications"];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <PublicationsHeader title={d.title} />

        <div className="mx-auto max-w-4xl divide-y divide-[#2F4550]/10 border-y border-[#2F4550]/10">
          {d.items.map((item, i) => (
            <div key={i} className="flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:gap-8">
              {item.year && (
                <span className="text-3xl font-bold text-[#E07A5F]/50">{item.year}</span>
              )}
              <div>
                <h3 className="text-xl font-bold text-[#2F4550]">{item.title}</h3>
                {item.subtitle && <p className="mt-1 italic text-[#2F4550]/70">{item.subtitle}</p>}
                {item.source && <p className="mt-2 text-sm text-[#2F4550]/60">{item.source}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
