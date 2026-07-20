import { NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { adaptLogoForTemplate } from "@/lib/media/logo-adapt";
import { revalidateTenant } from "@/lib/cache";

/**
 * DEV-ONLY: re-run the logo adaptation (now behind the geometry gate) for a
 * *.lvh.me test tenant. Stores the adapted URL only when the pipeline returns
 * one; a gate rejection keeps the original (fail-open by design).
 *   POST /api/dev/readapt-logo { host }
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
  const brand = (t.brand ?? {}) as Record<string, unknown> & { logoUrl?: string; templateId?: string };
  if (!brand.logoUrl || !brand.templateId) {
    return NextResponse.json({ error: "tenant has no logo or template" }, { status: 400 });
  }
  const adapted = await adaptLogoForTemplate({ logoUrl: brand.logoUrl, templateId: brand.templateId });
  if (adapted) {
    const { error } = await sb
      .from("tenants")
      .update({ brand: { ...brand, logoAdaptedUrl: adapted } })
      .eq("id", t.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await revalidateTenant(host);
  }
  return NextResponse.json({ ok: true, adapted: adapted ?? null });
}
