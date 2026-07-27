/**
 * Landing wordmark — the marketing variant of components/ui `Wordmark`: an ink
 * badge with a honey dot plus the «3minsite» lockup. Server component; the
 * marketing pages sit on the platform host, so «на головну» is a plain <a>.
 */
export function Logo({ className = "", href }: { className?: string; href?: string }) {
  const content = (
    <span className={`inline-flex items-center gap-2 font-brand font-semibold ${className}`}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-[10px] bg-brand text-white">
        <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-honey" />
        <span className="text-[13px] leading-none">3</span>
      </span>
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
