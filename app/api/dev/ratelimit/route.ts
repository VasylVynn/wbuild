import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, type LimitName } from "@/lib/rate-limit";

/**
 * DEV-ONLY: exercise the rate limiter end-to-end (counting, threshold,
 * retry-after, env overrides) without burning AI tokens or DB rows.
 *   GET /api/dev/ratelimit?name=lead&id=test1&n=20
 * Runs n sequential checks for the given limit/id and reports when (if ever)
 * the limiter started refusing.
 */
const NAMES: LimitName[] = ["conversation_start", "chat_turn", "finalize", "lead", "upload"];

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const name = params.get("name") as LimitName | null;
  const id = params.get("id") ?? "dev-test";
  const n = Math.min(Number.parseInt(params.get("n") ?? "1", 10) || 1, 500);

  if (!name || !NAMES.includes(name)) {
    return NextResponse.json(
      { error: `name must be one of: ${NAMES.join(", ")}` },
      { status: 400 },
    );
  }

  const results: Array<{ ok: boolean; retryAfterSec?: number }> = [];
  for (let i = 0; i < n; i++) {
    const r = await checkRateLimit(name, id);
    results.push(r.ok ? { ok: true } : { ok: false, retryAfterSec: r.retryAfterSec });
  }

  const firstLimited = results.findIndex((r) => !r.ok);
  return NextResponse.json({
    name,
    id,
    checks: n,
    allowed: results.filter((r) => r.ok).length,
    limited: results.filter((r) => !r.ok).length,
    firstLimitedAtCheck: firstLimited === -1 ? null : firstLimited + 1,
    retryAfterSec: firstLimited === -1 ? null : results[firstLimited].retryAfterSec,
  });
}
