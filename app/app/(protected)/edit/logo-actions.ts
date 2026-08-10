"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { revalidateTenant } from "@/lib/cache";
import { isStorageUrl } from "@/lib/media/media";
import { measureLogoPlateFromUrl } from "@/lib/media/palette";
import { ensureAdaptedLogo } from "@/lib/media/logo";

/**
 * Logo control for the editor (§4.8 + H1). The logo lives on the UNVERSIONED
 * tenant.brand (like the footer), so a change is live immediately — no
 * draft/publish cycle. Self-contained on purpose (no coupling to the block
 * editor actions). Every write is gated by ownership and every URL validated
 * against our Storage bucket.
 */

type LogoResult = { ok: true; logoUrl?: string } | { ok: false; error: string };

type BrandRow = {
  logoUrl?: string;
  logoAdaptedUrl?: string;
  logoPlate?: string;
  logoInkL?: number;
  logoAspect?: number;
} & Record<string, unknown>;

/** A hex plate is a MEASUREMENT of the asset (lib/media/palette). "none", an
 *  unmeasurable asset and a removed logo all mean: store no plate at all. */
const PLATE_HEX = /^#[0-9a-f]{6}$/i;

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
  delete brand.logoPlate;
  delete brand.logoAdaptedUrl;
  delete brand.logoInkL;
  delete brand.logoAspect;
  if (url === null) delete brand.logoUrl;
  else {
    brand.logoUrl = url;
    // L1: artwork baked onto a solid canvas is masked to real alpha into a
    // sibling file; `logoUrl` above stays the owner's untouched original, so
    // removing the logo or a future change always falls back to it.
    const adapted = await ensureAdaptedLogo(url);
    // The mark's own ink, so the chrome can tell "transparent" from "invisible"
    // — a pale mark on the light nav still needs a chip, whether we cut its
    // canvas away or it arrived transparent already. Its shape rides along: a
    // wordmark must not have the business name printed beside it.
    if (adapted?.inkL !== undefined) brand.logoInkL = adapted.inkL;
    if (adapted?.aspect !== undefined) brand.logoAspect = adapted.aspect;
    if (adapted?.url) {
      brand.logoAdaptedUrl = adapted.url;
    } else {
      // O1, and ONLY when nothing was cut out: a mark that still ships on an
      // opaque square gets a deliberate chip in the asset's own backdrop colour
      // instead of a raw rectangle on the light nav and the dark footer.
      // Painting a plate behind an ADAPTED mark would restore the slab we just
      // removed — hence the else. Fail-open: no measurement → no plate.
      const plate = await measureLogoPlateFromUrl(url);
      if (plate && PLATE_HEX.test(plate)) brand.logoPlate = plate;
    }
  }

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
