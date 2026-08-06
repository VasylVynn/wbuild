import "server-only";
import { PostHog } from "posthog-node";
import { createLogger } from "@/lib/log";

/**
 * Server-side mirror of the browser analytics in components/analytics
 * (PostHogProvider). Same PostHog project, so this deliberately reads the SAME
 * NEXT_PUBLIC_POSTHOG_KEY the client uses: a PostHog project API key is
 * write-only and designed to be public, so there is no separate server key to
 * configure. One key, one project — a browser event and a server event for the
 * same distinctId land on the same person.
 *
 * SERVERLESS CONTRACT (Vercel lambdas) — why every export uses
 * `captureImmediate` and we never call `shutdown()`:
 *  - `capture()` only QUEUES; delivery depends on a later flush (batch size or
 *    timer). Vercel freezes the instance the moment the response is sent, so
 *    that timer may never fire and the event is silently lost. The classic
 *    `flushAt:1 + flushInterval:0 + await shutdown()` recipe fixes this for a
 *    process that exits — but a Next.js route handler does not exit, it freezes.
 *  - `captureImmediate()` issues the HTTP request inline and resolves when it
 *    is sent, so awaiting it is the delivery guarantee. No queue, no timer.
 *  - `shutdown()` would be actively wrong here: the client is a singleton
 *    shared by every request a warm instance serves: shutting it down after one
 *    request breaks the next one.
 * flushAt/flushInterval are still pinned to the serverless values as a
 * belt-and-braces default for anything the SDK enqueues internally.
 * Docs: https://posthog.com/docs/libraries/node
 *
 * Nothing here ever throws or rejects. Analytics is not allowed to affect a
 * funnel step, let alone the money path.
 */

const log = createLogger("posthog");

/**
 * Hard ceiling on how long a caller may wait for a capture. These captures are
 * awaited inside user-facing server actions (trackFunnel) and the payment
 * webhook — a slow PostHog ingest must degrade to a lost analytics event
 * (logged), never to a stalled funnel step. The request itself is NOT
 * aborted at the deadline: on a warm instance it usually still completes in
 * the background; on a freeze it may be lost — acceptable for analytics.
 */
const CAPTURE_TIMEOUT_MS = 1500;

let client: PostHog | null = null;

/** Lazy singleton. No key (local dev, preview) → null → every export no-ops. */
function getClient(): PostHog | null {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) return null;
  client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    // SDK-level cap on a single ingest request — the outer race below is the
    // caller-facing guarantee; this keeps the background attempt bounded too.
    requestTimeout: 3000,
  });
  return client;
}

/** Resolve when `work` settles OR the deadline passes — whichever comes first. */
async function withDeadline(work: Promise<unknown>, label: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), CAPTURE_TIMEOUT_MS);
  });
  const outcome = await Promise.race([work.then(() => "done" as const), deadline]);
  if (timer) clearTimeout(timer);
  if (outcome === "timeout") {
    log.warn("capture exceeded deadline — continuing without it", { label });
    // Keep the straggler from surfacing an unhandled rejection later.
    void work.catch(() => {});
  }
}

/**
 * Mirror one server-side event to PostHog. Awaiting this is what guarantees
 * delivery before the lambda freezes — but a failure is swallowed, so callers
 * never need a try/catch.
 */
export async function phServerCapture(
  event: string,
  distinctId: string,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    const ph = getClient();
    if (!ph) return;
    await withDeadline(
      ph.captureImmediate({
        distinctId: distinctId || "anonymous",
        event,
        properties: props,
      }),
      event,
    );
  } catch (e) {
    log.warn("server capture failed", { event, error: e });
  }
}

/**
 * Report a server exception as a PostHog `$exception`. Uses the SDK's own
 * exception builder rather than a hand-rolled capture — it is what attaches the
 * stack/fingerprint metadata that PostHog error tracking groups on.
 */
export async function phServerException(
  error: unknown,
  distinctId: string,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    const ph = getClient();
    if (!ph) return;
    await withDeadline(
      ph.captureExceptionImmediate(error, distinctId || "anonymous", props),
      "$exception",
    );
  } catch (e) {
    log.warn("server exception capture failed", { error: e });
  }
}
