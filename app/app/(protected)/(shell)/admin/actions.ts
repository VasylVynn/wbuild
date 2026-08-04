"use server";

import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/lib/admin";
import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";
import { normalizeDomain } from "@/lib/domains/rdap";
import { createLogger } from "@/lib/log";

const log = createLogger("admin");

/**
 * Platform kill-switch (founders only). Server actions are independently
 * callable — the page-level `notFound()` gate does NOT protect this, so the
 * admin check is re-run here (§ same fail-closed contract as lib/admin.ts).
 *
 * suspend: 'suspended' — getTenantByHost (lib/tenant/data.ts) treats that as
 * "doesn't exist" for public render, so the site 404s immediately once the
 * cache is purged.
 * restore: back to whatever the tenant's real state was — 'published' if the
 * home page had already been published at least once, else 'draft' (never
 * silently re-publish a site that was never live).
 */
/**
 * Purge a tenant's render cache on THIS (production) instance. Needed whenever
 * tenant data changes outside the app's own actions (DB surgery, local-instance
 * scripts) — revalidateTag only purges the instance it runs on.
 */
export async function adminRevalidateTenant(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isPlatformAdmin())) return { ok: false, error: "Немає доступу." };

  const sb = getServiceClient();
  const { data: tenant } = await sb.from("tenants").select("host").eq("id", tenantId).maybeSingle();
  if (!tenant?.host) return { ok: false, error: "Сайт не знайдено." };

  await revalidateTenant(tenant.host);
  return { ok: true };
}

export async function adminSetTenantStatus(
  tenantId: string,
  action: "suspend" | "restore",
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  if (!(await isPlatformAdmin())) return { ok: false, error: "Немає доступу." };

  const sb = getServiceClient();
  const { data: tenant } = await sb
    .from("tenants")
    .select("id, host, custom_domain")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Сайт не знайдено." };

  let status: string;
  if (action === "suspend") {
    status = "suspended";
  } else {
    const { data: home } = await sb
      .from("pages")
      .select("is_published")
      .eq("tenant_id", tenantId)
      .eq("slug", "")
      .maybeSingle();
    status = home?.is_published ? "published" : "draft";
  }

  const { error } = await sb.from("tenants").update({ status }).eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  // A suspended site must go dark on its paid domain too — that host serves the
  // same pages under its own cache tag, so purging only the subdomain would
  // leave the custom domain live (or, on restore, still 404ing).
  if (tenant.host) await revalidateTenant(tenant.host as string);
  const customDomain = tenant.custom_domain as string | null;
  if (customDomain && customDomain !== tenant.host) await revalidateTenant(customDomain);
  // Route file lives at app/app/(protected)/admin/page.tsx — the (protected)
  // group doesn't affect the URL, but middleware rewrites the EXTERNAL /admin
  // (on the app.<root> dashboard host) to the INTERNAL /app/admin path that
  // Next actually resolves (see middleware.ts isDashboardHost branch). That
  // internal path is what revalidatePath needs.
  revalidatePath("/app/admin");

  return { ok: true, status };
}

/**
 * Put a tenant on its own domain (spec 2026-08-05 §4). Ops has already bought
 * the name and pointed DNS at us; this is the DB half — after it, the host
 * resolves (getTenantByHost matches custom_domain) and every absolute URL
 * switches to it, because canonical_hostname is the source of all of them
 * (invariant 2).
 *
 * That makes this a cache event on BOTH names: the subdomain's cached pages
 * still carry old canonicals, and the new domain has never been rendered. The
 * previous custom domain, if we're moving off one, gets purged too.
 */
export async function adminActivateDomainAction(
  host: string,
  customDomain: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isPlatformAdmin())) return { ok: false, error: "Немає доступу." };

  const domain = normalizeDomain(customDomain);
  if (!domain) return { ok: false, error: "Некоректне доменне ім'я." };

  const sb = getServiceClient();
  const { data: tenant } = await sb
    .from("tenants")
    .select("id, host, custom_domain")
    .eq("host", host)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Сайт не знайдено." };

  const { error } = await sb
    .from("tenants")
    .update({ custom_domain: domain, canonical_hostname: domain, domain_status: "active" })
    .eq("id", tenant.id);
  if (error) {
    // custom_domain is UNIQUE (migration 0009) — the collision is the one DB
    // error an operator can actually act on, so it gets a real sentence.
    const taken = error.code === "23505";
    log.error("domain activation failed", { host, domain, error: error.message });
    return {
      ok: false,
      error: taken ? "Цей домен вже привʼязаний до іншого сайту." : error.message,
    };
  }

  await revalidateTenant(host);
  await revalidateTenant(domain);
  const previous = tenant.custom_domain as string | null;
  if (previous && previous !== domain) await revalidateTenant(previous);
  revalidatePath("/app/admin");

  log.info("domain activated", { host, domain });
  return { ok: true };
}
