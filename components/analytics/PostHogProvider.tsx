"use client";

import { useEffect, type ReactNode } from "react";
import type { PostHog } from "posthog-js";

/**
 * PostHog for the PLATFORM only — marketing root, the legal pages and the whole
 * /app dashboard namespace. It is deliberately NOT in the shared root layout and
 * NOT an `instrumentation-client.ts` (PostHog's stock Next.js recipe): both are
 * app-global, and this one app also renders every tenant site under app/s/**.
 * Customer sites carry no analytics of ours (spec 2026-08-05 §5), so the mount
 * has to be per-surface. Mount it once per platform surface; it is a passthrough
 * wrapper and also works self-closing next to <MetaPixel />.
 *
 * Without NEXT_PUBLIC_POSTHOG_KEY nothing happens: children render untouched and
 * posthog-js is never fetched, since the import is dynamic.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// EU residency by default — the owners and their leads are all in Ukraine.
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

let client: PostHog | null = null;
let loading = false;

/** Calls made before the lazy chunk lands — replayed on init instead of lost. */
const pending: Array<(ph: PostHog) => void> = [];
const PENDING_MAX = 50;

function withPostHog(fn: (ph: PostHog) => void) {
  if (!KEY || typeof window === "undefined") return;
  if (client) {
    fn(client);
    return;
  }
  if (pending.length < PENDING_MAX) pending.push(fn);
}

/**
 * The one client-side capture entry point. Safe everywhere: no-ops when PostHog
 * is off, queues while it is still loading.
 */
export function phCapture(event: string, props?: Record<string, unknown>) {
  withPostHog((ph) => ph.capture(event, props));
}

/** Tie the session to a signed-in owner. Same safety as phCapture. */
export function phIdentify(userId: string, email?: string) {
  withPostHog((ph) => ph.identify(userId, email ? { email } : undefined));
}

export function PostHogProvider({ children }: { children?: ReactNode }) {
  useEffect(() => {
    if (!KEY || loading) return;
    loading = true;
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        // Pins the 2026-05-30 default set, whose capture_pageview is
        // 'history_change' — App Router navigations are captured for us, so no
        // manual $pageview on usePathname.
        defaults: "2026-05-30",
      });
      client = posthog;
      for (const fn of pending.splice(0)) fn(posthog);
    });
  }, []);

  return <>{children}</>;
}
