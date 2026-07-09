"use server";

import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/lib/admin";
import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";

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
export async function adminSetTenantStatus(
  tenantId: string,
  action: "suspend" | "restore",
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  if (!(await isPlatformAdmin())) return { ok: false, error: "Немає доступу." };

  const sb = getServiceClient();
  const { data: tenant } = await sb
    .from("tenants")
    .select("id, host")
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

  if (tenant.host) await revalidateTenant(tenant.host);
  // Route file lives at app/app/(protected)/admin/page.tsx — the (protected)
  // group doesn't affect the URL, but middleware rewrites the EXTERNAL /admin
  // (on the app.<root> dashboard host) to the INTERNAL /app/admin path that
  // Next actually resolves (see middleware.ts isDashboardHost branch). That
  // internal path is what revalidatePath needs.
  revalidatePath("/app/admin");

  return { ok: true, status };
}
