import { NextResponse, type NextRequest } from "next/server";
import { lintWireCss } from "@/lib/design/css-lint";
import { fixContrast } from "@/lib/design/css-contrast";
import { runStyleAudit } from "@/lib/design/style-audit";

/** Local-only smoke harness for the style QA gate modules (no test runner in
 *  this repo — /api/dev/* is the established substitute). Extended per-task. */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as
    | { css?: string; full?: boolean; digest?: string; brief?: string; hue?: number }
    | null;
  if (!body?.css) return NextResponse.json({ error: "css required" }, { status: 400 });
  if (body.full) {
    const result = await runStyleAudit({
      css: body.css,
      sectionDigest: body.digest ?? "- [id=hero, блок hero] Тестовий заголовок",
      brief: body.brief ?? "Тестовий бізнес, Київ.",
      hue: body.hue ?? 180,
    });
    return NextResponse.json(result);
  }
  const lint = lintWireCss(body.css);
  const contrast = fixContrast(lint.cleanCss);
  return NextResponse.json({ lint, contrast });
}
