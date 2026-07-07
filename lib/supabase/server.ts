import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the SERVICE ROLE key. Used for the public
 * render path — reads published content, bypasses RLS — behind the cache
 * (brief §9, §3.1). NEVER import this into a client component.
 *
 * Lazy on purpose: env is read only when first called, so the app keeps running
 * on the in-memory seed when no keys are set (incremental bring-up).
 */
let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
