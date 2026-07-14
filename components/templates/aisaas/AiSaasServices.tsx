import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Services — port of the source features/services grid: a centred header
 * (coral eyebrow + bold heading) above a responsive grid of soft rounded
 * cards, replacing the source's bordered/square treatment with the aisaas
 * pastel-chip + rounded-3xl card language.
 *
 * Parameterised: fed by our `services` block. Each item → one card (icon via
 * ServiceIcon(item.icon) in an alternating pastel chip, name → heading,
 * description → body, price → coral line, badge → small pill). Plain server
 * component — no client-only interaction in this section.
 */
export default function AiSaasServices({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="mb-3 inline-block text-sm font-semibold text-[#E07A5F]">
              Наші послуги
            </span>
            <h2 className="text-3xl font-bold text-[#2F4550] md:text-4xl">{d.title}</h2>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="group relative rounded-3xl bg-[#F1F0FB] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-8"
            >
              {item.badge && (
                <span className="absolute top-5 right-5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#E07A5F]">
                  {item.badge}
                </span>
              )}

              {item.icon && (
                <div
                  className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${
                    i % 2 === 0 ? "bg-[#D3E4FD] text-[#3D8690]" : "bg-[#FDE1D3] text-[#E07A5F]"
                  }`}
                >
                  <ServiceIcon name={item.icon} className="h-6 w-6" />
                </div>
              )}

              <h3 className="text-lg font-bold text-[#2F4550]">{item.name}</h3>
              {item.description && (
                <p className="mt-2 text-sm leading-relaxed text-[#2F4550]/80">
                  {item.description}
                </p>
              )}
              {item.price && (
                <p className="mt-4 text-sm font-semibold text-[#E07A5F]">{item.price}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
