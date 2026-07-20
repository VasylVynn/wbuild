import "server-only";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Rate limiting (brief §11, build-plan O2): fixed-window counters keyed by
 * client IP. Loose by design — the ceilings sit ~10× above the busiest honest
 * user, so real users never see them; only scripts do.
 *
 * Every threshold is env-tunable without code changes:
 *   RATE_LIMIT_DISABLED=1                  — turn the whole thing off
 *   RATE_LIMIT_<NAME>_MAX=<n>              — per-window ceiling (0 = unlimited)
 *   RATE_LIMIT_<NAME>_WINDOW_SEC=<n>       — window length in seconds
 * where <NAME> is CONVERSATION_START | CHAT_TURN | FINALIZE | LEAD | UPLOAD.
 *
 * Storage: Postgres via the rl_bump() RPC (migration 0003) — counters must be
 * shared across serverless instances, so in-process memory can't be the
 * primary store. When Supabase isn't configured (local bring-up) it falls back
 * to an in-memory map. Any storage error FAILS OPEN: rate limiting must never
 * take the product down.
 */

export type LimitName =
  | "conversation_start" // placeholder tenant + conversation row (persist-actions)
  | "chat_turn" // one onboarding AI turn (burns Anthropic tokens)
  | "finalize" // site generation + publish (the expensive AI call)
  | "lead" // public lead_form submission
  | "upload" // photo upload to Storage
  | "ai_edit" // block-level AI edit in the editor (burns Anthropic tokens)
  | "editor_chat" // agentic editor chat turn (burns Anthropic tokens, P3)
  | "event" // public analytics beacon (view / tel_click / contact_click)
  | "custom_request" // «Хочу кастомні зміни» request to the platform team
  | "img_analyze" // vision photo analysis (burns Anthropic tokens, wave G)
  | "ig_import"; // Instagram profile scrape+import (burns Apify credit, wave E)

type LimitConfig = { max: number; windowSec: number };

/** Loose defaults — see the "legit usage profile" math in build-plan O2. */
const DEFAULTS: Record<LimitName, LimitConfig> = {
  conversation_start: { max: 30, windowSec: 86400 }, // honest user: 1-3/day
  chat_turn: { max: 240, windowSec: 3600 }, // honest conversation: ~15 turns
  finalize: { max: 15, windowSec: 86400 }, // honest user: 1-3 generations/day
  lead: { max: 15, windowSec: 60 }, // honest visitor: 1-2 total
  upload: { max: 120, windowSec: 3600 }, // honest editing session: ~10 photos
  ai_edit: { max: 60, windowSec: 3600 }, // honest editing session: ~10-20 edits
  editor_chat: { max: 120, windowSec: 3600 }, // honest session: ~20-30 agent turns
  event: { max: 300, windowSec: 3600 }, // honest visitor: a handful of events
  custom_request: { max: 5, windowSec: 86400 }, // honest owner: 1-2 requests
  img_analyze: { max: 60, windowSec: 3600 }, // honest session: ~10 photos
  ig_import: { max: 10, windowSec: 86400 }, // honest user: 1-2 imports/day
};

function envInt(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Read at call time so a redeploy with new env vars is all it takes to retune. */
function configFor(name: LimitName): LimitConfig {
  const key = name.toUpperCase();
  return {
    max: envInt(`RATE_LIMIT_${key}_MAX`) ?? DEFAULTS[name].max,
    windowSec: envInt(`RATE_LIMIT_${key}_WINDOW_SEC`) ?? DEFAULTS[name].windowSec,
  };
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/** Friendly message for chat/UI surfaces (Ukrainian — the product language). */
export function rateLimitMessage(retryAfterSec: number): string {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  return mins >= 90
    ? "Забагато запитів із вашої мережі. Спробуйте, будь ласка, завтра."
    : `Забагато запитів із вашої мережі. Спробуйте, будь ласка, через ${mins} хв.`;
}

/**
 * Client IP for keying. On Vercel x-forwarded-for's FIRST entry is the real
 * client. Behind CGNAT many users share one IP — that's why ceilings are loose.
 */
export function ipFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

// --- In-memory fallback (dev without Supabase; per-instance only) -----------

const memCounters = new Map<string, { windowStart: number; count: number }>();

function bumpMemory(key: string, windowStart: number): number {
  if (memCounters.size > 10_000) memCounters.clear(); // crude bound, dev-only path
  const cur = memCounters.get(key);
  if (cur && cur.windowStart === windowStart) {
    cur.count += 1;
    return cur.count;
  }
  memCounters.set(key, { windowStart, count: 1 });
  return 1;
}

// --- Core --------------------------------------------------------------------

const RPC_TIMEOUT_MS = 1500;

/**
 * Count this hit and answer "allowed?". Windows are fixed and epoch-aligned,
 * so all instances agree on boundaries without coordination.
 */
export async function checkRateLimit(
  name: LimitName,
  id: string,
): Promise<RateLimitResult> {
  if (process.env.RATE_LIMIT_DISABLED === "1") return { ok: true };

  const { max, windowSec } = configFor(name);
  if (max <= 0 || windowSec <= 0) return { ok: true }; // 0 = this limit is off

  const nowSec = Math.floor(Date.now() / 1000);
  const windowStartSec = Math.floor(nowSec / windowSec) * windowSec;
  const key = `${name}:${id}`;

  let count: number;
  try {
    if (isSupabaseConfigured()) {
      const rpc = getServiceClient()
        .rpc("rl_bump", {
          p_key: key,
          p_window_start: new Date(windowStartSec * 1000).toISOString(),
          p_expires_at: new Date((windowStartSec + windowSec) * 1000).toISOString(),
        })
        .then(({ data, error }) => {
          if (error) throw new Error(error.message);
          return data as number;
        });
      count = await Promise.race<number>([
        rpc,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("rl_bump timeout")), RPC_TIMEOUT_MS),
        ),
      ]);
    } else {
      count = bumpMemory(key, windowStartSec);
    }
  } catch (e) {
    // Fail open: a broken counter must not block real users.
    console.warn(`rate-limit ${name}: counting failed, allowing`, e);
    return { ok: true };
  }

  if (count <= max) return { ok: true };
  return { ok: false, retryAfterSec: windowStartSec + windowSec - nowSec };
}
