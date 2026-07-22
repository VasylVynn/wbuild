import { NextResponse } from "next/server";
import { logoPaletteFamily } from "@/lib/theme/logo-palette";

/** DEV-ONLY: probe the logo→palette-family mapping (D3.3 smoke). */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const family = await logoPaletteFamily(body.url);
  return NextResponse.json({ ok: true, family });
}
