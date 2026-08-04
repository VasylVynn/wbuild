"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { revalidateTenant } from "@/lib/cache";
import { isStorageUrl } from "@/lib/media/media";

/**
 * Logo control for the editor (§4.8 + H1). The logo lives on the UNVERSIONED
 * tenant.brand (like the footer), so a change is live immediately — no
 * draft/publish cycle. Self-contained on purpose (no coupling to the block
 * editor actions). Every write is gated by ownership and every URL validated
 * against our Storage bucket.
 */

type LogoResult = { ok: true; logoUrl?: string } | { ok: false; error: string };

type BrandRow = { logoUrl?: string } & Record<string, unknown>;

export async function getLogoAction(host: string): Promise<LogoResult> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };

  const sb = getServiceClient();
  const { data: t } = await sb.from("tenants").select("brand").eq("host", host).maybeSingle();
  if (!t) return { ok: false, error: "tenant not found" };

  const brand = (t.brand ?? {}) as BrandRow;
  return { ok: true, ...(brand.logoUrl && { logoUrl: brand.logoUrl }) };
}

/** Set (url) or remove (null) the tenant logo. Live immediately. */
export async function setLogoAction(host: string, url: string | null): Promise<LogoResult> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };
  if (url !== null && !isStorageUrl(url)) return { ok: false, error: "invalid url" };

  const sb = getServiceClient();
  const { data: t } = await sb
    .from("tenants")
    .select("id, brand, custom_domain")
    .eq("host", host)
    .maybeSingle();
  if (!t) return { ok: false, error: "tenant not found" };

  const brand = { ...((t.brand ?? {}) as BrandRow) };
  if (url === null) delete brand.logoUrl;
  else brand.logoUrl = url;

  const { error } = await sb.from("tenants").update({ brand }).eq("id", t.id);
  if (error) return { ok: false, error: error.message };

  // brand is unversioned — purge so the header updates. A tenant on its paid
  // domain answers under a second cache tag; miss it and the new logo shows on
  // the subdomain but not on the domain the owner paid for.
  await revalidateTenant(host);
  const customDomain = t.custom_domain as string | null;
  if (customDomain && customDomain !== host) await revalidateTenant(customDomain);
  return { ok: true, ...(url && { logoUrl: url }) };
}
