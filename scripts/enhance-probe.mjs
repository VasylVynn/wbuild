// Prototype for plan item 6 (AI-enhance photos, §4.8 bounds): given an image
// URL, produce an enhanced version via Gemini (nano-banana) next to the
// original for a human before/after verdict. Dev tool — not wired into the app.
//
//   node scripts/enhance-probe.mjs <image-url> <out-dir>

import fs from "node:fs";
import path from "node:path";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const API_KEY = env.GEMINI_API_KEY;
if (!API_KEY) throw new Error("GEMINI_API_KEY missing in .env.local");

const MODEL = "gemini-2.5-flash-image";

// §4.8: light/color/framing only — the scene itself is untouchable.
const INSTRUCTION =
  "Enhance this photo for a small business website: improve exposure, white balance, " +
  "contrast and sharpness; reduce noise. Do NOT add, remove, move or alter any objects, " +
  "products, people, text or logos. The scene must remain exactly the same — only better " +
  "lit, cleaner and clearer.";

const [imageUrl, outDir = "."] = process.argv.slice(2);
if (!imageUrl) throw new Error("usage: node scripts/enhance-probe.mjs <image-url> [out-dir]");

const imgRes = await fetch(imageUrl);
if (!imgRes.ok) throw new Error(`fetch image: ${imgRes.status}`);
const mime = imgRes.headers.get("content-type") ?? "image/jpeg";
const buf = Buffer.from(await imgRes.arrayBuffer());
fs.mkdirSync(outDir, { recursive: true });
const beforePath = path.join(outDir, `before${path.extname(new URL(imageUrl).pathname) || ".jpg"}`);
fs.writeFileSync(beforePath, buf);

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
  {
    method: "POST",
    headers: { "x-goog-api-key": API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mime, data: buf.toString("base64") } },
            { text: INSTRUCTION },
          ],
        },
      ],
    }),
  },
);

const json = await res.json();
if (!res.ok) throw new Error(`gemini ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);

const parts = json.candidates?.[0]?.content?.parts ?? [];
const imgPart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
if (!imgPart) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 400)}`);
const data = imgPart.inlineData?.data ?? imgPart.inline_data?.data;
const outMime = imgPart.inlineData?.mimeType ?? imgPart.inline_data?.mime_type ?? "image/png";
const ext = outMime.includes("png") ? "png" : outMime.includes("webp") ? "webp" : "jpg";

const afterPath = path.join(outDir, `after.${ext}`);
fs.writeFileSync(afterPath, Buffer.from(data, "base64"));
console.log("before:", beforePath, `${Math.round(buf.length / 1024)}KB`);
console.log("after: ", afterPath, `${Math.round(Buffer.from(data, "base64").length / 1024)}KB`);
