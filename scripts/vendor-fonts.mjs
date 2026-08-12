// scripts/vendor-fonts.mjs — vendor every Google font the product uses into the
// repo, so neither `next build` nor a tenant page ever depends on Google again.
//
// WHY THIS EXISTS. Google rotates the files behind fonts.gstatic.com. Any warm
// cache that remembers the old URLs — a Vercel build cache, a local .next —
// then requests files that 404, and next/font surfaces that as a BUILD FAILURE
// («Module not found: @vercel/turbopack-next/internal/font/google/font») or as
// 500s in dev. It broke the deploy twice (Playfair, 2026-08-10 and 2026-08-12)
// and local dev once (Nunito) inside one week. Self-hosting removes the
// dependency instead of racing the rotation.
//
// WHAT IT DOES. For each family: fetch Google's css2 with a woff2-capable UA,
// download every referenced .woff2 into public/fonts/, and emit app/fonts.css —
// the same @font-face blocks (unicode-range subsetting intact) with local URLs,
// plus a :root block mapping each --font-* variable to its family name. That
// file replaces every next/font loader.
//
// RE-RUN when adding a family or changing weights; commit the result. Node 18+.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "fonts");
const CSS_OUT = join(process.cwd(), "app", "fonts.css");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** slug → { css2 family spec, css font-family name, CSS variable }.
 *  Weight ranges mirror what the next/font loaders requested (full variable
 *  range; Cormorant is static and lists its weights). */
const FAMILIES = {
  inter: { spec: "Inter:wght@100..900", name: "Inter", cssVar: "--font-inter" },
  montserrat: { spec: "Montserrat:wght@100..900", name: "Montserrat", cssVar: "--font-montserrat" },
  rubik: { spec: "Rubik:wght@300..900", name: "Rubik", cssVar: "--font-rubik" },
  lora: { spec: "Lora:wght@400..700", name: "Lora", cssVar: "--font-lora" },
  "source-sans": { spec: "Source+Sans+3:wght@200..900", name: "Source Sans 3", cssVar: "--font-source-sans" },
  literata: { spec: "Literata:wght@200..900", name: "Literata", cssVar: "--font-literata" },
  // Real italics, not faux: the legacy ferri/salon/portfolio wrappers loaded
  // them explicitly (and ferri from weight 300), and tenant stylists write
  // `font-style: italic` for serif headings — a synthesized oblique on a serif
  // reads as a rendering bug.
  cormorant: { spec: "Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700", name: "Cormorant Garamond", cssVar: "--font-cormorant" },
  nunito: { spec: "Nunito:wght@200..1000", name: "Nunito", cssVar: "--font-nunito" },
  "nunito-sans": { spec: "Nunito+Sans:wght@200..1000", name: "Nunito Sans", cssVar: "--font-nunito-sans" },
  playfair: { spec: "Playfair+Display:ital,wght@0,400..900;1,400..900", name: "Playfair Display", cssVar: "--font-playfair" },
  jost: { spec: "Jost:wght@100..900", name: "Jost", cssVar: "--font-jost" },
  onest: { spec: "Onest:wght@100..900", name: "Onest", cssVar: "--font-onest" },
  manrope: { spec: "Manrope:wght@200..800", name: "Manrope", cssVar: "--font-manrope" },
  // Used ONLY by the legacy templates (components/templates/**) — vendored so
  // their wrappers can drop next/font too; the registry imports them, so their
  // loaders were still live at build time and broke it just the same.
  poppins: { spec: "Poppins:wght@400;500;600;700", name: "Poppins", cssVar: "--font-poppins-vendored" },
  quicksand: { spec: "Quicksand:wght@300..700", name: "Quicksand", cssVar: "--font-quicksand-vendored" },
  comfortaa: { spec: "Comfortaa:wght@300..700", name: "Comfortaa", cssVar: "--font-comfortaa-vendored" },
  "jetbrains-mono": { spec: "JetBrains+Mono:wght@100..800", name: "JetBrains Mono", cssVar: "--font-jetbrains-vendored" },
  unbounded: { spec: "Unbounded:wght@200..900", name: "Unbounded", cssVar: "--font-unbounded" },
};

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.text();
};

let totalBytes = 0;
let totalFiles = 0;
const sections = [];

for (const [slug, fam] of Object.entries(FAMILIES)) {
  const css = await fetchText(
    `https://fonts.googleapis.com/css2?family=${fam.spec}&display=swap`,
  );
  mkdirSync(join(OUT_DIR, slug), { recursive: true });
  let rewritten = css;
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+\.woff2)\)/g)].map((m) => m[1]))];
  for (const url of urls) {
    const file = url.split("/").pop();
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(OUT_DIR, slug, file), buf);
    totalBytes += buf.length;
    totalFiles += 1;
    rewritten = rewritten.replaceAll(url, `/fonts/${slug}/${file}`);
  }
  sections.push(`/* ── ${fam.name} (${urls.length} files) ${"─".repeat(Math.max(1, 40 - fam.name.length))} */\n${rewritten.trim()}`);
  console.log(`${slug}: ${urls.length} files`);
}

const rootVars = Object.values(FAMILIES)
  .map((f) => `  ${f.cssVar}: "${f.name}";`)
  .join("\n");

const header = `/* GENERATED by scripts/vendor-fonts.mjs — do not edit by hand; re-run the
 * script to change families or weights.
 *
 * Self-hosted replacement for every next/font/google loader. Google rotates
 * the files behind fonts.gstatic.com, and any warm build cache then requests
 * dead URLs: the deploy failed twice and local dev once in a single week
 * before this file existed. The @font-face blocks below are Google's own css2
 * output (unicode-range subsetting intact) with the files vendored into
 * /public/fonts, so builds and tenant pages never leave this repo.
 *
 * The :root block is the contract the rest of the product reads: FONT_FAMILIES
 * (lib/design/font-pairs.ts) resolves each family through its --font-* variable
 * — wireDesignAttrs inlines them per tenant, the fallback sheet declares them —
 * and lib/design/font-pairs.test.ts source-checks this file against the
 * whitelist. */

:root {
${rootVars}
}
`;

writeFileSync(CSS_OUT, `${header}\n${sections.join("\n\n")}\n`);
console.log(`\n${totalFiles} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB → public/fonts; css → app/fonts.css`);
