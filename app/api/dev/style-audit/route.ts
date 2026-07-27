import { NextResponse, type NextRequest } from "next/server";
import { lintWireCss } from "@/lib/design/css-lint";
import { fixContrast } from "@/lib/design/css-contrast";

/** Local-only smoke harness for the style QA gate modules (no test runner in
 *  this repo — /api/dev/* is the established substitute). Extended per-task. */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as { css?: string } | null;
  if (!body?.css) return NextResponse.json({ error: "css required" }, { status: 400 });
  const lint = lintWireCss(body.css);
  const contrast = fixContrast(lint.cleanCss);
  return NextResponse.json({ lint, contrast });
}
