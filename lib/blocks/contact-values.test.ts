import { describe, it, expect } from "vitest";
import {
  canonicalizeContactFacts,
  igDirectHref,
  instagramHref,
  mailtoHref,
  normalizeIgHandle,
  normalizeTelegramUsername,
  telegramHref,
  telegramLabel,
  viberHref,
} from "./contact-links";
import { displayFollowers, formatFollowers, stripBareUrls, scrubVisibleUrls } from "./hygiene";
import type { BlockInstance } from "./schema";

/*
 * Contact-value hygiene — regression tests written against the LIVE tenant
 * measured on 2026-08-10 (san-team-tennis, a tennis school in Lviv):
 *
 *   instagram_cta.handle  = "https://www.instagram.com/san.team.tennis"
 *   facts.telegram        = "https://t.me/SanTeamTennis"
 *
 * Both are full URLs sitting in fields that MEAN a handle. Interpolated raw,
 * the first produced the body text «@https://www.instagram.com/san.team.tennis»
 * (451px unbreakable — the only element that made the 390px page scroll
 * sideways) and the href
 * "https://instagram.com/https://www.instagram.com/san.team.tennis" (404).
 * Every literal below is the exact stored value, not a paraphrase of it.
 */

const IG_URL_FACT = "https://www.instagram.com/san.team.tennis";
const TG_URL_FACT = "https://t.me/SanTeamTennis";

describe("normalizeIgHandle — the shapes a handle fact actually arrives in", () => {
  it("unwraps the stored full profile URL", () => {
    expect(normalizeIgHandle(IG_URL_FACT)).toBe("san.team.tennis");
  });

  it("accepts the freeform shapes an owner types", () => {
    expect(normalizeIgHandle("@san.team.tennis")).toBe("san.team.tennis");
    expect(normalizeIgHandle("san.team.tennis")).toBe("san.team.tennis");
    expect(normalizeIgHandle("  instagram.com/san.team.tennis/  ")).toBe("san.team.tennis");
    expect(normalizeIgHandle("https://www.instagram.com/san.team.tennis?igsh=abc")).toBe(
      "san.team.tennis",
    );
  });

  it("is idempotent — normalizing a canonical handle changes nothing", () => {
    const once = normalizeIgHandle(IG_URL_FACT)!;
    expect(normalizeIgHandle(once)).toBe(once);
  });

  it("refuses everything that is not a profile", () => {
    expect(normalizeIgHandle("https://www.instagram.com/p/Cabc123/")).toBeNull();
    expect(normalizeIgHandle("https://www.instagram.com/reel/Cxyz/")).toBeNull();
    expect(normalizeIgHandle(TG_URL_FACT)).toBeNull(); // telegram pasted into the IG field
    expect(normalizeIgHandle("нема")).toBeNull(); // Cyrillic is not a username
    expect(normalizeIgHandle("")).toBeNull();
    expect(normalizeIgHandle(undefined)).toBeNull();
  });
});

describe("instagram hrefs — the label must match the target", () => {
  it("never double-wraps the stored URL", () => {
    expect(instagramHref(IG_URL_FACT)).toBe("https://www.instagram.com/san.team.tennis");
    expect(instagramHref(IG_URL_FACT)).not.toContain("instagram.com/https");
  });

  it("«Написати в Direct» points at Direct, not at the feed", () => {
    expect(igDirectHref(IG_URL_FACT)).toBe("https://ig.me/m/san.team.tennis");
    expect(igDirectHref("@san.team.tennis")).toBe("https://ig.me/m/san.team.tennis");
  });

  it("yields null — not a dead link — when the handle is unusable", () => {
    expect(igDirectHref("https://www.instagram.com/p/Cabc123/")).toBeNull();
    expect(igDirectHref(undefined)).toBeNull();
    expect(instagramHref("")).toBeNull();
  });
});

describe("telegram — the same defect, audited with equal rigour", () => {
  it("unwraps the stored full t.me URL instead of re-wrapping it", () => {
    expect(normalizeTelegramUsername(TG_URL_FACT)).toBe("SanTeamTennis");
    expect(telegramHref(TG_URL_FACT)).toBe("https://t.me/SanTeamTennis");
    expect(telegramHref(TG_URL_FACT)).not.toContain("t.me/https");
    expect(telegramLabel(TG_URL_FACT)).toBe("@SanTeamTennis");
  });

  it("keeps a phone deep link and an invite link as themselves", () => {
    expect(telegramHref("+38 (067) 123-45-67")).toBe("https://t.me/+380671234567");
    expect(telegramHref("https://t.me/+AbC-123_x")).toBe("https://t.me/+AbC-123_x");
    expect(normalizeTelegramUsername("+380671234567")).toBeNull(); // a number is not a username
  });

  it("refuses a foreign URL rather than turning it into a t.me path", () => {
    expect(telegramHref(IG_URL_FACT)).toBeNull();
    expect(telegramLabel(IG_URL_FACT)).toBeNull();
  });
});

describe("canonicalizeContactFacts — store the identity, not the address", () => {
  it("rewrites both live values to their canonical form", () => {
    expect(canonicalizeContactFacts({ instagram: IG_URL_FACT, telegram: TG_URL_FACT })).toEqual({
      instagram: "san.team.tennis",
      telegram: "SanTeamTennis",
    });
  });

  it("leaves an unnormalizable value byte-identical — nothing the owner said is lost", () => {
    const facts = { instagram: "пишіть у дірект", telegram: "+380671234567" };
    expect(canonicalizeContactFacts(facts)).toEqual(facts);
  });

  it("does not invent absent fields", () => {
    expect(canonicalizeContactFacts({})).toEqual({});
  });

  it("is idempotent", () => {
    const once = canonicalizeContactFacts({ instagram: IG_URL_FACT, telegram: TG_URL_FACT });
    expect(canonicalizeContactFacts(once)).toEqual(once);
  });
});

describe("mailtoHref — the owner's text is the label, the address is the href", () => {
  it("extracts the address out of freeform text", () => {
    expect(mailtoHref("hello@example.com")).toBe("mailto:hello@example.com");
    expect(mailtoHref("  hello@example.com  ")).toBe("mailto:hello@example.com");
    expect(mailtoHref("пошта: hello@example.com")).toBe("mailto:hello@example.com");
  });

  it("returns null rather than a dead mailto", () => {
    expect(mailtoHref("напишіть нам")).toBeNull();
    expect(mailtoHref("")).toBeNull();
    expect(mailtoHref(undefined)).toBeNull();
  });
});

describe("viber — verified safe, kept under test", () => {
  it("normalizes any punctuation to one deep link", () => {
    expect(viberHref("+38 (067) 123-45-67")).toBe("viber://chat?number=%2B380671234567");
    expect(viberHref("0671234567")).toBe("viber://chat?number=%2B380671234567");
    expect(viberHref("не маю")).toBeNull();
  });
});

/*
 * The renderer contract, asserted on the DATA the renderer branches on rather
 * than through a DOM (vitest here is node-only by design). WireInstagramCta
 * returns null exactly when igDirectHref(normalizeIgHandle(handle)) is null.
 */
describe("unresolvable handle → no Instagram section at all", () => {
  const renders = (handle: string) => igDirectHref(normalizeIgHandle(handle)) !== null;

  it("renders for every resolvable shape, including the broken stored one", () => {
    expect(renders(IG_URL_FACT)).toBe(true);
    expect(renders("@san.team.tennis")).toBe(true);
    expect(renders("san.team.tennis")).toBe(true);
  });

  it("drops the section rather than shipping a broken Direct button", () => {
    expect(renders("https://www.instagram.com/p/Cabc123/")).toBe(false);
    expect(renders(TG_URL_FACT)).toBe(false);
    expect(renders("—")).toBe(false);
    expect(renders(" ")).toBe(false);
  });
});

describe("follower count — social proof or nothing", () => {
  it("hides a count that argues against clicking", () => {
    expect(displayFollowers(0)).toBeNull();
    expect(displayFollowers(12)).toBeNull();
    expect(displayFollowers(299)).toBeNull();
    expect(displayFollowers(undefined)).toBeNull();
    expect(displayFollowers(Number.NaN)).toBeNull();
  });

  it("shows it from the floor up", () => {
    expect(displayFollowers(300)).toBe("300 підписників");
    expect(displayFollowers(1234)).toBe("1\u00A0234 підписники");
  });

  it("gets the Ukrainian plurals right — 21/22 were the wrong ones", () => {
    expect(formatFollowers(1)).toBe("1 підписник");
    expect(formatFollowers(2)).toBe("2 підписники");
    expect(formatFollowers(5)).toBe("5 підписників");
    expect(formatFollowers(11)).toBe("11 підписників");
    expect(formatFollowers(14)).toBe("14 підписників");
    expect(formatFollowers(21)).toBe("21 підписник");
    expect(formatFollowers(22)).toBe("22 підписники");
    expect(formatFollowers(24)).toBe("24 підписники");
    expect(formatFollowers(25)).toBe("25 підписників");
    expect(formatFollowers(111)).toBe("111 підписників");
    expect(formatFollowers(1002)).toBe("1\u00A0002 підписники");
  });

  it("groups thousands with a NO-BREAK space so the number cannot split", () => {
    expect(formatFollowers(12400)).toBe("12\u00A0400 підписників");
    expect(formatFollowers(12400)).not.toContain(" 400"); // an ordinary space would break
  });
});

describe("stripBareUrls — no visible string on a generated site is a URL", () => {
  it("removes the shapes a model actually writes", () => {
    expect(stripBareUrls(`Пишіть нам: ${IG_URL_FACT}`)).toBe("Пишіть нам");
    expect(stripBareUrls("Ми тут — instagram.com/san.team.tennis")).toBe("Ми тут");
    expect(stripBareUrls(`Telegram ${TG_URL_FACT} завжди на зв'язку`)).toBe(
      "Telegram завжди на зв'язку",
    );
    expect(stripBareUrls("Деталі на www.example.com.ua/prices")).toBe("Деталі на");
  });

  it("leaves ordinary Ukrainian copy alone, byte for byte", () => {
    const copy = "Тренування з 10.00 до 21.00, вул. Січових Стрільців, 12. Ціна — 500 грн.";
    expect(stripBareUrls(copy)).toBe(copy);
    expect(stripBareUrls("Гуртові ціни: 1 500–2 000 грн")).toBe("Гуртові ціни: 1 500–2 000 грн");
  });

  it("does not eat a bare brand name that merely looks like a domain", () => {
    // No path ⇒ a name, not a link. «Auto.ua» is how the business is called.
    expect(stripBareUrls("Партнер Auto.ua від 2019 року")).toBe("Партнер Auto.ua від 2019 року");
  });

  it("keeps a string that is nothing but a link, so a required prop is never emptied", () => {
    expect(stripBareUrls(IG_URL_FACT)).toBe("");
  });
});

describe("scrubVisibleUrls — applied to a whole block", () => {
  it("cleans prose but never an image or an identity field", () => {
    const block = {
      type: "hero",
      props: {
        title: "Школа тенісу",
        subtitle: `Записуйтесь у Direct: ${IG_URL_FACT}`,
        imageUrl: "https://xyz.supabase.co/storage/v1/object/public/photos/t/hero.jpg",
        imageAlt: "Корт",
      },
    } as unknown as BlockInstance;

    const out = scrubVisibleUrls(block) as unknown as {
      props: { subtitle: string; imageUrl: string; title: string };
    };
    expect(out.props.subtitle).toBe("Записуйтесь у Direct");
    // Invariant 1: a storage URL is data, not copy — mangling it deletes a photo.
    expect(out.props.imageUrl).toBe(
      "https://xyz.supabase.co/storage/v1/object/public/photos/t/hero.jpg",
    );
    expect(out.props.title).toBe("Школа тенісу");
  });

  it("reaches nested item text and leaves the identity props to contact-links", () => {
    const block = {
      type: "contacts",
      props: {
        title: "Контакти",
        phone: "+380671234567",
        instagram: IG_URL_FACT,
        telegram: TG_URL_FACT,
      },
    } as unknown as BlockInstance;

    const out = scrubVisibleUrls(block) as unknown as {
      props: { instagram: string; telegram: string; phone: string };
    };
    // Untouched here on purpose: canonicalization is groundAndPlace's job, and a
    // half-stripped handle would be worse than the URL.
    expect(out.props.instagram).toBe(IG_URL_FACT);
    expect(out.props.telegram).toBe(TG_URL_FACT);
    expect(out.props.phone).toBe("+380671234567");
  });

  it("walks arrays of items", () => {
    const block = {
      type: "services",
      props: {
        title: "Послуги",
        items: [
          { name: "Групові тренування", description: `Розклад тут ${IG_URL_FACT}` },
          { name: "Індивідуальні", description: "60 хвилин на корті" },
        ],
      },
    } as unknown as BlockInstance;

    const out = scrubVisibleUrls(block) as unknown as {
      props: { items: { description: string }[] };
    };
    expect(out.props.items[0].description).toBe("Розклад тут");
    expect(out.props.items[1].description).toBe("60 хвилин на корті");
  });
});
