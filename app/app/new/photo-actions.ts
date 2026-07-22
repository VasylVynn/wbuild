"use server";

import { headers } from "next/headers";
import { analyzePhoto, type PhotoAnalysis } from "@/lib/media/analyze-photo";
import { isStorageUrl } from "@/lib/media/media";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";

/**
 * Vision analysis of ONE uploaded photo (wave G). Deliberately generic — no
 * conversation/host coupling — so the onboarding chat, the editor and the
 * Instagram import (E5) share the same intelligence layer (G6).
 *
 * Fail-open contract (G5): every failure — rate limit, bad URL, vision error —
 * returns { ok: false }. The caller keeps the photo as a plain unclassified
 * upload; analysis never blocks an upload.
 */
export type AnalyzePhotoResult = { ok: true; analysis: PhotoAnalysis } | { ok: false };

export async function analyzePhotoAction(url: unknown): Promise<AnalyzePhotoResult> {
  // §4.8: only assets in OUR bucket are ever fetched/analyzed.
  if (!isStorageUrl(url)) return { ok: false };

  // Vision burns Anthropic tokens — cap it like the other AI surfaces. A
  // limited analysis degrades to "no class", it never blocks the upload.
  const limit = await checkRateLimit("img_analyze", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false };

  const analysis = await analyzePhoto(url);
  return analysis ? { ok: true, analysis } : { ok: false };
}
