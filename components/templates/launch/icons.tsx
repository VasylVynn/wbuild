import type { ReactNode } from "react";

/*
 * Service icons — inline stroke SVGs (lucide-style, stroke-1) for the schema's
 * SERVICE_ICONS enum, so the Launch feature grid can render an icon per item
 * without pulling a dependency. Unknown/absent → the "sparkles" default.
 */
const PATHS: Record<string, ReactNode> = {
  star: <path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3 1.2-6.5L2.5 9.9 9.1 9z" />,
  heart: <path d="M12 20s-7-4.35-9.5-8.5A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5.5C19 15.65 12 20 12 20z" />,
  shield: <path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </>
  ),
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5l-6 6 2.4 2.4 6-6a4 4 0 0 0 5-5.4l-2.5 2.5-2-2z" />,
  leaf: <path d="M4 20c8 2 16-4 16-16-8 0-14 3-15 9a4 4 0 0 0 4 4l3-6" />,
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14l-2 7 5-3 5 3-2-7" />
    </>
  ),
  phone: <path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2C9.8 19 5 14.2 5 6a2 2 0 0 1 0-3z" />,
  check: <path d="M20 6L9 17l-5-5" />,
  sparkles: <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.8M21 20c0-2.6-1.6-4.8-4-5.6" />
    </>
  ),
};

export function ServiceIcon({ name, className = "h-5 w-5" }: { name?: string; className?: string }) {
  const path = (name && PATHS[name]) || PATHS.sparkles;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}
