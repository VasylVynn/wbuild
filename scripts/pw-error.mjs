// Navigate and dump server/console errors + the Next dev error overlay text.
//   node scripts/pw-error.mjs <url>
import { chromium } from "playwright";
const [url] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => { if (m.type() === "error") logs.push("CONSOLE: " + m.text()); });
page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));
const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
console.log("HTTP:", resp?.status());
await page.waitForTimeout(1200);
const overlay = await page.evaluate(() => {
  const el = document.querySelector("nextjs-portal") || document.body;
  return (el?.innerText || "").slice(0, 1500);
});
console.log("=== console/page errors ===");
console.log(logs.join("\n") || "(none)");
console.log("=== overlay/body text ===");
console.log(overlay);
await browser.close();
