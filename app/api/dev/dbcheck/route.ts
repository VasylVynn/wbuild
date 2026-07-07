import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

/** DEV-ONLY: reports what THIS server process sees for Supabase (no secrets). */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }
  let urlHost: string | null = null;
  try {
    urlHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    urlHost = null;
  }
  const keyPrefix = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 10);
  const keyLen = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length;

  let read: unknown;
  try {
    const sb = getServiceClient();
    const { count, error } = await sb
      .from("tenants")
      .select("*", { count: "exact", head: true });
    read = { count: count ?? null, error: error?.message ?? null };
  } catch (e) {
    read = { thrown: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ urlHost, keyPrefix, keyLen, read });
}
