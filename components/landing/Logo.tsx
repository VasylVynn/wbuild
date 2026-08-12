/**
 * Landing wordmark — the marketing variant of components/ui `Wordmark`: the
 * brand mark (section-stack «3», /brand/mark.svg) plus the «3minsite» lockup.
 * Server component; the marketing pages sit on the platform host, so
 * «на головну» is a plain <a>.
 */
export function Logo({ className = "", href }: { className?: string; href?: string }) {
  const content = (
    <span className={`inline-flex items-center gap-2 font-brand font-semibold ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.svg" alt="" aria-hidden className="h-7 w-7" />
      <span className="text-[18px] tracking-tight text-ink">
        3min<span className="text-ink-muted">site</span>
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <a href={href} aria-label="3minsite — на головну">
      {content}
    </a>
  );
}
