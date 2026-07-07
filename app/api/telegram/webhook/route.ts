import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram/push";

/**
 * Telegram webhook — handles the /start deep-link that binds the owner's
 * chat_id to their tenant (§5.6): t.me/<bot>?start=<telegram_connect_token>.
 * The token is single-use (cleared after binding). Every call is authenticated
 * via the secret header set at setWebhook time.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true });

  const update = (await req.json().catch(() => null)) as {
    message?: { chat?: { id?: number }; text?: string };
  } | null;

  const chatId = update?.message?.chat?.id;
  const text = update?.message?.text ?? "";
  // Always 200 to Telegram (otherwise it retries forever).
  if (!chatId || !text.startsWith("/start")) return NextResponse.json({ ok: true });

  const token = text.replace("/start", "").trim();
  if (!token) {
    await sendTelegramMessage(
      String(chatId),
      "Вітаю! Щоб отримувати заявки зі свого сайту, натисніть «Підключити Telegram» у панелі Вітрини — і перейдіть за посиланням звідти.",
    );
    return NextResponse.json({ ok: true });
  }

  const sb = getServiceClient();
  const { data: tenant } = await sb
    .from("tenants")
    .select("id, brand, host")
    .eq("telegram_connect_token", token)
    .maybeSingle();

  if (!tenant) {
    await sendTelegramMessage(
      String(chatId),
      "Посилання застаріло. Відкрийте панель Вітрини й натисніть «Підключити Telegram» ще раз.",
    );
    return NextResponse.json({ ok: true });
  }

  await sb
    .from("tenants")
    .update({ telegram_chat_id: String(chatId), telegram_connect_token: null }) // single-use
    .eq("id", tenant.id);

  const businessName =
    (tenant.brand as { businessName?: string } | null)?.businessName ?? tenant.host;
  await sendTelegramMessage(
    String(chatId),
    `✅ Готово! Тепер заявки з сайту «${businessName}» приходитимуть сюди.`,
  );
  return NextResponse.json({ ok: true });
}
