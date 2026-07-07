import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Photo upload (§4.8 MVP): the CLIENT pre-processes (canvas re-encode strips
 * EXIF/GPS, fixes orientation, compresses) and posts the result here; we store
 * it in a public Supabase Storage bucket and return the public URL.
 * multipart/form-data: file, host (tenant host — path scoping).
 */
const BUCKET = "photos";
const MAX_BYTES = 8 * 1024 * 1024;

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
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad form" }, { status: 400 });

  const file = form.get("file");
  const host = String(form.get("host") ?? "").trim();
  if (!(file instanceof File) || !host) {
    return NextResponse.json({ error: "file and host required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "not an image" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }

  const sb = getServiceClient();
  const { data: tenant } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
  if (!tenant) return NextResponse.json({ error: "unknown site" }, { status: 404 });

  await ensureBucket();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${tenant.id}/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.publicUrl });
}
