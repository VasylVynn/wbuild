import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";

/**
 * Ownership gate (§3.1). Every management surface (edit actions, Telegram link,
 * the sites/leads lists) runs through here so the service-role client can no
 * longer be driven against an arbitrary tenant.
 *
 * Degradation invariant: when auth is unconfigured the dashboard is fully open,
 * so the gate ALWAYS allows and never touches the DB.
 */
export type MemberResult = { ok: true } | { ok: false; error: string };

/** Authorize the current user against one tenant (by host or id). */
export async function requireMember(
  ref: { host: string } | { tenantId: string },
): Promise<MemberResult> {
  if (!isAuthConfigured()) return { ok: true }; // degradation — open dashboard

  const user = await getUser();
  if (!user) return { ok: false, error: "Потрібно увійти, щоб керувати сайтом." };

  const sb = getServiceClient();
  let tenantId: string;
  if ("tenantId" in ref) {
    tenantId = ref.tenantId;
  } else {
    const { data: t } = await sb
      .from("tenants")
      .select("id")
      .eq("host", ref.host)
      .maybeSingle();
    if (!t) return { ok: false, error: "Сайт не знайдено." };
    tenantId = t.id as string;
  }

  const { data: m } = await sb
    .from("tenant_members")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!m) return { ok: false, error: "У вас немає доступу до цього сайту." };
  return { ok: true };
}

/**
 * Tenant IDs the current user may manage — used to scope the sites/leads lists.
 * Returns null when auth is unconfigured, signalling "show everything" (the
 * pre-auth behaviour). An empty array means a logged-in user with no sites yet.
 */
export async function myTenantIds(): Promise<string[] | null> {
  if (!isAuthConfigured()) return null; // degradation — list all
  const user = await getUser();
  if (!user) return [];
  const sb = getServiceClient();
  const { data } = await sb
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id);
  return (data ?? []).map((r) => r.tenant_id as string);
}
