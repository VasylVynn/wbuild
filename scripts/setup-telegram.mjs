// scripts/setup-telegram.mjs — one-time webhook registration for the central bot.
// Usage: node scripts/setup-telegram.mjs https://wizz-app.net
// Reads TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET from .env.local.
import { readFileSync } from "node:fs";

const base = process.argv[2];
if (!base || !base.startsWith("http")) {
  console.error("Usage: node scripts/setup-telegram.mjs https://<your-prod-domain>");
  process.exit(1);
}

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  if (l.trim().startsWith("#")) continue;
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}
const token = env.TELEGRAM_BOT_TOKEN;
const secret = env.TELEGRAM_WEBHOOK_SECRET;
if (!token || !secret) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env.local first.");
  process.exit(1);
}

const url = `${base.replace(/\/$/, "")}/api/telegram/webhook`;
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"] }),
});
console.log("setWebhook →", res.status, await res.text());
const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
console.log("getWebhookInfo →", JSON.stringify((await info.json()).result, null, 2));
