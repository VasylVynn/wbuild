import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { stripPort } from "@/lib/config";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";

/**
 * Analytics beacon (current-cycle п.2 → feeds the stage-2 monthly report).
 * Fired by the tenant-site Beacon component via navigator.sendBeacon. Tenant is
 * derived from the HOST header (never the body). Fire-and-forget semantics:
 * always answers quickly, stores nothing on any doubt. No IP is persisted.
 */
const KINDS = new Set(["view", "tel_click", "contact_click"]);

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true });

  const limit = await checkRateLimit("event", ipFromHeaders(req.headers));
  if (!limit.ok) return NextResponse.json({ ok: true }); // silent drop

  const host = stripPort(req.headers.get("host") ?? "");
  const body = (await req.json().catch(() => null)) as { kind?: string; path?: string } | null;
  const kind = body?.kind ?? "";
  if (!host || !KINDS.has(kind)) return NextResponse.json({ ok: true });

  const sb = getServiceClient();
  const { data: tenant } = await sb
    .from("tenants")
    .select("id, status")
    .eq("host", host)
    .maybeSingle();
  if (!tenant || tenant.status === "suspended") return NextResponse.json({ ok: true });

  await sb.from("site_events").insert({
    tenant_id: tenant.id,
    kind,
    path: String(body?.path ?? "/").slice(0, 200),
  });
  return NextResponse.json({ ok: true });
}
