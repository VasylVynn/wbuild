import { NextResponse } from "next/server";
import { analyzePhoto } from "@/lib/media/analyze-photo";

/** DEV-ONLY: smoke the vision photo-intelligence layer on one storage URL. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const analysis = await analyzePhoto(body.url ?? "");
  return NextResponse.json({ ok: true, analysis });
}
