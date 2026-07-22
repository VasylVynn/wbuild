"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { revalidateTenant } from "@/lib/cache";
import { isStorageUrl } from "@/lib/media/media";
import { adaptLogoForTemplate } from "@/lib/media/logo-adapt";

/**
 * Logo control for the editor (§4.8 + H1). The logo lives on the UNVERSIONED
 * tenant.brand (like the footer), so a change is live immediately — no
 * draft/publish cycle. Self-contained on purpose (no coupling to the block
 * editor actions). Every write is gated by ownership and every URL validated
 * against our Storage bucket.
 *
 * H1 adaptation: on upload, a template site's logo is vision-checked against
 * the template's nav surface and adapted when it clashes. The adapted file
 * sits ALONGSIDE the original (logoAdaptedUrl); `logoDisplay` is the owner's
 * toggle («Оригінал / Адаптоване»), absent = adapted-when-available.
 */

type LogoResult =
  | { ok: true; logoUrl?: string; logoAdaptedUrl?: string; logoDisplay?: "original" | "adapted" }
  | { ok: false; error: string };

type BrandRow = {
  logoUrl?: string;
  logoAdaptedUrl?: string;
  logoDisplay?: "original" | "adapted";
  templateId?: string;
} & Record<string, unknown>;

export async function getLogoAction(host: string): Promise<LogoResult> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };

  const sb = getServiceClient();
  const { data: t } = await sb.from("tenants").select("brand").eq("host", host).maybeSingle();
  if (!t) return { ok: false, error: "tenant not found" };

  const brand = (t.brand ?? {}) as BrandRow;
  return {
    ok: true,
    ...(brand.logoUrl && { logoUrl: brand.logoUrl }),
    ...(brand.logoAdaptedUrl && { logoAdaptedUrl: brand.logoAdaptedUrl }),
    ...(brand.logoDisplay && { logoDisplay: brand.logoDisplay }),
  };
}

/** Set (url) or remove (null) the tenant logo. Live immediately. */
export async function setLogoAction(host: string, url: string | null): Promise<LogoResult> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };
  if (url !== null && !isStorageUrl(url)) return { ok: false, error: "invalid url" };

  const sb = getServiceClient();
  const { data: t } = await sb.from("tenants").select("id, brand").eq("host", host).maybeSingle();
  if (!t) return { ok: false, error: "tenant not found" };

  // The adaptation call below can take tens of seconds — run it BEFORE the
  // brand write and re-read the row afterwards, so a concurrent edit (another
  // upload, template pin, photo change) is not clobbered by a stale snapshot.
  let adaptedUrl: string | undefined;
  if (url !== null) {
    const templateId = ((t.brand ?? {}) as BrandRow).templateId;
    if (templateId) {
      // Fail-open: null → the original simply shows as-is.
      adaptedUrl = (await adaptLogoForTemplate({ logoUrl: url, templateId })) ?? undefined;
    }
  }

  const { data: fresh } = await sb
    .from("tenants")
    .select("brand")
    .eq("id", t.id)
    .maybeSingle();
  const brand = { ...(((fresh ?? t).brand ?? {}) as BrandRow) };
  // A new (or removed) file invalidates the previous adaptation and the toggle.
  delete brand.logoAdaptedUrl;
  delete brand.logoDisplay;
  if (url === null) {
    delete brand.logoUrl;
  } else {
    brand.logoUrl = url;
    if (adaptedUrl) brand.logoAdaptedUrl = adaptedUrl;
  }

  const { error } = await sb.from("tenants").update({ brand }).eq("id", t.id);
  if (error) return { ok: false, error: error.message };

  await revalidateTenant(host); // brand is unversioned — purge so the header updates
  return {
    ok: true,
    ...(url && { logoUrl: url }),
    ...(brand.logoAdaptedUrl && { logoAdaptedUrl: brand.logoAdaptedUrl }),
  };
}

/** Owner's «Оригінал / Адаптоване» pick (H1). Live immediately, like the logo. */
export async function setLogoDisplayAction(
  host: string,
  display: "original" | "adapted",
): Promise<LogoResult> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };
  if (display !== "original" && display !== "adapted") {
    return { ok: false, error: "invalid display mode" };
  }

  const sb = getServiceClient();
  // Read-modify-write with no awaits in between — unlike setLogoAction there is
  // no slow AI call here, so the lost-update window is milliseconds and the UI
  // disables the toggle while busy.
  const { data: t } = await sb.from("tenants").select("id, brand").eq("host", host).maybeSingle();
  if (!t) return { ok: false, error: "tenant not found" };

  const brand = { ...((t.brand ?? {}) as BrandRow) };
  if (display === "adapted" && !brand.logoAdaptedUrl) {
    return { ok: false, error: "no adapted logo" };
  }
  brand.logoDisplay = display;

  const { error } = await sb.from("tenants").update({ brand }).eq("id", t.id);
  if (error) return { ok: false, error: error.message };

  await revalidateTenant(host);
  return {
    ok: true,
    ...(brand.logoUrl && { logoUrl: brand.logoUrl }),
    ...(brand.logoAdaptedUrl && { logoAdaptedUrl: brand.logoAdaptedUrl }),
    logoDisplay: display,
  };
}
