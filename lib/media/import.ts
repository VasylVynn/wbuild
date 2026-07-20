import "server-only";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isStorageUrl } from "@/lib/media/media";

/**
 * External-image import (wave E — Instagram). Downloads a photo hosted on a
 * foreign CDN (an Instagram media URL) into OUR public Supabase Storage `photos`
 * bucket and hands back the storage URL. The §4.8 "no foreign image URLs on
 * tenant sites" invariant holds precisely because the output lives in our own
 * bucket — the same guarantee `/api/upload` gives owner uploads.
 *
 * FAIL-OPEN by contract: import is an enhancement, never a gate. Every failure
 * path (bad URL, timeout, wrong type, oversize, missing tenant, upload error)
 * returns `null` with a generic warning and NEVER throws, so a flaky source or
 * an unconfigured environment can never take the onboarding flow down.
 */
const BUCKET = "photos";
const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Only genuine raster photos — one entry per accepted content-type → extension.
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function fail(reason: string): null {
  console.warn(`[media/import] ${reason}`);
  return null;
}

/**
 * Classical quality pass, identical in spirit to the upload route's: sharp is a
 * NATIVE module that can fail to load, so it rides lazily and fail-open — any
 * load/processing error means "proceed with the original bytes" (returns null).
 * Warnings are intentionally discarded here; the vision layer reports them
 * separately, this path only cares about the corrected buffer.
 */
async function qualityPass(buf: Buffer): Promise<Buffer | null> {
  try {
    const { analyzeImage, correctImage } = await import("./process");
    const [, corrected] = await Promise.all([analyzeImage(buf), correctImage(buf)]);
    return corrected;
  } catch (e) {
    console.warn("[media/import] quality layer unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const sb = getServiceClient();
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
  }
  bucketReady = true;
}

/**
 * Import `url` into our Storage bucket, scoped to the tenant resolved from
 * `conversationId` (onboarding, before a host exists) or `host` (editor). Returns
 * the public storage URL, or `null` on any failure.
 */
export async function importExternalImage(
  url: string,
  scope: { conversationId?: string; host?: string },
): Promise<string | null> {
  // Idempotent: an already-imported (our-bucket) URL passes straight through.
  if (isStorageUrl(url)) return url;

  try {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return fail("invalid url");
    }
    if (parsed.protocol !== "https:") return fail("non-https url");

    if (!isSupabaseConfigured()) return fail("supabase not configured");

    const sb = getServiceClient();
    // Resolve the owning tenant BEFORE the network fetch — no tenant, no point
    // downloading. Mirrors the upload route's resolution exactly.
    let tenantId: string | null = null;
    const conversationId = scope.conversationId?.trim();
    const host = scope.host?.trim();
    if (conversationId) {
      if (!UUID_RE.test(conversationId)) return fail("bad conversation id");
      const { data: conv } = await sb
        .from("conversations")
        .select("tenant_id")
        .eq("id", conversationId)
        .maybeSingle();
      tenantId = (conv?.tenant_id as string) ?? null;
    } else if (host) {
      const { data: tenant } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
      tenantId = (tenant?.id as string) ?? null;
    }
    if (!tenantId) return fail("unknown tenant");

    // Bounded download: abort after FETCH_TIMEOUT_MS so a hung source can't stall.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return fail("fetch not ok");

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = MIME_EXT[contentType];
    if (!ext) return fail("unsupported content-type");

    const declaredLen = Number(res.headers.get("content-length"));
    if (Number.isFinite(declaredLen) && declaredLen > MAX_BYTES) return fail("declared too large");

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return fail("empty or oversize body");

    const corrected = await qualityPass(buf);

    await ensureBucket();
    // No `-orig` copy: §4.8 "never destroy originals" is about OWNER uploads —
    // here the source photo stays untouched on the external host, so there is
    // nothing of ours to preserve alongside.
    const path = `${tenantId}/${crypto.randomUUID()}.${corrected ? "webp" : ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, corrected ?? buf, {
      contentType: corrected ? "image/webp" : contentType,
      upsert: false,
    });
    if (up.error) return fail("upload failed");

    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn("[media/import] import failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
