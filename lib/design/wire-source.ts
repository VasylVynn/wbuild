/**
 * Deterministic section-source extractor for the stylist prompt (pipeline v2
 * spec §6, wave V5). `generateWireStyle` used to inline the WHOLE
 * `sections.tsx` (~31k chars after V3) on every styling call; when a designSpec
 * exists, only the source for the PLANNED sections (plus the always-injected
 * ones) is worth the tokens — the model styles class names, and classes for
 * sections that won't render are noise.
 *
 * Mechanics — text-level, never an AST: `sections.tsx` is organised into
 * banner-delimited groups (`/* ── Hero ── … `), one group per template section
 * including all its layout variants and private helpers. A group's block types
 * are read from its `BlockProps["<type>"]` casts — every wire component opens
 * with one, so the mapping cannot drift from the file.
 *
 * Fail-safe by contract: any structural surprise (few banners, no wanted types
 * matched, extraction barely smaller than the file) returns the WHOLE file with
 * `extracted: false` — a fatter prompt beats a stylist that never saw the hero.
 *
 * Pure (no "server-only") so plain-node vitest covers it against the real file.
 */

/** A banner comment opening a section group, at line start. */
const BANNER_RE = /^\/\* ── /;

/** `data as BlockProps["hero"]` — the block-type cast every component carries. */
const BLOCK_TYPE_RE = /BlockProps\[["'](\w+)["']\]/g;

/** Below this many groups the file's structure is not what we expect — bail. */
const MIN_GROUPS = 4;

/** An extraction that saves less than this fraction is not worth the risk. */
const MIN_SAVINGS = 0.05;

function blockTypesIn(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(BLOCK_TYPE_RE)) out.add(m[1]);
  return out;
}

/**
 * Extract the source for `blockTypes` from the wireframe's sections file.
 * `extracted: false` means the fallback fired and `source` IS the full input.
 */
export function extractSectionSource(
  tsx: string,
  blockTypes: Iterable<string>,
): { source: string; extracted: boolean } {
  const wanted = new Set(blockTypes);
  const full = { source: tsx, extracted: false };
  if (wanted.size === 0) return full;

  // Split into [prelude, group, group, …] at banner-comment line starts.
  const lines = tsx.split("\n");
  const starts: number[] = [];
  lines.forEach((line, i) => {
    if (BANNER_RE.test(line)) starts.push(i);
  });
  if (starts.length < MIN_GROUPS) return full;

  const prelude = lines.slice(0, starts[0]).join("\n");
  const groups = starts.map((start, gi) =>
    lines.slice(start, gi + 1 < starts.length ? starts[gi + 1] : lines.length).join("\n"),
  );

  const kept = groups.filter((g) => {
    for (const type of blockTypesIn(g)) if (wanted.has(type)) return true;
    return false;
  });
  // No planned type found in any group → the file layout changed under us.
  if (kept.length === 0) return full;

  const source = [prelude, ...kept].join("\n");
  if (source.length >= tsx.length * (1 - MIN_SAVINGS)) return full;
  return { source, extracted: true };
}
