import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";
import { analyzeImage, correctImage } from "@/lib/media/process";

/**
 * Photo upload (§4.8 MVP): the CLIENT pre-processes (canvas re-encode strips
 * EXIF/GPS, fixes orientation, compresses) and posts the result here. We run a
 * classical (non-generative) quality pass — plan 6а — on the server: analyze
 * for soft warnings, auto-correct exposure/clarity, and store BOTH the
 * corrected file (served to the site) and the untouched original (§4.8: never
 * destroyed) side by side in a public Supabase Storage bucket.
 * multipart/form-data: file + EITHER host (tenant host) OR conversationId
 * (onboarding, before a host exists) — both resolve to a tenant id for path
 * scoping.
 */
const BUCKET = "photos";
const MAX_BYTES = 8 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  // Volume cap per IP — Storage is unmetered otherwise (8MB × ∞ adds up).
  const limit = await checkRateLimit("upload", ipFromHeaders(req.headers));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad form" }, { status: 400 });

  const file = form.get("file");
  const host = String(form.get("host") ?? "").trim();
  const conversationId = String(form.get("conversationId") ?? "").trim();
  if (!(file instanceof File) || (!host && !conversationId)) {
    return NextResponse.json({ error: "file and host|conversationId required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "not an image" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }

  const sb = getServiceClient();
  // Resolve the owning tenant id. Onboarding uploads scope by conversationId
  // (no host yet); editor uploads scope by host. Both land under the tenant id.
  let tenantId: string;
  if (conversationId) {
    if (!UUID_RE.test(conversationId)) {
      return NextResponse.json({ error: "unknown conversation" }, { status: 404 });
    }
    const { data: conv } = await sb
      .from("conversations")
      .select("tenant_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv?.tenant_id) return NextResponse.json({ error: "unknown conversation" }, { status: 404 });
    tenantId = conv.tenant_id as string;
  } else {
    const { data: tenant } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
    if (!tenant) return NextResponse.json({ error: "unknown site" }, { status: 404 });
    tenantId = tenant.id as string;
  }

  await ensureBucket();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const id = crypto.randomUUID();
  const buf = Buffer.from(await file.arrayBuffer());

  // analyzeImage/correctImage both read the ORIGINAL bytes and never throw —
  // a bad or unusual image degrades to "no warnings" / "uncorrected buffer",
  // it never blocks the upload.
  const [{ warnings }, corrected] = await Promise.all([analyzeImage(buf), correctImage(buf)]);

  // Corrected file is always WebP (what correctImage emits); the untouched
  // original keeps its own extension alongside it — §4.8, original is never
  // destroyed.
  const mainPath = `${tenantId}/${id}.webp`;
  const origPath = `${tenantId}/${id}-orig.${ext}`;
  const [main, orig] = await Promise.all([
    sb.storage.from(BUCKET).upload(mainPath, corrected, { contentType: "image/webp", upsert: false }),
    sb.storage.from(BUCKET).upload(origPath, buf, { contentType: file.type, upsert: false }),
  ]);
  if (main.error) return NextResponse.json({ error: main.error.message }, { status: 500 });
  // Preserving the original is best-effort: it backs up the source photo but
  // isn't what the site serves, so a failure here shouldn't block the upload
  // the owner is actually waiting on.
  if (orig.error) console.warn("[upload] failed to persist original alongside corrected", orig.error);

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(mainPath);
  return NextResponse.json({ ok: true, url: pub.publicUrl, warnings });
}
