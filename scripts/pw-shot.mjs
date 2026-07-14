// UI verification helper: screenshot a page headlessly, optionally clicking
// things first. Used by Claude for visual checks (it can read the PNGs).
//
//   node scripts/pw-shot.mjs <url> <out.png> [options-json]
//   options: { fullPage?: boolean, width?, height?, clicks?: string[] (text to click, in order),
//              waitMs?: number, host?: string (Host header override for lvh-style vhosts) }

import { chromium } from "playwright";

const [url, out, optsRaw] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node scripts/pw-shot.mjs <url> <out.png> [options-json]");
  process.exit(1);
}
const opts = optsRaw ? JSON.parse(optsRaw) : {};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: opts.width ?? 1440, height: opts.height ?? 900 },
  ...(opts.host ? { extraHTTPHeaders: { Host: opts.host } } : {}),
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

for (const text of opts.clicks ?? []) {
  const target = page.getByText(text, { exact: false }).first();
  await target.scrollIntoViewIfNeeded();
  await target.click();
  await page.waitForTimeout(600);
  console.log("clicked:", text);
}
if (opts.waitMs) await page.waitForTimeout(opts.waitMs);

await page.screenshot({ path: out, fullPage: opts.fullPage ?? false });
console.log("saved:", out);
await browser.close();
