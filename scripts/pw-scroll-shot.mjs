// Scroll the page top→bottom in steps (to trigger IntersectionObserver / reveal-
// on-scroll sections), then scroll back to top and take a full-page screenshot.
//   node scripts/pw-scroll-shot.mjs <url> <out.png>
import { chromium } from "playwright";

const [url, out] = process.argv.slice(2);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const h = document.body.scrollHeight;
  for (let y = 0; y < h; y += 500) {
    window.scrollTo(0, y);
    await sleep(120);
  }
  window.scrollTo(0, document.body.scrollHeight);
  await sleep(400);
  window.scrollTo(0, 0);
  await sleep(400);
});
await page.waitForTimeout(600);

await page.screenshot({ path: out, fullPage: true });
console.log("saved:", out);
await browser.close();
