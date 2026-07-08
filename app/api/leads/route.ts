import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { stripPort } from "@/lib/config";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";
import { sendTelegramMessage, formatLeadMessage } from "@/lib/telegram/push";

/**
 * Lead submission — the value core (§5.6). Public, unauthenticated write:
 *  - tenant is derived from the HOST HEADER, never from the body (prevents
 *    cross-tenant lead injection);
 *  - soft Origin check + honeypot + length caps against dumb abuse;
 *  - the lead is ALWAYS stored; the Telegram push is best-effort.
 * /api is excluded from middleware, so this runs unrewritten on tenant hosts.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const host = stripPort(req.headers.get("host") ?? "");
  if (!host) return NextResponse.json({ error: "no host" }, { status: 400 });

  // Soft CSRF: if the browser sent an Origin, its host must match the request host.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (stripPort(new URL(origin).host) !== host) {
        return NextResponse.json({ error: "bad origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "bad origin" }, { status: 403 });
    }
  }

  // Frequency cap per IP — after the cheap header checks, before any DB work.
  const limit = await checkRateLimit("lead", ipFromHeaders(req.headers));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    phone?: string;
    message?: string;
    website?: string; // honeypot
  } | null;
  if (!body) return NextResponse.json({ error: "bad body" }, { status: 400 });

  // Honeypot tripped → pretend success, store nothing.
  if (body.website && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const clip = (s: string | undefined, n: number) => (s ?? "").trim().slice(0, n);
  const name = clip(body.name, 200);
  const phone = clip(body.phone, 50);
  const message = clip(body.message, 2000);
  if (!name && !phone) return NextResponse.json({ error: "empty" }, { status: 400 });

  const sb = getServiceClient();
  const { data: tenant } = await sb
    .from("tenants")
    .select("id, brand, status, telegram_chat_id")
    .eq("host", host)
    .maybeSingle();
  if (!tenant || tenant.status === "suspended") {
    return NextResponse.json({ error: "unknown site" }, { status: 404 });
  }

  const { data: lead, error: insErr } = await sb
    .from("leads")
    .insert({
      tenant_id: tenant.id,
      name: name || null,
      phone: phone || null,
      message: message || null,
      meta: { ua: (req.headers.get("user-agent") ?? "").slice(0, 200) },
    })
    .select("id")
    .single();
  if (insErr || !lead) {
    return NextResponse.json({ error: "store failed" }, { status: 500 });
  }

  // Best-effort push — lead capture never depends on the bot being connected.
  if (tenant.telegram_chat_id) {
    const businessName =
      (tenant.brand as { businessName?: string } | null)?.businessName ?? host;
    const ok = await sendTelegramMessage(
      tenant.telegram_chat_id,
      formatLeadMessage({ businessName, host, name, phone, message }),
    );
    if (ok) {
      await sb.from("leads").update({ pushed_at: new Date().toISOString() }).eq("id", lead.id);
    }
  }

  return NextResponse.json({ ok: true });
}
