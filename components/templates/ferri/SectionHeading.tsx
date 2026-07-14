import { Reveal } from "./Reveal";

/*
 * SectionHeading — verbatim port of the source ferri SectionHeading: an
 * uppercase gold label, a serif (Cormorant) title, a short gold divider line,
 * and an optional description. Reused by most ferri sections for a consistent
 * header rhythm.
 */
export function SectionHeading({
  label,
  title,
  description,
  align = "center",
}: {
  label?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const alignClass = align === "center" ? "text-center" : "text-left";
  const lineMargin = align === "center" ? "mx-auto" : "";

  return (
    <Reveal className={`mb-12 sm:mb-16 ${alignClass}`}>
      {label && (
        <p className="mb-3 text-xs font-medium uppercase tracking-[3px] text-gold-500">
          {label}
        </p>
      )}
      <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-normal text-cream-100 sm:text-3xl md:text-4xl">
        {title}
      </h2>
      <div className={`mt-4 h-px w-12 bg-gold-500/40 ${lineMargin}`} />
      {description && (
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-txt-muted">
          {description}
        </p>
      )}
    </Reveal>
  );
}
