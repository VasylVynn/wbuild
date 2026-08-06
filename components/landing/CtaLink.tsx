"use client";

import type { ReactNode } from "react";
import { phCapture } from "@/components/analytics/PostHogProvider";

/**
 * The landing's «Створити сайт» link, wherever it appears. It exists as its own
 * component because the sections that hold it (Hero, and the CTAs beside it) are
 * server components: this keeps the client boundary around the one anchor that
 * needs a click handler instead of converting a whole section to render on the
 * client for the sake of analytics.
 *
 * The click leaves for the dashboard host immediately, so the capture is a
 * best-effort snapshot — it must never delay or gate the navigation, which is
 * why nothing here is awaited and the href stays a plain anchor. `placement`
 * says which CTA was tapped; the landing mounts PostHogProvider itself.
 */
export function CtaLink({
  href,
  placement,
  className,
  children,
}: {
  href: string;
  placement: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => phCapture("ui_landing_cta_click", { placement })}
    >
      {children}
    </a>
  );
}
