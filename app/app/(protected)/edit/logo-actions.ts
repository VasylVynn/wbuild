"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { revalidateTenant } from "@/lib/cache";
import { isStorageUrl } from "@/lib/media/media";

/**
 * Logo control for the editor (§4.8). The logo lives on the UNVERSIONED
 * tenant.brand (like the footer), so a change is live immediately — no
 * draft/publish cycle. Self-contained on purpose (no coupling to the block
 * editor actions): read the current logo, set or remove it. Every write is
 * gated by ownership and every URL validated against our Storage bucket.
 */

type LogoResult = { ok: true; logoUrl?: string } | { ok: false; error: string };

export async function getLogoAction(host: string): Promise<LogoResult> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };

  const sb = getServiceClient();
  const { data: t } = await sb.from("tenants").select("brand").eq("host", host).maybeSingle();
  if (!t) return { ok: false, error: "tenant not found" };

  const brand = (t.brand ?? {}) as { logoUrl?: string };
  return { ok: true, ...(brand.logoUrl && { logoUrl: brand.logoUrl }) };
}

/** Set (url) or remove (null) the tenant logo. Live immediately. */
export async function setLogoAction(host: string, url: string | null): Promise<LogoResult> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };
  if (url !== null && !isStorageUrl(url)) return { ok: false, error: "invalid url" };

  const sb = getServiceClient();
  const { data: t } = await sb.from("tenants").select("id, brand").eq("host", host).maybeSingle();
  if (!t) return { ok: false, error: "tenant not found" };

  // Read-modify-write brand so we don't clobber businessName / photos.
  const brand = { ...((t.brand ?? {}) as Record<string, unknown>) };
  if (url === null) delete brand.logoUrl;
  else brand.logoUrl = url;

  const { error } = await sb.from("tenants").update({ brand }).eq("id", t.id);
  if (error) return { ok: false, error: error.message };

  await revalidateTenant(host); // brand is unversioned — purge so the header updates
  return { ok: true, ...(url && { logoUrl: url }) };
}
