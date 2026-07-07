import "server-only";

/**
 * Central platform Telegram bot (§5.6): ONE bot serves all tenants; the owner
 * is identified by chat_id captured via the /start deep-link. Vercel serverless
 * forbids long-polling — pushes are direct HTTPS sendMessage calls, incoming
 * /start updates arrive via the webhook route.
 */

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function botUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME || null;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function formatLeadMessage(input: {
  businessName: string;
  host: string;
  name?: string;
  phone?: string;
  message?: string;
}): string {
  const lines = [
    `🔔 <b>Нова заявка з сайту ${esc(input.businessName)}</b>`,
    "",
    input.name ? `👤 ${esc(input.name)}` : null,
    input.phone ? `📞 ${esc(input.phone)}` : null,
    input.message ? `💬 ${esc(input.message)}` : null,
    "",
    `🌐 ${esc(input.host)}`,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}
