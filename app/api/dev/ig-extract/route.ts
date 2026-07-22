import { NextResponse } from "next/server";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { extractFactsFromProfile } from "@/lib/ig/extract";
import type { IgProfile } from "@/lib/ig/apify";

/**
 * DEV-ONLY: smoke the wave-E facts extraction without Apify.
 *   POST /api/dev/ig-extract  { profile?: IgProfile }
 * Runs extractFactsFromProfile on the given (or a fixture) profile and returns
 * the candidates — one real Anthropic call, no Storage/DB writes.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { profile?: IgProfile };
  const profile: IgProfile = body.profile ?? {
    handle: "kvity.lviv.demo",
    fullName: "Квіткова майстерня «Півонія»",
    bio: "Авторські букети та композиції у Львові 🌸 Доставка по місту щодня. Букет дня — від 650 грн. Пишіть у діректу!",
    posts: [
      { imageUrl: "https://example.com/p1.jpg", caption: "Весільний букет з півоній — від 1800 грн. Збираємо за вашими побажаннями 💐" },
      { imageUrl: "https://example.com/p2.jpg", caption: "Ранкова поставка тюльпанів 🌷 21 шт — 700 грн" },
      { imageUrl: "https://example.com/p3.jpg", caption: "Дякуємо за довіру! Ваші відгуки — наше натхнення" },
    ],
  };

  const extracted = await extractFactsFromProfile(profile);
  return NextResponse.json({ ok: true, extracted });
}
