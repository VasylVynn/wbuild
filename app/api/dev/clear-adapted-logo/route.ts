import { NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";

/**
 * DEV-ONLY: drop a test tenant's adapted logo so the ORIGINAL renders again
 * (used after the logo-adapt geometry gate landed — old rows may still point
 * at rejected-quality mockups). *.lvh.me only; the shared-DB rule from
 * dna-check applies.
 *   POST /api/dev/clear-adapted-logo { host }
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { host?: string };
  const host = body.host ?? "";
  if (!host.endsWith(".lvh.me")) {
    return NextResponse.json({ error: "*.lvh.me test tenants only" }, { status: 403 });
  }
  const sb = getServiceClient();
  const { data: t } = await sb.from("tenants").select("id, brand").eq("host", host).maybeSingle();
  if (!t) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const brand = { ...((t.brand ?? {}) as Record<string, unknown>) };
  delete brand.logoAdaptedUrl;
  const { error } = await sb.from("tenants").update({ brand }).eq("id", t.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await revalidateTenant(host);
  return NextResponse.json({ ok: true });
}
