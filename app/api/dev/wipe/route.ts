import { NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * DEV-ONLY: full test-data wipe (owner order 2026-07-20: no prod exists,
 * everything is test). Deletes ALL tenant data in FK order and, with
 * bucket=true, empties the photos bucket. Guarded by NODE_ENV + an explicit
 * confirm word so a stray curl can't nuke the database.
 *   POST /api/dev/wipe { confirm: "WIPE", bucket?: boolean }
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { confirm?: string; bucket?: boolean };
  if (body.confirm !== "WIPE") {
    return NextResponse.json({ error: 'pass { confirm: "WIPE" }' }, { status: 400 });
  }

  const sb = getServiceClient();
  const deleted: Record<string, number | string> = {};
  // FK order: children first. The filter column just needs to be never-null
  // (rate_limits/tenant_members have no id).
  const tables: Array<[string, string]> = [
    ["leads", "id"],
    ["pages", "id"],
    ["conversations", "id"],
    ["tenant_members", "tenant_id"],
    ["rate_limits", "key"],
    ["tenants", "id"],
  ];
  for (const [table, col] of tables) {
    const { count, error } = await sb
      .from(table)
      .delete({ count: "exact" })
      .not(col, "is", null);
    deleted[table] = error ? `ERROR: ${error.message}` : (count ?? 0);
  }

  if (body.bucket) {
    const { error } = await sb.storage.emptyBucket("photos");
    deleted.photos_bucket = error ? `ERROR: ${error.message}` : "emptied";
  }

  return NextResponse.json({ ok: true, deleted });
}
