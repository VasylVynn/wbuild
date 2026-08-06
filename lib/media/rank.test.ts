import { describe, expect, it } from "vitest";
import type { PhotoMeta } from "./media";
import {
  compareHeroFitness,
  comparePhotoQuality,
  isUsablePhoto,
  photoScore,
  pickHeroUrl,
  rankPhotoUrls,
  usablePhotoCount,
} from "./rank";

/**
 * Photo vetting (wave A). These rules decide which owner photos reach the site
 * and which one becomes the banner, so the interesting cases are the missing
 * signals: an unrated photo must never be punished for having no score, and a
 * bad-pixels warning must be able to outweigh a flattering vision number.
 */

const photo = (url: string, extra: Partial<PhotoMeta> = {}): PhotoMeta => ({ url, ...extra });

describe("photoScore", () => {
  it("treats an unrated photo as mid-quality, not as zero", () => {
    expect(photoScore(undefined)).toBe(5);
    expect(photoScore(photo("a"))).toBe(5);
    expect(photoScore(photo("a", { siteQuality: 0 }))).toBe(0);
  });

  it("penalizes burned-in text and each bad-pixels warning", () => {
    expect(photoScore(photo("a", { siteQuality: 8, burnedText: true }))).toBe(5);
    expect(
      photoScore(
        photo("a", {
          siteQuality: 8,
          warnings: ["Фото трохи розмите — перевірте різкість", "Фото темнувате — при денному світлі буде краще"],
        }),
      ),
    ).toBe(4);
  });

  it("ignores the resolution warning — small is a display problem, not a photo one", () => {
    expect(photoScore(photo("a", { siteQuality: 7, warnings: ["Фото замалої роздільності"] }))).toBe(7);
  });

  it("clamps a score that drifted outside 0…10", () => {
    expect(photoScore(photo("a", { siteQuality: 42 }))).toBe(10);
    expect(photoScore(photo("a", { siteQuality: -7 }))).toBe(0);
    expect(photoScore(photo("a", { siteQuality: Number.NaN }))).toBe(5);
  });

  it("can go negative so the worst photo always loses", () => {
    const junk = photo("a", { siteQuality: 1, burnedText: true, warnings: ["Фото трохи розмите"] });
    expect(photoScore(junk)).toBeLessThan(0);
    expect(comparePhotoQuality(junk, photo("b"))).toBeGreaterThan(0);
  });
});

describe("rankPhotoUrls", () => {
  it("sorts best first and keeps feed order for ties", () => {
    const meta = [
      photo("weak", { siteQuality: 2 }),
      photo("strong", { siteQuality: 9 }),
      photo("tie-a", { siteQuality: 6 }),
      photo("tie-b", { siteQuality: 6 }),
    ];
    expect(rankPhotoUrls(["weak", "strong", "tie-a", "tie-b"], meta)).toEqual([
      "strong",
      "tie-a",
      "tie-b",
      "weak",
    ]);
  });

  it("keeps unrated photos ahead of measurably bad ones", () => {
    const meta = [photo("bad", { siteQuality: 1 })];
    expect(rankPhotoUrls(["bad", "unrated"], meta)).toEqual(["unrated", "bad"]);
  });

  it("leaves a fully unrated set untouched", () => {
    expect(rankPhotoUrls(["a", "b", "c"], [])).toEqual(["a", "b", "c"]);
  });
});

describe("pickHeroUrl", () => {
  it("prefers an explicit hero candidate over a higher raw score", () => {
    const meta = [
      photo("sharp-but-not-a-banner", { siteQuality: 9 }),
      photo("banner", { siteQuality: 7, heroCandidate: true }),
    ];
    expect(pickHeroUrl(["sharp-but-not-a-banner", "banner"], meta)).toBe("banner");
  });

  it("falls back to quality, then to a centered subject", () => {
    const byQuality = [photo("a", { siteQuality: 4 }), photo("b", { siteQuality: 8 })];
    expect(pickHeroUrl(["a", "b"], byQuality)).toBe("b");

    const byFraming = [
      photo("a", { siteQuality: 6, subjectCentered: false }),
      photo("b", { siteQuality: 6, subjectCentered: true }),
    ];
    expect(pickHeroUrl(["a", "b"], byFraming)).toBe("b");
  });

  it("never hands the banner to a burned-text photo when an alternative exists", () => {
    const meta = [photo("meme", { siteQuality: 9, burnedText: true }), photo("plain", { siteQuality: 7 })];
    expect(pickHeroUrl(["meme", "plain"], meta)).toBe("plain");
  });

  it("keeps the first photo on a tie and returns undefined for an empty list", () => {
    expect(pickHeroUrl(["a", "b"], [])).toBe("a");
    expect(pickHeroUrl([], [])).toBeUndefined();
    expect(compareHeroFitness(undefined, undefined)).toBe(0);
  });
});

describe("usability (the AI-image trigger)", () => {
  it("counts unrated photos as usable — a missing signal must not buy AI imagery", () => {
    expect(isUsablePhoto(undefined)).toBe(true);
    expect(isUsablePhoto(photo("a"))).toBe(true);
  });

  it("excludes low scores, info sources, hidden photos and vision rejects", () => {
    expect(isUsablePhoto(photo("a", { siteQuality: 4 }))).toBe(false);
    expect(isUsablePhoto(photo("a", { siteQuality: 9, role: "text_source" }))).toBe(false);
    expect(isUsablePhoto(photo("a", { siteQuality: 9, role: "hidden" }))).toBe(false);
    expect(isUsablePhoto(photo("a", { siteQuality: 9, useOnSite: false }))).toBe(false);
    expect(isUsablePhoto(photo("a", { siteQuality: 5 }))).toBe(true);
  });

  it("counts only the photos the site would actually show", () => {
    const media = {
      photos: ["good", "good2", "blurry", "price-list"],
      photoMeta: [
        photo("good", { siteQuality: 8 }),
        photo("good2", { siteQuality: 6 }),
        photo("blurry", { siteQuality: 2 }),
        photo("price-list", { siteQuality: 9, role: "text_source" as const }),
      ],
    };
    expect(usablePhotoCount(media)).toBe(2);
    expect(usablePhotoCount({ photos: [] })).toBe(0);
  });
});
