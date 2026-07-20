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
 * SSRF hardening (codex review): the URL comes from a scraped dataset, i.e.
 * attacker-influenceable. IP-literal and obviously-internal hostnames are
 * rejected outright; combined with `redirect: "error"` on the fetch this
 * closes the realistic redirect-to-metadata/internal-service vectors.
 */
function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true; // IPv4 literal
  if (h.includes(":") || h.startsWith("[")) return true; // IPv6 literal
  return false;
}

/**
 * The Content-Type header is attacker-controlled — the BYTES must look like
 * the claimed raster format before we store them in a public bucket.
 */
function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  const gif = buf.subarray(0, 6).toString("ascii");
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
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
    if (isForbiddenHost(parsed.hostname)) return fail("forbidden host");

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
      // No redirects: a redirect from a "photo CDN" URL is exactly the SSRF
      // shape we refuse to follow (real image CDNs serve bytes directly).
      res = await fetch(url, { signal: controller.signal, redirect: "error" });
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

    // Magic-byte check: unlike owner uploads (client re-encodes via canvas),
    // these bytes come from an external host — headers alone prove nothing.
    const sniffed = sniffImage(buf);
    if (!sniffed) return fail("bytes are not a known raster image");

    const corrected = await qualityPass(buf);

    await ensureBucket();
    // No `-orig` copy: §4.8 "never destroy originals" is about OWNER uploads —
    // here the source photo stays untouched on the external host, so there is
    // nothing of ours to preserve alongside.
    const path = `${tenantId}/${crypto.randomUUID()}.${corrected ? "webp" : MIME_EXT[sniffed]}`;
    const up = await sb.storage.from(BUCKET).upload(path, corrected ?? buf, {
      // The sniffed type, not the header, names what we actually stored.
      contentType: corrected ? "image/webp" : sniffed,
      upsert: false,
    });
    if (up.error) return fail("upload failed");

    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn("[media/import] import failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
