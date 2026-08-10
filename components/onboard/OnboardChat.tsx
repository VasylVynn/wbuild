"use client";

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Paperclip,
  PartyPopper,
  Pencil,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSmoothText } from "@/components/useSmoothText";
import type { ChatMsg } from "@/lib/ai/onboard";
import { hasContactChannel } from "@/lib/onboard/contact-channel";
// Client-safe (dependency-free module): the honest claimed-by-other copy, used
// to detect the refusal and offer «Почати нову розмову» instead of a retry.
import { CLAIMED_BY_OTHER_ERROR } from "@/lib/onboard/claim-gate";
import {
  onboardAction,
  generateDraftAction,
  finalizeAction,
  sessionStateAction,
} from "@/app/app/new/actions";
// Type-only: erased at build time, so the module's `server-only` guard never
// enters the client bundle.
import type { GenerateDraftResult } from "@/lib/onboard/generate-flow";
import {
  analyzePhotoAction,
  type AnalyzePhotoResult,
} from "@/app/app/new/photo-actions";
import {
  startConversation,
  saveTurn,
  loadConversation,
} from "@/app/app/new/persist-actions";
import type { BusinessFacts } from "@/lib/verticals/schema";
import { MAX_PHOTOS, type SiteMedia, type PhotoMeta } from "@/lib/media/media";
import { processImage } from "@/lib/media/client-image";
import { Button, Card, ConfirmDialog } from "@/components/ui";
import { appUrl, AUTH_RESUME_KEY, shouldRestoreConversation } from "@/components/onboard/embed-helpers";
import { GoogleIcon } from "@/components/auth/AuthShell";
import SitePreviewPanel from "@/components/onboard/SitePreviewPanel";
import DomainStep from "@/components/onboard/DomainStep";
import { getTelegramConnectLinkForHost } from "@/app/app/(protected)/(shell)/sites/actions";
import { pixelTrack } from "@/lib/analytics/pixel";
import { phCapture } from "@/components/analytics/PostHogProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "chat" | "gate" | "generating" | "preview" | "done" | "error";

// Generate-first greetings (W0, plan §0): no questionnaire — the agent infers
// what it can and asks at most 1–2 things itself. Genderless, ≤1 emoji (C4/C5).
// The last sentence honestly announces the auth gate (M9) — registration must
// never be a surprise at the end of the conversation.
const GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Вітаю! 👋 Створю сайт для вашого бізнесу прямо в цій розмові. Розкажіть, що у вас за бізнес — для початку досить назви. У кінці попрошу пошту, щоб сайт лишився вашим.",
};

// Instagram-first greeting (wave E) — shown only when the Apify scrape is
// configured server-side (igImportEnabled prop), so the promise is never empty.
// A pasted IG link is now a normal message: the agent calls scrape_instagram itself.
const IG_GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Вітаю! 👋 Створю сайт для вашого бізнесу прямо в цій розмові. Надішліть посилання на Instagram-сторінку — і я витягну все звідти. Або просто розкажіть, що у вас за бізнес. У кінці попрошу пошту, щоб сайт лишився вашим.",
};

// The questionnaire progress chips are GONE (W0, plan §0.5) — the agent-status
// tool card is the visible-work signal. This tiny label model survives only to
// feed the «✓ Записано: …» diff note (an honest per-turn diff, not a checklist).
// «Контакт» counts ANY channel (C3/C7): phone / telegram / instagram / viber.
const FACT_NOTES: { label: string; has: (f: Partial<BusinessFacts>) => boolean }[] = [
  { label: "Бізнес", has: (f) => Boolean(f.businessName?.trim()) },
  { label: "Місто", has: (f) => Boolean(f.city?.trim()) },
  { label: "Контакт", has: hasContactChannel },
  { label: "Адреса", has: (f) => Boolean(f.address?.trim()) },
  { label: "Години", has: (f) => Boolean(f.hours?.trim()) },
];
function doneLabels(facts: Partial<BusinessFacts>): string[] {
  return FACT_NOTES.filter((n) => n.has(facts)).map((n) => n.label);
}

// Lowercase the first character so a vision `reason` reads naturally after a
// colon («…не ставив: занадто темне фото»).
function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

// Photo metadata (kind + alt from the vision layer) is keyed by storage URL.
// Replace an entry with the same url, else append.
function upsertMeta(list: PhotoMeta[] | undefined, entry: PhotoMeta): PhotoMeta[] {
  const existing = list ?? [];
  const i = existing.findIndex((m) => m.url === entry.url);
  return i === -1
    ? [...existing, entry]
    : existing.map((m, idx) => (idx === i ? entry : m));
}

// Keep meta whose url is still live (a photo or the logo), PLUS text_source /
// hidden entries: those legitimately reference non-gallery photos (they feed the
// dossier, refactor §1.3/§2.1). Undefined when nothing remains.
function pruneMeta(media: SiteMedia): PhotoMeta[] | undefined {
  if (!media.photoMeta?.length) return undefined;
  const live = new Set(media.photos);
  if (media.logoUrl) live.add(media.logoUrl);
  const kept = media.photoMeta.filter(
    (m) => live.has(m.url) || m.role === "text_source" || m.role === "hidden",
  );
  return kept.length ? kept : undefined;
}

// One processed batch item: upload/analysis outcome for a single sent file.
// `uploadPalette` is the upload route's deterministic palette of the stored
// bytes (§3-S0) — the fallback when the vision analysis (which carries its own
// `palette`) is unavailable, so owner uploads still ground the S0 color axis.
type BatchItem =
  | { failed: true }
  | {
      failed: false;
      url: string;
      analysis: AnalyzePhotoResult;
      warnings: string[];
      uploadPalette?: string[];
    };

// Ukrainian plural for «відгук» (2–4 відгуки, 5+ відгуків; a batch caps at 8).
function reviewsWord(n: number): string {
  return n < 5 ? "відгуки" : "відгуків";
}

/**
 * Human copy for a THROWN server-action call (network layer, not our
 * {ok:false} contract). Distinct causes get distinct advice:
 *  - a dropped connection («failed to fetch»/«load failed») — offline or
 *    flaky mobile network: refreshing is pointless, retrying is the fix;
 *  - «unexpected response» — the server answered, but not with our action
 *    result. In the wild this is EITHER deployment skew (stale tab, action id
 *    404) or a gateway timeout (504, live 2026-08-06) — the client cannot
 *    tell them apart, so the copy promises only what is true for both:
 *    refresh is safe (conv id lives in localStorage) and then try again.
 */
function actionErrorMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : "";
  if (/failed to fetch|load failed|network/i.test(m)) {
    return "Схоже, зник інтернет. Перевірте з'єднання і натисніть кнопку ще раз.";
  }
  if (/server action|unexpected response/i.test(m)) {
    return "З'єднання із сервером перервалося. Оновіть сторінку (Ctrl+R або ⌘R) — розмова збережеться — і спробуйте ще раз.";
  }
  return m || "Невідома помилка";
}

// M12: the recap shown when a handed-off conversation resumes WITHOUT the
// same-tab OAuth flag (email-confirmation branch, password sign-in, a later
// bearer-link visit). Honest and short (C5): what is saved + what to do next —
// generation never auto-starts here (no silent token burn from an email link).
function resumeRecap(
  facts: Partial<BusinessFacts>,
  photosCount: number,
  confirmed: boolean,
): string {
  const name = facts.businessName?.trim();
  const city = facts.city?.trim();
  const parts = [
    name && `«${name}»`,
    city && city,
    photosCount > 0 && `${photosCount} фото`,
  ].filter(Boolean);
  const saved = parts.length
    ? `Усе збережено: ${parts.join(", ")}.`
    : "Розмова збережена.";
  const action = confirmed
    ? "Тисніть «Створити сайт» нижче — і я зберу чернетку."
    : "Продовжимо з того самого місця.";
  return `З поверненням! ${saved} ${action}`;
}

// Client-side id for pending attachments. NOT crypto.randomUUID — that's
// undefined outside secure contexts (http://app.lvh.me dev host).
let nextAttachId = 0;
function attachId(): string {
  nextAttachId += 1;
  return `att-${nextAttachId}`;
}

// Fold a processed batch into ONE media diff + ONE aggregated assistant
// summary (approved design: variant A). Pure — threads its own accumulator
// instead of re-reading React state (state updates are async; per-photo reads
// would lose prior steps of the same batch: the MAX_PHOTOS cap and
// last-logo-wins both depend on the running result).
function routeBatch(
  before: SiteMedia,
  items: BatchItem[],
): { media: SiteMedia; summary: string; reviews: { quote: string; author: string }[] } {
  let m: SiteMedia = { ...before, photos: [...before.photos] };
  const hadLogoBefore = Boolean(before.logoUrl);
  let logoSet = 0;
  let added = 0;
  let failed = 0;
  let overflow = 0;
  let unreadable = 0;
  const rejected: string[] = [];
  const reviews: { quote: string; author: string }[] = [];
  let firstWarning: string | null = null;

  for (const item of items) {
    if (item.failed) {
      failed += 1;
      continue;
    }
    const { url, analysis: result, warnings, uploadPalette } = item;

    // Fail-open (G5): no verdict → plain gallery photo, no meta.
    if (!result.ok) {
      if (m.photos.length >= MAX_PHOTOS) overflow += 1;
      else {
        m = { ...m, photos: [...m.photos, url] };
        added += 1;
      }
      continue;
    }
    const a = result.analysis;

    // Unsuitable or off-topic → nothing saved, reason lands in the summary.
    if (a.suitable === false || a.kind === "irrelevant") {
      rejected.push(lowerFirst(a.reason));
      continue;
    }

    if (a.kind === "logo") {
      // Palette threads into the meta (§3-S0): without it every owner-upload
      // site fails the aggregate's `palette?.length` gate and S0 grounding
      // degrades to the vertical hue window. The logo matters most — it rides
      // LOGO_WEIGHT and bypasses the quality gates. Analysis palette first,
      // upload-route palette as the fallback.
      const palette = a.palette?.length ? a.palette : uploadPalette;
      m = {
        ...m,
        logoUrl: url,
        photoMeta: upsertMeta(m.photoMeta, {
          url,
          kind: "logo",
          ...(a.alt && { alt: a.alt }),
          ...(palette?.length && { palette }),
        }),
      };
      logoSet += 1;
      continue;
    }

    if (a.kind === "review") {
      // OCR'd text is a CANDIDATE — the owner must confirm before it's a fact
      // (invariant №5). The prefilled author is exactly what will be saved.
      if (!a.reviewQuote) unreadable += 1;
      else reviews.push({ quote: a.reviewQuote, author: a.reviewAuthor ?? "Клієнт" });
      continue;
    }

    // work / interior / menu / person → gallery photo with class + honest alt.
    if (m.photos.length >= MAX_PHOTOS) overflow += 1;
    else {
      const palette = a.palette?.length ? a.palette : uploadPalette;
      m = {
        ...m,
        photos: [...m.photos, url],
        photoMeta: upsertMeta(m.photoMeta, {
          url,
          kind: a.kind,
          ...(a.alt && { alt: a.alt }),
          ...(palette?.length && { palette }),
        }),
      };
      added += 1;
      if (!firstWarning && warnings.length) firstWarning = warnings[0];
    }
  }

  const lines: string[] = [];
  if (logoSet > 0) {
    lines.push(
      hadLogoBefore || logoSet > 1
        ? "Бачу лого — поставив його в шапку сайту, попереднє замінив. 👌"
        : "Бачу лого — поставив його в шапку сайту. 👌",
    );
  }
  if (added > 0) {
    lines.push(
      added === 1
        ? `Гарне фото — додав у галерею (${m.photos.length} з ${MAX_PHOTOS}).`
        : `Додав ${added} фото в галерею (${m.photos.length} з ${MAX_PHOTOS}).`,
    );
    if (firstWarning) lines.push(firstWarning);
  }
  if (reviews.length > 0) {
    lines.push(
      reviews.length === 1
        ? "Знайшов відгук на скріншоті — підтвердіть його нижче."
        : `Знайшов ${reviews.length} ${reviewsWord(reviews.length)} на скріншотах — підтвердіть їх нижче, по одному.`,
    );
  }
  if (unreadable > 0) {
    lines.push(
      "Один зі скріншотів схожий на відгук, але текст не вдалося прочитати — можете написати його текстом, я збережу.",
    );
  }
  if (rejected.length === 1) lines.push(`Одне фото я б на сайт не ставив: ${rejected[0]}`);
  else if (rejected.length > 1) lines.push(`Кілька фото я б на сайт не ставив: ${rejected.join(" ")}`);
  if (overflow > 0) {
    lines.push(
      `Ще ${overflow} не додав — у галереї вже максимум (${MAX_PHOTOS} фото). Замінити можна в редакторі.`,
    );
  }
  if (failed > 0) {
    lines.push(
      failed === 1
        ? "Одне фото не вдалося завантажити — спробуйте надіслати його ще раз."
        : `${failed} фото не вдалося завантажити — спробуйте надіслати їх ще раз.`,
    );
  }

  return {
    media: m,
    summary: lines.length ? lines.join("\n") : "Не вдалося обробити фото — спробуйте ще раз.",
    reviews,
  };
}

// Generation progress cards (V4, spec §7 / plan C6): driven by the REAL stage
// stream from /api/generate. Each card resolves with what actually happened —
// photo-palette count (s0), the chosen font pair / accent / motion (s1), the
// two parallel S2 legs (texts ∥ styling) each settling on its own, and the
// section count at compile (s3). The paced clock below survives as a FLOOR:
// on the fallback transport (generateDraftAction has no stage signal) and in
// the seconds before the first event, cards still advance — but a clock-driven
// resolve never claims DATA (no counts, no font names), only the base label.
const GEN_MESSAGES = [
  // «до 5 хвилин» = the actual server budget (maxDuration 300 on /new) — a
  // promise shorter than the timeout reads as a hang exactly when generation
  // is slowest and the user is most nervous.
  "Зазвичай це до 3 хвилин, максимум 5 — нікуди не йдіть, ми вже працюємо.",
  "Пишемо тексти й підбираємо кольори під ваш бізнес.",
  "Ще трохи — готуємо фото та збираємо сторінку.",
  "Майже готово — фінальні перевірки перед показом.",
];

// Clock-floor activation seconds per card row (s0 / s1 / s2 legs / s3), tuned
// to the measured live timings (S1 ~30s, S2 ~110s, TFAO ~145s). The clock can
// only raise a row to active/checked when the stream is silent; the max-of-two
// rule (clock vs real) is the W1/V2 anti-freeze behavior, kept as-is. The
// 35s→140s gap is the S2 band — genCards interpolates the BAR width inside it
// (sub-tick pacing), so the sparse ticks never read as a freeze.
const GEN_CARD_CLOCK = [0, 8, 35, 140];

type GenCardStatus = "pending" | "active" | "done" | "error";
type GenQaStatus = "running" | "done" | "skipped" | "error";

/** Raw per-stage data accumulated from {t:"stage"} SSE events. Empty on the
 *  fallback transport — then the paced clock alone drives the cards. */
interface GenStageData {
  s0?: { status: string; photosUsed?: number; photosTotal?: number };
  s1?: {
    status: string;
    briefed?: boolean;
    fontPairLabel?: string;
    accent?: string;
    motionLevel?: number;
  };
  s2?: {
    status: string;
    content?: "done" | "error";
    style?: "done" | "error";
    styleFallback?: "previous" | "default";
  };
  s3?: { status: string; sections?: number };
}

/** Fold one stage event into the accumulated card data (pure, testable). */
function mergeStageEvent(
  prev: GenStageData,
  name: string,
  status: string,
  detail: Record<string, unknown>,
): GenStageData {
  const next: GenStageData = { ...prev };
  if (name === "s0_grounding") {
    next.s0 = {
      status,
      // photosUsed is the honest PHOTO basis of the palette; the event's
      // paletteCandidates counts aggregated colours and is ignored here.
      ...(typeof detail.photosUsed === "number" && { photosUsed: detail.photosUsed }),
      ...(typeof detail.photosTotal === "number" && { photosTotal: detail.photosTotal }),
    };
  } else if (name === "s1_brief") {
    next.s1 = {
      status,
      ...(typeof detail.briefed === "boolean" && { briefed: detail.briefed }),
      ...(typeof detail.fontPairLabel === "string" && { fontPairLabel: detail.fontPairLabel }),
      ...(typeof detail.accent === "string" && { accent: detail.accent }),
      ...(typeof detail.motionLevel === "number" && { motionLevel: detail.motionLevel }),
    };
  } else if (name === "s2_generate") {
    const s2 = { ...(prev.s2 ?? { status: "start" }) };
    const leg = detail.leg;
    if (leg === "content" || leg === "style") {
      // Mid-stage leg settle: {leg, status} — the stage itself is still on.
      const legStatus = detail.status === "error" ? ("error" as const) : ("done" as const);
      if (leg === "content") s2.content = legStatus;
      else s2.style = legStatus;
      if (detail.fallback === "previous" || detail.fallback === "default") {
        s2.styleFallback = detail.fallback;
      }
    } else {
      s2.status = status;
      if (status === "done") {
        // The stage summary backfills a leg whose own event was lost.
        s2.content = s2.content ?? "done";
        s2.style = s2.style ?? (detail.styled === false ? "error" : "done");
        if (
          s2.styleFallback === undefined &&
          (detail.styleFallback === "previous" || detail.styleFallback === "default")
        ) {
          s2.styleFallback = detail.styleFallback;
        }
      }
    }
    next.s2 = s2;
  } else if (name === "s3_compile") {
    next.s3 = {
      status,
      ...(typeof detail.sections === "number" && { sections: detail.sections }),
    };
  }
  return next;
}

/** «7 секцій» declension for the s3 card. */
function sectionsWord(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return "секція";
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return "секції";
  return "секцій";
}

// Human colour name for the S1 accent hex — the card says «золотистий
// акцент», never «#c8a24b». Unparseable / missing hex → the honest generic.
function accentLabel(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "тепла палітра";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d < 0.08) return "нейтральний акцент";
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const name =
    h < 15 ? "червоний" :
    h < 45 ? "теракотовий" :
    h < 70 ? "золотистий" :
    h < 160 ? "зелений" :
    h < 200 ? "бірюзовий" :
    h < 255 ? "синій" :
    h < 290 ? "фіолетовий" :
    h < 335 ? "рожевий" : "червоний";
  return `${name} акцент`;
}

interface GenCard {
  key: string;
  status: GenCardStatus;
  label: string;
  /** True for the two parallel S2 legs — rendered slightly indented. */
  leg?: boolean;
}

// Shared card-model math for BOTH generation renders (full-screen phase and
// the inline chat card): row list, rotating sub-message, bar width. Real data
// resolves each card's text honestly; the clock only moves row STATES.
function genCards(
  elapsed: number,
  st: GenStageData,
): { cards: GenCard[]; msgIndex: number; barPct: number } {
  // Real progression index: last reached stage (+1 once it's done); 4 = the
  // preview point (s3 done). Null before the first event / on the fallback.
  let real: number | null = null;
  ([st.s0, st.s1, st.s2, st.s3] as const).forEach((slot, i) => {
    if (slot) real = slot.status === "done" ? i + 1 : i;
  });
  const clock = GEN_CARD_CLOCK.reduce((acc, at, i) => (elapsed >= at ? i : acc), 0);
  const eff = real === null ? clock : Math.max(real, clock);

  const stageState = (i: number, slot?: { status: string }): GenCardStatus =>
    slot?.status === "error" ? "error" : eff > i ? "done" : eff === i ? "active" : "pending";

  // s0 — photos → palette. Data line only from a REAL done event. Zero is two
  // different truths: no photos at all vs photos that yielded no palette
  // (filtered out, S0 abort, fail-open catch) — never blame «нема фото» at an
  // owner who just uploaded eight.
  const s0State = stageState(0, st.s0);
  const s0Label =
    st.s0?.status === "done" && typeof st.s0.photosUsed === "number"
      ? st.s0.photosUsed > 0
        ? `Взяв палітру з ${st.s0.photosUsed} фото`
        : (st.s0.photosTotal ?? 0) > 0
          ? "З фото палітру не взяв — беру кольори ніші"
          : "Фото нема — беру кольори ніші"
      : "Дивлюсь ваші фото";

  // s1 — design brief. Honest fallback line when the brief didn't happen.
  const s1State = stageState(1, st.s1);
  let s1Label = "Придумую дизайн";
  if (st.s1?.status === "done") {
    if (st.s1.briefed) {
      const picks = [
        st.s1.fontPairLabel,
        accentLabel(st.s1.accent),
        typeof st.s1.motionLevel === "number" ? `рух ${st.s1.motionLevel}/3` : null,
      ].filter(Boolean);
      s1Label = `Обрав: ${picks.join(", ")}`;
    } else {
      s1Label = "Дизайн за замовчуванням";
    }
  }

  // s2 — two parallel legs, each resolving on its own signal; with no signal
  // they follow the clock like any row (checked without claiming specifics).
  const legState = (leg?: "done" | "error"): GenCardStatus =>
    leg === "error" ? "error" : leg === "done" ? "done" : eff > 2 ? "done" : eff === 2 ? "active" : "pending";
  const contentState = legState(st.s2?.content);
  const styleState = legState(st.s2?.style);
  const contentLabel =
    contentState === "error"
      ? "Тексти не вдалися"
      : st.s2?.content === "done"
        ? "Тексти готові"
        : "Пишу тексти";
  const styleLabel =
    styleState === "error"
      ? st.s2?.styleFallback === "previous"
        ? "Оформлення не вдалося — лишив попереднє"
        : "Оформлення не вдалося — взяв стандартне"
      : st.s2?.style === "done"
        ? "Оформлення готове"
        : "Малюю оформлення";

  // s3 — compile; the real done event carries the section count.
  const s3State = stageState(3, st.s3);
  const s3Label =
    st.s3?.status === "done" && typeof st.s3.sections === "number"
      ? `Зібрав сторінку — ${st.s3.sections} ${sectionsWord(st.s3.sections)}`
      : "Збираю сторінку";

  const msgIndex = Math.min(GEN_MESSAGES.length - 1, Math.floor(elapsed / 40));
  // Continuous bar (review must-fix): a step-only width froze at 52.5% for the
  // whole 35s→140s S2 band — the bulk of the wait. The width now interpolates
  // with `elapsed` INSIDE the current clock band, capped just below the next
  // step, so the bar keeps creeping on both transports. The max-of-clock-vs-
  // real rule (eff) and the 90% ceiling are unchanged.
  const bandStart = GEN_CARD_CLOCK[Math.min(eff, GEN_CARD_CLOCK.length - 1)];
  const bandEnd = eff + 1 < GEN_CARD_CLOCK.length ? GEN_CARD_CLOCK[eff + 1] : undefined;
  const bandFrac =
    bandEnd === undefined || bandEnd <= bandStart
      ? 0
      : Math.min(0.95, Math.max(0, (elapsed - bandStart) / (bandEnd - bandStart)));
  const barPct = 15 + ((Math.min(eff, 4) + bandFrac) / 4) * 75; // 15% → 90%, never 100%
  return {
    cards: [
      { key: "s0", status: s0State, label: s0Label },
      { key: "s1", status: s1State, label: s1Label },
      { key: "s2c", status: contentState, label: contentLabel, leg: true },
      { key: "s2s", status: styleState, label: styleLabel, leg: true },
      { key: "s3", status: s3State, label: s3Label },
    ],
    msgIndex,
    barPct,
  };
}

// Design animations (design/D). Kept in-file so this component owns everything;
// prefixed `ob-` to avoid colliding with any global keyframes.
const KEYFRAMES = `
@keyframes ob-typing { 0%,60%,100% { transform: translateY(0); opacity: .5 } 30% { transform: translateY(-4px); opacity: 1 } }
@keyframes ob-pulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(233,162,59,.28) } 50% { transform: scale(1.06); box-shadow: 0 0 0 12px rgba(233,162,59,0) } }
@keyframes ob-shimmer { 0% { transform: translateX(-120%) } 100% { transform: translateX(220%) } }
@keyframes ob-confetti { 0% { transform: translateY(-24px) rotate(0deg); opacity: 1 } 100% { transform: translateY(240px) rotate(260deg); opacity: 0 } }
`;

const SendArrow = ({ className = "" }: { className?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M4 12h14M13 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TelegramMark = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="12" fill="#229ED9" />
    <path
      d="M5.5 11.7l11.3-4.4c.5-.2 1 .1.8.9l-1.9 9c-.1.6-.5.8-1 .5l-2.9-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3 5.4-4.9c.2-.2 0-.3-.3-.1l-6.7 4.2-2.9-.9c-.6-.2-.6-.6 0-.8z"
      fill="#FFFFFF"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Embedded-mode contract (W1, landing-chat-first plan §3.1/M10):
 * - `embedded` (default false): renders a compact, height-bounded chat CARD
 *   (for the landing hero) instead of the full-viewport page. The first
 *   composer focus or the first send expands the card into a fullscreen
 *   same-origin OVERLAY — position:fixed, dvh-based, body scroll locked, no
 *   navigation (navigation would drop the localStorage conversation state).
 *   The close (✕) button collapses back to the card with all state intact.
 *   Non-chat phases (gate / generating / preview / done / error) always render
 *   inside the overlay; the side live-preview panel is full-page mode only.
 * - `source`: chat_start funnel segmentation (plan §3.4) — defaults to
 *   "landing" when embedded, "new-page" otherwise.
 * Full-page mode keeps its exact W0/V2 rendering; cross-host links are
 * absolute app-host URLs (M3) — one code path, correct on both hosts.
 */
export function OnboardChat({
  igImportEnabled = false,
  embedded = false,
  source,
}: {
  igImportEnabled?: boolean;
  embedded?: boolean;
  source?: "landing" | "new-page";
}) {
  // --- Chat phase state ---
  const [messages, setMessages] = useState<ChatMsg[]>([igImportEnabled ? IG_GREETING : GREETING]);
  const [facts, setFacts] = useState<Partial<BusinessFacts>>({});
  const [ready, setReady] = useState(false);
  // A6: the user explicitly confirmed the chat summary — unlocks the create CTA.
  const [confirmed, setConfirmed] = useState(false);
  const [verticalId, setVerticalId] = useState<string | undefined>(undefined);
  // Chat-picked site design (wave B5) — { id, label } once the agent proposes one.
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>(
    igImportEnabled ? ["У мене є Instagram"] : [],
  );
  // «✓ Записав: …» під останньою відповіддю — реальний diff прогресу за хід.
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // --- Shared loading flag (blocks all inputs while a request is in flight) ---
  const [loading, setLoading] = useState(false);

  // --- Phase ---
  const [phase, setPhase] = useState<Phase>("chat");
  // Generation clock (seconds since generation started) — paces the step
  // list / progress bar / sub-message; see the effect below. Shared by the
  // full-screen "generating" phase and the inline chat card.
  const [genElapsed, setGenElapsed] = useState(0);
  // W0 (plan C2/C6): generation triggered by the agent's start_generation
  // signal runs INLINE — phase stays "chat" and a compact progress card sits
  // in the message column instead of the full-screen takeover.
  const [inlineGen, setInlineGen] = useState(false);
  // Generation ARMED but not yet visible: handleCreateSite first awaits the
  // session check, and only then does inlineGen / phase flip. Without this flag
  // the «Створити сайт» CTA stayed live through that window and invited a
  // second run. Set at the entry of every create/generate path, cleared on
  // every exit; `generating` (below the render helpers) is the single flag the
  // chat footer reads.
  const [genPending, setGenPending] = useState(false);
  // Real stage data from the /api/generate SSE stream (V4, spec §7) — the
  // progress cards resolve from THIS; empty on the fallback (non-stream) path
  // and before the first stage event, where the paced clock drives the cards.
  const [genStages, setGenStages] = useState<GenStageData>({});
  // S4 QA tail (V4): runs AFTER the preview is shown — surfaced as a subtle
  // inline note in the chat column, never a blocking screen.
  const [genQa, setGenQa] = useState<GenQaStatus | null>(null);
  // Monotone run id: the detached QA tail of an OLD stream keeps draining
  // after settle and must never write into a NEWER generation's note.
  const genRunRef = useRef(0);
  // Set when the stream delivers {t:"generate"} (or final carries
  // generate:true). An EFFECT consumes it: by then React has flushed the
  // facts/media applyResult just set, so runGenerate reads fresh state — a
  // direct call from send()'s closure would generate from the pre-turn facts.
  const [autoGenerate, setAutoGenerate] = useState(false);
  // Embedded overlay (M10): false = collapsed hero card. Expanded by the first
  // composer focus / first send, forced open while a non-chat phase needs the
  // overlay, collapsed only by the explicit ✕. The ref mirror lets the
  // post-turn auto-refocus check "is the overlay still open?" without stale
  // closures — a programmatic focus must never re-open a just-closed overlay.
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  // --- Media (logo + photos) — optional step before generation ---
  const [media, setMedia] = useState<SiteMedia>({ photos: [] });

  // --- Chat photo attachments (wave G, attach-then-send) ---
  // Files attached to the composer but not yet sent — local only (object
  // URLs); nothing hits the server until the owner presses send.
  const [pending, setPending] = useState<{ id: string; file: File; thumbUrl: string }[]>([]);
  // Transient progress card at the end of the message list while a sent batch
  // uploads/analyzes — NOT part of `messages`, so it never persists.
  const [batchCard, setBatchCard] = useState<{ thumbs: string[]; done: number; total: number } | null>(null);
  // Inline, transient error/hint under the chat input.
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Reviews OCR'd from screenshots, queued for the owner's explicit
  // confirmation (one card at a time) before becoming testimonial facts
  // (invariant №5 — no invented facts).
  const [pendingReviews, setPendingReviews] = useState<{ quote: string; author: string }[]>([]);

  // Inline tool-status chips (04 §2): the agent's tool lifecycle, streamed as
  // {t:"tool"} events — the owner watches the agent work, not a blank spinner.
  const [activeTools, setActiveTools] = useState<string[]>([]);

  // --- Reset-conversation confirm dialog ---
  const [resetOpen, setResetOpen] = useState(false);

  // --- Draft preview (04 §2): a generated draft awaiting human publish ---
  const [draft, setDraft] = useState<{ host: string; previewUrl: string; editUrl: string } | null>(
    null,
  );

  // --- Done / error state ---
  const [siteUrl, setSiteUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  // The t.me deep link for THIS site, resolved as soon as the site is live.
  // Resolved ahead of the press on purpose: a link fetched inside the click
  // handler opens a window the browser did not attribute to a user gesture,
  // and pop-up blockers eat it. `null` = not resolved yet, "" = unavailable
  // (no bot configured / not the owner) and the row says so instead of
  // pretending.
  const [tgLink, setTgLink] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Hidden file input behind the paperclip button (chat photo upload, wave G).
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Holds the persisted conversation id after first user send; null = not yet created
  const convIdRef = useRef<string | null>(null);

  // Revoke still-attached (unsent) thumbnail blob URLs on unmount — they
  // otherwise live for the whole tab. Ref keeps the cleanup closure current.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(
    () => () => {
      for (const p of pendingRef.current) URL.revokeObjectURL(p.thumbUrl);
    },
    [],
  );

  // Auto-scroll the chat COLUMN only (scrollIntoView would also scroll the
  // page/preview ancestors). Own sends always jump; otherwise don't yank the
  // owner back down if they scrolled up to read.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300;
    if (nearBottom || last?.role === "user") el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // Streaming grows the last bubble every frame — keep the column pinned to
  // the bottom while the turn runs, releasing when the owner scrolls up.
  useEffect(() => {
    if (!loading) return;
    const el = chatScrollRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
        el.scrollTop = el.scrollHeight;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loading]);

  // On mount: resume a previously persisted conversation. `?conv=` (the
  // login-gate handoff, §3.2/M3) wins over localStorage — localStorage is
  // per-ORIGIN, so an id written on the marketing root never reaches
  // app./new by itself; the gate carries it across in the login `next` URL.
  //
  // M12 resume semantics for the URL handoff (in priority order):
  //  1. The conversation already holds a DRAFT host → straight to the preview
  //     (no regeneration — the draft exists, tokens were already spent).
  //  2. `?resume=1` AND the same-tab auth flag (stamped by /login before it
  //     hands over to Google OR to the password form, sessionStorage = same
  //     tab + same origin) → generation auto-starts: the visitor asked for a
  //     site seconds ago and never left the tab. Signing in is a detour we
  //     imposed, so it must not cost a second «Створити сайт» press.
  //  3. `?resume=1` without the flag (a confirmation link opened from a mail
  //     app, any later bearer-link visit) → recap of the collected facts +
  //     the single «Створити сайт» CTA. A link from an email must never burn
  //     3 minutes of tokens by itself.
  useEffect(() => {
    const params = embedded ? null : new URLSearchParams(window.location.search);
    const fromUrl = params?.get("conv") ?? null;
    const wantsResume = params?.get("resume") === "1";
    const stored = fromUrl ?? localStorage.getItem("vitryna_conv_id");
    // Consume the OAuth flag exactly once, even when the load below bails —
    // a stale flag must never auto-start some LATER unrelated visit.
    let sameTabAuth = false;
    if (fromUrl) {
      try {
        sameTabAuth = sessionStorage.getItem(AUTH_RESUME_KEY) === fromUrl;
        sessionStorage.removeItem(AUTH_RESUME_KEY);
      } catch {
        /* storage blocked — degrade to the recap path */
      }
    }
    if (!stored) return;

    loadConversation(stored).then((data) => {
      // W2 (review must-fix): the server refused the read — the conversation
      // is CLAIMED. The bearer link must not open its preview (that was the
      // regression M1 exists to close). Signed out → the gate (it may well be
      // the owner mid-flow — carry the conv id so login resumes it); signed
      // in as someone else → the same honest claim-gate copy.
      if (data && "locked" in data) {
        if (!fromUrl) return; // localStorage-only restore: silently start fresh
        if (data.locked === "auth") {
          convIdRef.current = stored;
          setPhase("gate");
        } else {
          setErrorMsg(CLAIMED_BY_OTHER_ERROR);
          setPhase("error");
        }
        return;
      }
      // Restore hygiene (M6): real back-and-forth only (>1 means user spoke);
      // embedded additionally skips conversations that already minted a draft
      // (they belong to the app-host preview flow — see the helper).
      if (!data || !shouldRestoreConversation(data, embedded)) return;
      convIdRef.current = stored;
      // Adopt the handed-off conversation on THIS origin so a later reload
      // (without the query string) still resumes it.
      if (fromUrl) localStorage.setItem("vitryna_conv_id", stored);
      setFacts(data.facts as Partial<BusinessFacts>);
      setVerticalId(data.verticalId);
      setReady(data.ready);
      setConfirmed(data.confirmed);
      // Media survives the login-gate redirect (saved fire-and-forget) — restore
      // it so the media step shows what was already uploaded.
      setMedia(data.media ?? { photos: [] });
      // The starter chip belongs to a FRESH conversation only (codex review).
      setQuickReplies([]);

      // M12 §1: an existing draft → its preview, never a second generation.
      // Ownership is enforced SERVER-side: loadConversation returns `locked`
      // (handled above) for a claimed conversation unless the caller is a
      // member — so reaching here with a host means the viewer may open the
      // authed editor frame.
      if (fromUrl && data.host) {
        setMessages(data.messages);
        setDraft({
          host: data.host,
          previewUrl: `/edit/${data.host}/frame`,
          editUrl: `/edit/${data.host}`,
        });
        setPhase("preview");
        return;
      }
      if (fromUrl && wantsResume && sameTabAuth) {
        // M12 §2: same-tab return from ANY sign-in route — the user asked for
        // a site moments ago and is still in that tab; the effect below
        // consumes the flag AFTER this state flushes, so generation reads the
        // restored facts (the auth gate still applies).
        setMessages(data.messages);
        setAutoGenerate(true);
        return;
      }
      if (fromUrl && wantsResume) {
        // M12 §3: recap + single CTA (the CTA renders when `confirmed` was
        // restored above). Transient by design — not persisted as a turn.
        setMessages([
          ...data.messages,
          {
            role: "assistant",
            content: resumeRecap(
              data.facts as Partial<BusinessFacts>,
              (data.media ?? { photos: [] }).photos.length,
              data.confirmed,
            ),
          },
        ]);
        return;
      }
      setMessages(data.messages);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; `embedded` never changes at runtime
  }, []);

  // Embedded (M10/§5): every non-chat screen lives in the fullscreen overlay —
  // the auth gate renders INSIDE it (not a redirect), the preview occupies it —
  // and returning to the chat afterwards must not collapse mid-flow.
  useEffect(() => {
    if (embedded && (phase !== "chat" || inlineGen)) setExpanded(true);
  }, [embedded, phase, inlineGen]);

  // Overlay open → lock body scroll (M10): the landing behind must not move;
  // the chat column is the single scrollable. Restores the previous value on
  // close/unmount so the landing keeps whatever it had.
  const overlayActive = embedded && (expanded || phase !== "chat");
  useEffect(() => {
    if (!overlayActive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayActive]);

  // M6: a finished conversation must never restore — on ANY host. Publish
  // already clears the key inline; this phase-driven clear covers every other
  // path into "done".
  useEffect(() => {
    if (phase === "done") localStorage.removeItem("vitryna_conv_id");
  }, [phase]);

  // Generation progress clock: NO real per-step signal exists (generateDraftAction
  // is one awaited server action), so this ticks a plain elapsed-seconds counter
  // while phase is "generating" — the render below derives step/message/bar from
  // it. Resets on every entry (so a retry restarts the sequence) and is cleared
  // on exit, so it never keeps running once the phase moves on.
  useEffect(() => {
    if (phase !== "generating" && !inlineGen) return;
    setGenElapsed(0);
    const id = setInterval(() => setGenElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase, inlineGen]);

  // ---------------------------------------------------------------------------
  // Chat handlers
  // ---------------------------------------------------------------------------

  // One turn over the streaming endpoint (P4). Text deltas paint into the last
  // assistant bubble as they arrive; the trailing "final" event carries the
  // structured result. Refusals (rate limit etc.) come back as plain JSON.
  type TurnPayload = {
    message: string;
    facts: Partial<BusinessFacts>;
    verticalId: string;
    ready: boolean;
    confirmed: boolean;
    // W0: the model called start_generation this turn — the client must start
    // the same flow as the «Створити сайт» button (auth gate included).
    generate?: boolean;
    quickReplies: string[];
    // Media the agent's tools added this turn (scrape/analyze/set_media_role).
    media?: { photos: string[]; logoUrl?: string; photoMeta?: PhotoMeta[] };
  };

  // `modelMessages` go to the API (this turn's batch summary excluded — the
  // system prompt's media inventory already covers it); `uiBase` is what the
  // streamed reply paints onto; `mediaNow` is passed explicitly because the
  // closure's `media` is stale right after a batch.
  const streamTurn = async (
    modelMessages: ChatMsg[],
    uiBase: ChatMsg[],
    mediaNow: SiteMedia,
  ): Promise<TurnPayload> => {
    const res = await fetch("/api/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: modelMessages,
        facts,
        verticalId,
        media: mediaNow,
        conversationId: convIdRef.current,
      }),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await res.json()) as { message?: string };
      if (typeof j.message === "string") {
        // Refusal (rate limit etc.) is message-only — carry the current state
        // through so a limited turn can't silently drop ready/confirmed.
        return {
          message: j.message,
          facts,
          verticalId: verticalId ?? "generic",
          ready,
          confirmed,
          generate: false,
          quickReplies: [],
        };
      }
      throw new Error("bad refusal payload");
    }
    if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let acc = "";
    let final: TurnPayload | null = null;
    // {t:"generate"} arrives BEFORE {t:"final"} (which mirrors it as a field) —
    // remember it so a final that raced/omitted the flag still triggers.
    let generateSignal = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const chunks = buf.split("\n\n");
      buf = chunks.pop() ?? "";
      for (const c of chunks) {
        const line = c.trim();
        if (!line.startsWith("data:")) continue;
        let obj: { t?: string; text?: string; message?: string; name?: string; label?: string } & Partial<TurnPayload>;
        try {
          obj = JSON.parse(line.slice(5));
        } catch {
          continue;
        }
        if (obj.t === "tool" && typeof obj.label === "string") {
          // A tool started — show it as an inline status chip.
          const label = obj.label;
          setActiveTools((prev) => (prev.includes(label) ? prev : [...prev, label]));
        } else if (obj.t === "d" && typeof obj.text === "string") {
          if (!acc) {
            setTyping(false);
          }
          // The agent finished its tools and is answering — drop the chips.
          setActiveTools([]);
          acc += obj.text;
          setMessages([...uiBase, { role: "assistant", content: acc }]);
        } else if (obj.t === "generate") {
          // The agent called start_generation — the caller starts the same
          // flow as the «Створити сайт» button once the final state lands.
          generateSignal = true;
        } else if (obj.t === "final") {
          final = obj as TurnPayload;
        } else if (obj.t === "error") {
          throw new Error(obj.message || "stream error");
        }
        // Unknown event types are ignored on purpose — forward-compatible.
      }
    }
    if (!final) throw new Error("stream ended without final event");
    return { ...final, generate: Boolean(final.generate) || generateSignal };
  };

  // Instagram is no longer a separate client pipeline: a pasted IG link is a
  // normal chat message, and the onboarding agent calls its scrape_instagram
  // tool itself (04 §3). The imported facts/photos arrive via the {t:"final"}
  // media/facts merge, like any other agent turn.

  // Reset to a brand-new conversation (header ↺, confirm-gated). The old DB
  // row is simply abandoned — same as clearing the browser; nothing to delete
  // client-side. Local-only state: no server call, so it's instant.
  const resetChat = () => {
    localStorage.removeItem("vitryna_conv_id");
    convIdRef.current = null;
    for (const p of pending) URL.revokeObjectURL(p.thumbUrl);
    setPending([]);
    setMessages([igImportEnabled ? IG_GREETING : GREETING]);
    setFacts({});
    setReady(false);
    setConfirmed(false);
    setVerticalId(undefined);
    setInput("");
    setQuickReplies(igImportEnabled ? ["У мене є Instagram"] : []);
    setSavedNote(null);
    setMedia({ photos: [] });
    setPendingReviews([]);
    setUploadError(null);
    setActiveTools([]);
    setAutoGenerate(false);
    setDraft(null);
    setResetOpen(false);
    // Same guard as send()'s refocus: never re-open a collapsed embedded card.
    setTimeout(() => {
      if (!embedded || expandedRef.current) inputRef.current?.focus();
    }, 50);
  };

  // The claimed-by-other refusal tells the user to start a NEW conversation —
  // this button actually does it (review must-fix: the error screen's retry
  // was guaranteed to refuse again, deterministically). resetChat clears the
  // stored conversation id and returns local state to the greeting.
  const startFreshConversation = () => {
    resetChat();
    setErrorMsg("");
    setSiteUrl("");
    setPhase("chat");
  };

  // Core send — used by the input row AND by quick-reply chips. Carries the
  // composer's pending photo attachments: the batch uploads/analyzes in
  // parallel, routes into ONE aggregated summary, and only then (if there was
  // text) the normal agent turn runs.
  const send = async (raw: string) => {
    const text = raw.trim();
    const batch = pending;
    if ((!text && batch.length === 0) || loading) return;

    setUploadError(null);
    setSavedNote(null);
    setQuickReplies([]);
    setActiveTools([]);
    setLoading(true);
    // M10: the first send from the collapsed hero card opens the overlay.
    if (embedded) setExpanded(true);

    // Lazily create the DB row BEFORE any optimistic UI (plan review): photo
    // uploads scope by conversationId, so a failed start must leave the
    // composer intact (text + attachments) instead of a dangling bubble.
    if (convIdRef.current === null) {
      const started = await startConversation(source ?? (embedded ? "landing" : "new-page"));
      if (started) {
        convIdRef.current = started.conversationId;
        localStorage.setItem("vitryna_conv_id", started.conversationId);
      }
    }
    if (batch.length > 0 && !convIdRef.current) {
      setUploadError("Не вдалося завантажити фото — спробуйте трохи пізніше.");
      setLoading(false);
      return;
    }

    const notedBefore = new Set(doneLabels(facts));

    // Optimistic user bubble: local object-URL thumbnails until the upload
    // swaps them for storage URLs.
    const userMsg: ChatMsg = {
      role: "user",
      content: text,
      ...(batch.length > 0 && { attachments: batch.map((b) => b.thumbUrl) }),
    };
    let modelMessages: ChatMsg[] = [...messages, userMsg];
    let uiMessages: ChatMsg[] = modelMessages;
    let mediaNow = media;
    setMessages(uiMessages);
    setInput("");
    setPending([]);

    try {
      if (batch.length > 0) {
        setBatchCard({ thumbs: batch.map((b) => b.thumbUrl), done: 0, total: batch.length });
        const settled = await Promise.all(
          batch.map(async (item): Promise<BatchItem> => {
            try {
              const blob = await processImage(item.file);
              const ext = blob.type === "image/webp" ? "webp" : "jpg";
              const fd = new FormData();
              fd.append("file", blob, `photo.${ext}`);
              fd.append("conversationId", convIdRef.current as string);
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              const json = (await res.json().catch(() => null)) as
                | { ok?: boolean; url?: string; warnings?: string[]; palette?: string[] }
                | null;
              if (!res.ok || !json?.url) return { failed: true };
              const analysis = await analyzePhotoAction(json.url);
              return {
                failed: false,
                url: json.url,
                analysis,
                warnings: json.warnings ?? [],
                ...(json.palette?.length && { uploadPalette: json.palette }),
              };
            } catch {
              return { failed: true };
            } finally {
              setBatchCard((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
            }
          }),
        );

        // Promise.all keeps INPUT order — routing (e.g. last-logo-wins) is
        // deterministic, not network-timing dependent.
        const uploaded = settled.flatMap((s) => (s.failed ? [] : [s.url]));
        const routed = routeBatch(media, settled);
        mediaNow = applyMediaLocal(routed.media);
        if (routed.reviews.length) setPendingReviews((prev) => [...prev, ...routed.reviews]);

        // Swap local thumbnails for storage URLs (failed uploads drop out). A
        // fully-failed photo-only send keeps no user message at all — an empty
        // bubble would persist and add an empty-content turn to history.
        const userMsgFinal: ChatMsg = {
          role: "user",
          content: text,
          ...(uploaded.length > 0 && { attachments: uploaded }),
        };
        const keepUserMsg = Boolean(text) || uploaded.length > 0;
        modelMessages = keepUserMsg ? [...messages, userMsgFinal] : [...messages];
        // The summary stays OUT of this turn's model input — the system
        // prompt's media inventory already reflects the uploads (G4).
        uiMessages = [...modelMessages, { role: "assistant", content: routed.summary }];
        setMessages(uiMessages);
        setBatchCard(null);
        for (const b of batch) URL.revokeObjectURL(b.thumbUrl);

        // Single write: summary message AND media together (wave G pattern —
        // two racing read-modify-writes could lose the fresh upload). AWAITED
        // (code review): applyResult fires its own saveTurn later with the
        // full message list; if this earlier, shorter write ever landed AFTER
        // it, the persisted conversation would lose the agent's reply.
        if (convIdRef.current) {
          await saveTurn(
            convIdRef.current,
            uiMessages,
            facts,
            verticalId,
            ready,
            confirmed,
            mediaNow,
          ).catch(() => {});
        }
      }

      // Photo-only send stops here — the summary (+ review cards) IS the reply.
      if (!text) return;

      setTyping(true);

      const applyResult = (result: TurnPayload) => {
        const finalMessages: ChatMsg[] = [...uiMessages, { role: "assistant", content: result.message }];
        setMessages(finalMessages);
        setFacts(result.facts);
        setReady(result.ready);
        setConfirmed(result.confirmed ?? false);
        setVerticalId(result.verticalId);
        setQuickReplies(result.quickReplies ?? []);

        // Merge media the agent's tools produced this turn (scrape/analyze/
        // set_media_role). The route returns the authoritative post-turn media
        // (what the client sent + tool additions), so adopt it — but only when
        // present (the non-stream fallback carries none). photoMeta is kept whole
        // (text_source entries feed the dossier, not the gallery).
        let effectiveMedia = mediaNow;
        if (result.media) {
          effectiveMedia = {
            photos: result.media.photos.slice(0, MAX_PHOTOS),
            ...(result.media.logoUrl && { logoUrl: result.media.logoUrl }),
            ...(result.media.photoMeta?.length && { photoMeta: result.media.photoMeta }),
          };
          setMedia(effectiveMedia);
        }

        // Agentic feedback: which facts the agent just recorded — a real diff,
        // not decoration (the questionnaire header chips are gone, W0 §0.5).
        const newly = doneLabels(result.facts).filter((l) => !notedBefore.has(l));
        setSavedNote(newly.length ? newly.join(", ") : null);

        // The agent called start_generation (C2: chat DOES, not promises) —
        // hand off to the button flow via the effect below, after state flushes.
        if (result.generate) setAutoGenerate(true);

        // Persist turn fire-and-forget — never blocks the UI. Media rides along
        // explicitly (loading gate = it can't be mid-change), so this write never
        // depends on racing the stored value back in.
        if (convIdRef.current) {
          void saveTurn(
            convIdRef.current,
            finalMessages,
            result.facts,
            result.verticalId,
            result.ready,
            result.confirmed ?? false,
            effectiveMedia,
          );
        }
      };

      try {
        applyResult(await streamTurn(modelMessages, uiMessages, mediaNow));
      } catch {
        // Streaming path failed (network, SSE parse, server) → the proven
        // non-stream server action still answers the turn (degraded: no tools).
        setTyping(true);
        applyResult(
          await onboardAction(modelMessages, facts, verticalId, { ready, confirmed }),
        );
      }
    } finally {
      setLoading(false);
      setTyping(false);
      setBatchCard(null);
      setActiveTools([]);
      // Return focus to input so the owner can keep typing. Embedded: only
      // while the overlay is still open — a programmatic focus on the
      // collapsed card would trip the focus-expands rule (M10) and re-open
      // what the user just closed.
      setTimeout(() => {
        if (!embedded || expandedRef.current) inputRef.current?.focus();
      }, 50);
    }
  };

  const handleSend = () => send(input);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Confirmed CTA → the optional media step (login gate comes AFTER it).

  // ---------------------------------------------------------------------------
  // Chat photo attachments (wave G) — the paperclip only ATTACHES files to the
  // composer; upload + vision analysis + routing run inside send(). The shared
  // `loading` flag keeps sends mutually exclusive.
  // ---------------------------------------------------------------------------

  // Append an assistant message from the review-confirm flow and persist it
  // fire-and-forget. `factsOverride` is passed by the review-save case, where
  // facts changed this turn and setFacts hasn't flushed into the closure.
  // Closure state is safe here for the same reason applyResult's is: the
  // `loading` gate keeps sends exclusive and the review cards are disabled
  // while loading — nothing else appends between the click and this call. (A
  // saveTurn INSIDE a setMessages updater would be a side effect during
  // render — React flags it.)
  const appendAssistant = (content: string, factsOverride?: Partial<BusinessFacts>) => {
    const next: ChatMsg[] = [...messages, { role: "assistant", content }];
    setMessages(next);
    if (convIdRef.current) {
      void saveTurn(
        convIdRef.current,
        next,
        factsOverride ?? facts,
        verticalId,
        ready,
        confirmed,
        media,
      );
    }
  };

  // Apply a media change locally WITHOUT the media-step's saveMediaAction —
  // in the batch flow persistence rides send()'s single saveTurn write
  // together with the summary message.
  const applyMediaLocal = (next: SiteMedia): SiteMedia => {
    const clean: SiteMedia = { ...next, photoMeta: pruneMeta(next) };
    setMedia(clean);
    return clean;
  };

  // Attach picked files to the composer (no server calls yet). Caps at
  // MAX_PHOTOS per message; extras are dropped with an inline hint.
  const addFiles = (files: File[]) => {
    if (loading || files.length === 0) return;
    const room = MAX_PHOTOS - pending.length;
    setUploadError(files.length > room ? `Можна прикріпити до ${MAX_PHOTOS} фото за раз.` : null);
    const taken = files.slice(0, Math.max(0, room)).map((file) => ({
      id: attachId(),
      file,
      thumbUrl: URL.createObjectURL(file),
    }));
    if (taken.length) setPending([...pending, ...taken]);
  };

  const removePending = (id: string) => {
    const item = pending.find((p) => p.id === id);
    if (item) URL.revokeObjectURL(item.thumbUrl);
    setPending(pending.filter((p) => p.id !== id));
  };

  // Confirm/decline the FIRST queued review card; the next one (if any)
  // surfaces automatically.
  const saveReview = () => {
    const current = pendingReviews[0];
    if (!current) return;
    const author = current.author.trim() || "Клієнт";
    const newFacts: Partial<BusinessFacts> = {
      ...facts,
      testimonials: [...(facts.testimonials ?? []), { quote: current.quote, author }],
    };
    setFacts(newFacts);
    setSavedNote("Відгук");
    setPendingReviews(pendingReviews.slice(1));
    appendAssistant("Зберіг відгук — він зʼявиться на сайті. Дякую!", newFacts);
  };

  const declineReview = () => setPendingReviews(pendingReviews.slice(1));

  // Confirm → straight to generation (owner decision: no media step — IG photos
  // are already in; with none we generate images in the background and the site
  // shows shimmer placeholders). Login-gated: the draft preview is authed.
  // `inline` = triggered by the agent's start_generation signal: same auth
  // gate, same runGenerate, but the progress card renders in the chat column.
  const handleCreateSite = async (opts?: { inline?: boolean }) => {
    if (loading || genPending) return;
    setLoading(true);
    // Armed from HERE, not from runGenerate: the session check below is an
    // await, and the footer must stop offering the action immediately.
    setGenPending(true);
    try {
      const s = await sessionStateAction();
      // Auth on + not signed in → warm gate (save the site), not generation.
      // Honesty (C2): the stream may have just said «Запускаю створення
      // сайту…», but nothing generates for an anonymous visitor — so say what
      // will ACTUALLY happen. Persisted via appendAssistant, so the restored
      // conversation after sign-in still reads correctly.
      if (s.authOn && !s.loggedIn) {
        // The promise matches M12 §2: /login stamps the same-tab flag for the
        // password form as well as for Google, so a return to THIS tab starts
        // the draft by itself. It is a promise about the tab, not about the
        // method — which is why it is not «натисніть кнопку ще раз» any more.
        // Honesty (M5): with no persisted conversation (rate-limited /
        // unconfigured startConversation) NOTHING carries over — say so
        // instead of promising a resume that cannot happen.
        appendAssistant(
          convIdRef.current
            ? "Щоб зберегти сайт за вами, спершу увійдіть — і я одразу почну збирати чернетку."
            : "Щоб створити сайт, спершу увійдіть. Цю розмову не вдалося зберегти, тож після входу я поставлю кілька коротких питань ще раз.",
        );
        setGenPending(false);
        setPhase("gate");
        return;
      }
    } catch (err) {
      // Without this catch a failed action (e.g. deployment skew 404) escaped
      // and the CTA just looked dead — no state change, no message.
      setGenPending(false);
      setErrorMsg(actionErrorMessage(err));
      setPhase("error");
      return;
    } finally {
      setLoading(false);
    }
    await runGenerate(opts);
  };

  // The publish moment's ONE job after «your site is live» is the funnel:
  // leads reach the owner through Telegram or they reach nobody. Resolve the
  // deep link the moment the site goes live, so the button IS the connection
  // instead of a trip to the sites list to press a differently-named button
  // there (owner report: «too many actions»).
  useEffect(() => {
    if (phase !== "done" || !draft?.host || tgLink !== null) return;
    let cancelled = false;
    void getTelegramConnectLinkForHost(draft.host)
      .then((res) => {
        if (!cancelled) setTgLink(res.ok ? res.link : "");
      })
      .catch(() => {
        if (!cancelled) setTgLink("");
      });
    return () => {
      cancelled = true;
    };
  }, [phase, draft?.host, tgLink]);

  // Consume the {t:"generate"} signal ONE render after applyResult set it —
  // by now facts/media/verticalId are flushed, so generation reads this
  // turn's saved facts, not the stale send() closure. Guarded exactly like
  // the button: not mid-request, chat phase only.
  useEffect(() => {
    if (!autoGenerate || loading || genPending || phase !== "chat") return;
    setAutoGenerate(false);
    void handleCreateSite({ inline: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, loading, genPending, phase]);

  // ---------------------------------------------------------------------------
  // Generation moved earlier (04 §2/§4): confirmed facts → a real DRAFT the
  // owner previews, then publishes by hand (invariant 6). W0 (plan C7): the
  // only client requirement is a business name + ANY contact channel — the
  // server backstop (shared by both transports) mirrors exactly this.
  // ---------------------------------------------------------------------------

  // Primary transport (V2 spec §7): POST /api/generate, an SSE stream of the
  // pipeline's stage boundaries (same parsing approach as streamTurn). The
  // promise RESOLVES AT s3_done — the preview-ready point — and keeps draining
  // the tail (s4 QA events) detached: the owner must not wait out the QA pass
  // (late resolve/reject on a settled promise is a no-op by design). Rejects
  // only on TRANSPORT failure (network / non-SSE / cut stream) — the caller
  // falls back to generateDraftAction ONLY when no stage event arrived yet
  // (flags.sawStage below); a server-REPORTED failure ({t:"error"}) resolves
  // ok:false like the action would (re-running a failed generation would
  // double the model spend and the daily budget).
  const streamGenerate = (
    factsNow: Partial<BusinessFacts>,
    // This run's genRunRef value — the s4 note guard (see below).
    runId: number,
    // Out-param: flips to true on the FIRST stage event — i.e. the moment the
    // server pipeline verifiably started. The caller's fallback decision hangs
    // on it: after model spend began, a blind action re-run would double-charge
    // the onboard_generate budget and fork a second pipeline onto the same host.
    flags?: { sawStage: boolean },
  ): Promise<GenerateDraftResult> =>
    new Promise((resolve, reject) => {
      (async () => {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facts: factsNow,
            verticalId,
            media,
            conversationId: convIdRef.current ?? undefined,
          }),
        });
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          // Pre-stream refusal (bad body / no session) — mirror the action.
          const j = (await res.json()) as { message?: string; authRequired?: boolean };
          resolve({
            ok: false,
            error: j.message || "Не вдалося згенерувати сайт.",
            ...(j.authRequired && { authRequired: true as const }),
          });
          return;
        }
        if (!res.ok || !res.body) throw new Error(`generate stream failed: ${res.status}`);

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let settled = false;
        const settle = (r: GenerateDraftResult) => {
          settled = true;
          resolve(r);
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const chunks = buf.split("\n\n");
          buf = chunks.pop() ?? "";
          for (const c of chunks) {
            const line = c.trim();
            if (!line.startsWith("data:")) continue; // ":" heartbeats etc.
            let obj: {
              t?: string;
              name?: string;
              status?: string;
              detail?: Record<string, unknown>;
              message?: string;
              authRequired?: boolean;
              host?: string;
              previewUrl?: string;
              editUrl?: string;
            };
            try {
              obj = JSON.parse(line.slice(5));
            } catch {
              continue;
            }
            if (obj.t === "stage" && typeof obj.name === "string") {
              if (flags) flags.sawStage = true;
              const name = obj.name;
              const status = obj.status ?? "";
              const detail = obj.detail && typeof obj.detail === "object" ? obj.detail : {};
              if (name === "s4_qa") {
                // The QA tail arrives AFTER settle (the preview is already
                // up) — it feeds the inline chat note only, guarded so a
                // draining old stream never writes into a newer run's note.
                if (genRunRef.current === runId) {
                  setGenQa(
                    status === "start"
                      ? "running"
                      : status === "done"
                        ? "done"
                        : status === "skipped"
                          ? "skipped"
                          : "error",
                  );
                }
              } else if (!settled) {
                // Real signals resolve the cards (the paced clock stays the
                // floor). After settle the tail is s4-only — stop writing so a
                // draining old stream can never bump a NEW generation's cards.
                setGenStages((prev) => mergeStageEvent(prev, name, status, detail));
              }
            } else if (obj.t === "s3_done" && obj.host && obj.previewUrl && obj.editUrl) {
              // Preview-ready (TFAO): hand the draft to the caller NOW; the
              // stream keeps draining below so s4 completes server-side.
              settle({ ok: true, host: obj.host, previewUrl: obj.previewUrl, editUrl: obj.editUrl });
            } else if (obj.t === "done" && obj.host && obj.previewUrl && obj.editUrl) {
              settle({ ok: true, host: obj.host, previewUrl: obj.previewUrl, editUrl: obj.editUrl });
            } else if (obj.t === "error") {
              // After the preview point an S4/QA error must not undo a shown
              // preview — settle() already won and this resolve is a no-op.
              settle({
                ok: false,
                error: obj.message || "Не вдалося згенерувати сайт.",
                ...(obj.authRequired && { authRequired: true as const }),
              });
            }
            // Unknown event types are ignored — forward-compatible.
          }
        }
        if (!settled) throw new Error("generate stream ended without a result");
      })()
        .catch(reject) // no-op if already resolved (settled promise)
        .finally(() => {
          // Transport gone (closed OR died mid-s4): a note still «running»
          // can never resolve from this stream — flip it to the honest
          // interrupted state instead of spinning forever.
          if (genRunRef.current === runId) {
            setGenQa((prev) => (prev === "running" ? "error" : prev));
          }
        });
    });

  const runGenerate = async (opts?: { inline?: boolean }) => {
    const businessName = (facts.businessName ?? "").trim();
    // Defense in depth — mirrors the server backstop (name + phone/telegram/
    // instagram/viber). If it fires, say WHAT is missing and drop confirmed
    // so the CTA hides.
    if (!businessName || !hasContactChannel(facts)) {
      const missing = [
        !businessName && "назва бізнесу",
        !hasContactChannel(facts) && "хоч один контакт (телефон, Instagram, Telegram або Viber)",
      ]
        .filter(Boolean)
        .join(" і ");
      setConfirmed(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Для сайту ще бракує: ${missing}. Напишіть — і продовжимо.`,
        },
      ]);
      setGenPending(false);
      setPhase("chat");
      return;
    }

    const fullFacts: Partial<BusinessFacts> = {
      ...facts,
      businessName,
      ...(facts.services && { services: facts.services.filter((s) => s.name.trim()) }),
    };

    setLoading(true);
    // Also armed for the DIRECT callers (preview «Згенерувати ще раз», the
    // error screen) that never went through handleCreateSite.
    setGenPending(true);
    genRunRef.current += 1;
    const runId = genRunRef.current;
    setGenStages({});
    setGenQa(null);
    if (opts?.inline) setInlineGen(true);
    else setPhase("generating");

    try {
      let result: GenerateDraftResult;
      const streamFlags = { sawStage: false };
      try {
        // Primary: the SSE transport — real stage events, preview at s3_done
        // (the QA tail keeps running server-side after we transition).
        result = await streamGenerate(fullFacts, runId, streamFlags);
      } catch {
        setGenStages({});
        if (streamFlags.sawStage) {
          // The stream died AFTER the pipeline verifiably started (a proxy cut
          // mid-S2, a network blip): the server keeps generating and persists
          // the draft regardless of our connection. Re-running the action here
          // would double-charge the rate limit and start a SECOND pipeline on
          // the same host — surface an honest message instead.
          result = {
            ok: false,
            error:
              "З'єднання перервалося, але генерація триває на сервері. Зачекайте хвилину-дві й оновіть сторінку — сайт, найімовірніше, вже готовий.",
          };
        } else {
          // Stream TRANSPORT failed before any stage event (network, non-SSE
          // response, refused connection) → no model spend happened; the proven
          // non-stream server action still answers, exactly like the
          // onboardAction fallback. The paced clock carries the progress UI.
          result = await generateDraftAction(
            fullFacts,
            verticalId,
            media,
            convIdRef.current ?? undefined,
          );
        }
      }
      if (result.ok) {
        setDraft({ host: result.host, previewUrl: result.previewUrl, editUrl: result.editUrl });
        setPhase("preview");
      } else if (result.authRequired) {
        // Session lapsed between the gate check and submit — send them to sign in.
        setPhase("gate");
      } else {
        setErrorMsg(result.error);
        setPhase("error");
      }
    } catch (err) {
      setErrorMsg(actionErrorMessage(err));
      setPhase("error");
    } finally {
      setLoading(false);
      setInlineGen(false);
      setGenPending(false);
      // Cards reset for the next run; genQa deliberately survives — the QA
      // tail note keeps updating (run-id-guarded) after the preview is up.
      setGenStages({});
    }
  };

  // Preview → HUMAN publish (invariant 6): publish the draft, celebrate.
  // Free since 2026-08-06 — nothing stands between this click and the live site.
  // The ₴999 is sold one screen later, for the owner's own domain.
  const handlePublish = async () => {
    if (loading || !draft) return;
    setLoading(true);
    try {
      const result = await finalizeAction(draft.host, convIdRef.current ?? undefined);
      if (result.ok) {
        setSiteUrl(result.url);
        setPhase("done");
        // Conversation is complete — clear localStorage so next visit starts fresh.
        localStorage.removeItem("vitryna_conv_id");
      } else if (result.authRequired) {
        setPhase("gate");
      } else {
        setErrorMsg(result.error);
        setPhase("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Невідома помилка");
      setPhase("error");
    } finally {
      setLoading(false);
    }
  };

  // ViewContent = «побачив свій сайт», the moment the funnel is really working.
  // Fired once per session, when the preview screen first mounts.
  const viewContentSent = useRef(false);
  useEffect(() => {
    if (phase !== "preview" || viewContentSent.current) return;
    viewContentSent.current = true;
    pixelTrack("ViewContent");
    phCapture("ui_preview_shown");
  }, [phase]);

  // «Сайт живий», once per session. The success screen re-renders freely (the
  // domain card below it has its own state), so «shown» has to mean «first
  // reached», not «drawn» — one owner publishing once must not read as two.
  const publishSuccessSent = useRef(false);
  useEffect(() => {
    if (phase !== "done" || publishSuccessSent.current) return;
    publishSuccessSent.current = true;
    phCapture("ui_publish_success", {
      surface: "onboard",
      ...(draft?.host ? { host: draft.host } : {}),
    });
  }, [phase, draft?.host]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL is visible above, no fallback needed */
    }
  };

  const rootBase = "bg-canvas text-ink";

  // While the big «Створити сайт» CTA is on screen, hide any quick-reply chip
  // with the same wording — the model likes to suggest it, and two identical
  // buttons read as a bug.
  const visibleQuickReplies = confirmed
    ? quickReplies.filter((q) => q.trim().toLowerCase() !== "створити сайт")
    : quickReplies;

  // Generation in flight (owner feedback 2026-08-10): the progress card is the
  // ONE affordance while it runs — a live «Створити сайт» button under a
  // running card reads as a second, competing action for work already started.
  // THREE states can carry a run and all three must hide the footer controls:
  // `genPending` (armed, session check still awaiting), `inlineGen` (the chat
  // card, phase stays "chat") and phase "generating" (the full-screen path,
  // which does not render this footer at all but is included so the flag means
  // one thing everywhere). `loading` alone is NOT it — an ordinary chat turn
  // also sets it, and the composer must stay put for that.
  const generating = genPending || inlineGen || phase === "generating";

  // Outside the chat phase, every EMBEDDED screen renders inside the same
  // fullscreen same-origin overlay (M10): the landing never navigates (that
  // would drop conversation state) and the gate/preview/done screens occupy
  // the overlay instead of taking over the page. The inner content keeps its
  // full-page classes — min-h-[100dvh] centers short screens and lets tall
  // ones scroll inside the overlay (no clipped tops, no nested traps). Full
  // mode returns the node untouched.
  const inEmbeddedOverlay = (node: ReactNode) =>
    embedded ? (
      <div className={`fixed inset-0 z-[100] overflow-y-auto overscroll-contain ${rootBase}`}>
        {node}
      </div>
    ) : (
      <>{node}</>
    );

  // ---------------------------------------------------------------------------
  // Render — chat phase (design B: merged progress chips + quick-reply chips)
  // ---------------------------------------------------------------------------

  if (phase === "chat") {
    // Shell per mode (W1): full page keeps the exact viewport grid; embedded
    // is a height-bounded hero card that expands into the fullscreen overlay
    // (M10). Same element tree in all three shells, so React keeps the DOM —
    // composer text, chat scroll and input focus survive collapse/expand.
    const shellClass = !embedded
      ? `h-[100dvh] ${rootBase} lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,32%)]`
      : expanded
        ? `fixed inset-0 z-[100] flex h-[100dvh] flex-col ${rootBase}`
        : `relative flex h-[min(560px,72dvh)] flex-col overflow-hidden rounded-[24px] border border-line shadow-card ${rootBase}`;
    return (
      <div className={shellClass}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <ConfirmDialog
          open={resetOpen}
          title="Почати нову розмову?"
          body="Поточна розмова і зібрані дані зникнуть. Завантажені фото можна буде додати ще раз."
          confirmLabel="Почати заново"
          onConfirm={resetChat}
          onCancel={() => setResetOpen(false)}
        />
        <div className="flex h-full min-h-0 flex-col">

        {/* Header: honey «3» avatar + Помічник + status */}
        <header className="border-b border-line bg-surface/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-2.5">
            {/* Back to the dashboard — absolute app-host URL (M3). Hidden in
                embedded mode: the chat already sits ON the landing, and a
                cross-host hop would drop the hero context. */}
            {!embedded && (
              <a
                href={appUrl("/")}
                aria-label="Назад"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <ArrowLeft size={20} />
              </a>
            )}
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-honey font-brand text-[19px] font-semibold text-honey-text">
              3
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-brand text-[17px] font-semibold text-ink">Помічник</span>
              {/* Static — the tool/typing indicator below the messages is the
                  sole "agent is working" signal; swapping this label too
                  read as a redundant third indicator (owner feedback). */}
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
                онлайн
              </span>
            </div>
            {/* Reset only makes sense once the user actually said something. */}
            {messages.length > 1 && (
              <button
                onClick={() => setResetOpen(true)}
                disabled={loading}
                aria-label="Почати нову розмову"
                title="Почати нову розмову"
                className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-45"
              >
                <RotateCcw size={19} />
              </button>
            )}
            {/* Collapse the overlay back to the hero card (M10) — state stays
                intact, a running turn keeps streaming into the card. Takes
                ml-auto only when the reset button (which owns it) is absent. */}
            {embedded && expanded && (
              <button
                onClick={() => setExpanded(false)}
                aria-label="Згорнути чат"
                title="Згорнути чат"
                className={`${messages.length > 1 ? "" : "ml-auto "}flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink`}
              >
                <X size={20} />
              </button>
            )}
          </div>
          {/* The questionnaire progress bar + chips are GONE (W0, plan §0.5):
              they read as a form and dictated the question script. The
              agent-status tool card in the message column is the sole
              «видима робота» signal now. */}
        </header>

        {/* Messages. overscroll-contain in embedded mode: the overlay's chat
            column must not chain its scroll into the landing (M10). */}
        <div
          ref={chatScrollRef}
          className={embedded ? "flex-1 overflow-y-auto overscroll-contain" : "flex-1 overflow-y-auto"}
        >
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3.5 px-4 py-6">
            {/* Promise chip only while the conversation is still warming up
                (C3): once the agent is ready to generate, the CTA/signal is
                the promise. */}
            {!ready && (
              <div className="flex items-center gap-1.5 self-center rounded-full bg-honey/15 px-3.5 py-1.5 text-[13px] font-bold text-honey-text">
                <Sparkles size={14} />
                Сайт буде готовий за ~3 хвилини
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                msg={msg}
                streaming={loading && msg.role === "assistant" && i === messages.length - 1}
              />
            ))}

            {savedNote && !typing && (
              <span className="ml-[42px] self-start rounded-full bg-ok-soft px-3 py-1 text-[13px] font-bold text-ok">
                ✓ Записано: {savedNote}
              </span>
            )}

            {batchCard && (
              <div className="flex items-start gap-2.5">
                <AgentAvatar busy />
                <div className="flex items-center gap-3 rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(51,41,28,0.05)]">
                  <div className="flex -space-x-3">
                    {batchCard.thumbs.slice(0, 3).map((t, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={t}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-[12px] border-2 border-surface object-cover"
                      />
                    ))}
                  </div>
                  <span className="text-[14px] font-semibold text-ink-muted">
                    {batchCard.total === 1
                      ? "Роздивляюсь фото…"
                      : `Роздивляюсь фото… ${Math.min(batchCard.done + 1, batchCard.total)} з ${batchCard.total}`}
                  </span>
                </div>
              </div>
            )}

            {/* ONE working indicator at a time, never two together: the tool
                card wins while any tool is running; otherwise the typing
                bubble covers extended thinking AND the plain pre-first-token
                wait (both look identical to the owner). Once text starts
                streaming, `typing` flips false and the growing bubble is the
                only signal — no indicator at all. */}
            {activeTools.length > 0 ? (
              <div className="flex items-start gap-2.5">
                <AgentAvatar busy />
                <div className="min-w-0 rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(51,41,28,0.05)]">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    Працюю над сайтом
                  </p>
                  <ul className="flex flex-col gap-2">
                    {activeTools.map((label, i) => (
                      <li
                        key={`${label}-${i}`}
                        className="flex items-center gap-2.5 text-[15px] font-semibold text-ink"
                      >
                        <span
                          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-honey border-t-transparent"
                          aria-hidden
                        />
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              typing && <AgentTyping />
            )}

            {/* Inline generation card (V4, spec §7 / plan C6): the agent called
                start_generation, so the work happens right here in the chat —
                real stage cards resolving from the SSE stream, with the paced
                clock as the floor. */}
            {inlineGen &&
              (() => {
                const gp = genCards(genElapsed, genStages);
                return (
                  <div className="flex items-start gap-2.5">
                    <AgentAvatar busy />
                    <div className="min-w-0 max-w-[85%] flex-1 rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-[18px] py-4 shadow-[0_1px_2px_rgba(51,41,28,0.05)] sm:max-w-[75%]">
                      <p className="text-[16px] font-bold text-ink">Генеруємо ваш сайт…</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
                        {GEN_MESSAGES[gp.msgIndex]}
                      </p>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sunken">
                        <div
                          className="relative h-2 overflow-hidden rounded-full bg-honey transition-all duration-1000 ease-out"
                          style={{ width: `${gp.barPct}%` }}
                        >
                          <span
                            className="absolute inset-y-0 left-0 w-1/3 bg-white/50"
                            style={{ animation: "ob-shimmer 1.6s ease-in-out infinite" }}
                            aria-hidden
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        {gp.cards.map((c) => (
                          <GenStep key={c.key} state={c.status} leg={c.leg}>
                            {c.label}
                          </GenStep>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* S4 QA tail note (V4): the check runs AFTER the preview is shown
                — a subtle inline line, never a blocking screen. The PRIMARY
                render is on the preview screen (the golden path lands there
                before any s4 event); this copy covers the owner who navigates
                back to the chat while (or after) the tail runs. */}
            {genQa !== null && !inlineGen && (
              <GenQaNote qa={genQa} className="ml-[42px] self-start" />
            )}

          </div>
        </div>

        {/* Footer: confirmed CTA + quick replies + input. The big CTA appears
            only AFTER the user explicitly confirmed the chat summary (A6).
            The model sometimes suggests «Створити сайт» as a quick reply too —
            next to the real CTA that chip is a confusing duplicate, so it is
            filtered out while the CTA is visible.
            While `generating` the footer offers NOTHING — every control below
            is gated on it and the composer is replaced by one honest status
            line, so the progress card in the message column is the only thing
            on screen asking for (or reporting) work. */}
        <footer className="border-t border-line bg-surface/70 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl px-4 pb-5 pt-3.5">
          {confirmed && !generating && (
            <button
              onClick={() => void handleCreateSite()}
              disabled={loading}
              className="animate-pop mb-3 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[18px] bg-brand text-[18px] font-bold text-white shadow-[0_10px_28px_rgba(51,41,28,0.22)] transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              Створити сайт
              <ArrowRight size={20} />
            </button>
          )}

          {visibleQuickReplies.length > 0 && !loading && !generating && (
            <div className="mb-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-ink-muted">
                <Sparkles size={14} className="text-honey" />
                Підказки — оберіть або напишіть своє
              </p>
              <div className="flex flex-wrap gap-2">
                {visibleQuickReplies.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="animate-pop rounded-full border border-line-strong bg-surface px-[18px] py-2.5 text-[15px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-honey hover:bg-honey/10"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reviews OCR'd from screenshots — the owner confirms each before it
              becomes a fact (invariant №5). One card at a time. Hidden while a
              generation runs: its facts are already sealed into that run, so
              «Зберегти відгук» there would be a promise we cannot keep. */}
          {pendingReviews.length > 0 && !generating && (
            <div className="animate-pop mb-3 flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-card">
              <span className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
                <Sparkles size={15} className="shrink-0 text-honey" />
                {pendingReviews.length > 1
                  ? `Знайшов відгук на скріншоті (ще ${pendingReviews.length - 1} у черзі):`
                  : "Знайшов відгук на скріншоті:"}
              </span>
              <p className="whitespace-pre-wrap rounded-[14px] bg-sunken px-3.5 py-3 text-[15px] leading-relaxed text-ink">
                {pendingReviews[0].quote}
              </p>
              <input
                type="text"
                value={pendingReviews[0].author}
                onChange={(e) =>
                  setPendingReviews((prev) =>
                    prev.length ? [{ ...prev[0], author: e.target.value }, ...prev.slice(1)] : prev,
                  )
                }
                placeholder="Імʼя клієнта (необовʼязково)"
                autoComplete="off"
                className="h-12 w-full rounded-full border border-line-strong bg-surface px-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-honey-deep focus:outline-none focus:ring-4 focus:ring-honey/20"
              />
              <div className="flex gap-2.5">
                {/* Gated by `loading`: saving while a chat turn streams would let
                    applyResult overwrite facts without this testimonial. */}
                <Button size="md" disabled={loading} onClick={saveReview} className="flex-1">
                  Зберегти відгук
                </Button>
                <Button variant="quiet" size="md" disabled={loading} onClick={declineReview} className="flex-1">
                  Не зберігати
                </Button>
              </div>
            </div>
          )}

          {/* Pending attachments — local previews, removable until sent.
              They stay VISIBLE while generating (only the composer goes away):
              these files are local-only object URLs that were never uploaded
              and are not part of the run, so hiding them made the owner's
              attachments disappear silently at the exact moment the phase flips
              to «preview». Rendered non-interactive instead, with an honest
              line saying they did not go in. */}
          {pending.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {pending.map((p) => (
                <div key={p.id} className="animate-pop relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbUrl}
                    alt=""
                    className="h-14 w-14 rounded-[14px] border border-line object-cover shadow-[0_1px_2px_rgba(51,41,28,0.06)]"
                  />
                  <button
                    onClick={() => removePending(p.id)}
                    disabled={loading || generating}
                    aria-label="Прибрати фото"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[12px] font-bold leading-none text-white transition-colors hover:bg-brand-hover"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {generating ? (
            // Composer OUT while the site is being built: a disabled input row
            // still looks like something to do. One honest line instead — the
            // tab has to stay open for the stream to land on the preview.
            <div className="py-2 text-center">
              <p className="text-[14px] font-semibold text-ink-muted">
                Створюю сайт — це до 3 хвилин. Не закривайте вкладку.
              </p>
              {pending.length > 0 && (
                <p className="mt-1 text-[13px] text-ink-muted">
                  Фото вище ще не надіслані — додасте їх у редакторі після створення.
                </p>
              )}
            </div>
          ) : (
          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = ""; // allow re-picking the same file
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              aria-label="Додати фото"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-muted transition-colors hover:border-honey hover:bg-honey/10 hover:text-honey-text disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Paperclip size={22} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              // M10: the first focus on the collapsed hero card expands the
              // chat into the fullscreen overlay — same origin, no navigation.
              onFocus={embedded ? () => setExpanded(true) : undefined}
              disabled={loading}
              placeholder={confirmed ? "Або допишіть щось…" : "Написати…"}
              autoComplete="off"
              className="h-14 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-5 text-[17px] text-ink placeholder:text-ink-muted transition-shadow focus:border-honey-deep focus:outline-none focus:ring-4 focus:ring-honey/20 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && pending.length === 0)}
              aria-label="Надіслати"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_18px_rgba(51,41,28,0.18)] transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              <SendArrow />
            </button>
          </div>
          )}

          {uploadError && (
            <p className="mt-2 pl-1 text-[14px] font-semibold text-danger">{uploadError}</p>
          )}
          </div>
        </footer>
        </div>

        {/* Live side preview belongs to the full-page mode only (plan §3.1) —
            the landing hero is a single compact chat column. */}
        {!embedded && (
          <SitePreviewPanel
            facts={facts}
            verticalId={verticalId}
            photosCount={media.photos.length}
            hasLogo={!!media.logoUrl}
            className="hidden lg:flex"
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — media step (§4.8): optional logo + photos before the confirm form
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Render — draft preview (04 §2): the generated draft, live, awaiting the
  // owner's own «Опублікувати» tap (publish is human-only, invariant 6).
  // ---------------------------------------------------------------------------

  if (phase === "preview" && draft) {
    return inEmbeddedOverlay(
      <div className={`flex min-h-[100dvh] flex-col ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <header className="border-b border-line bg-surface/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3.5">
            <button
              onClick={() => setPhase("chat")}
              disabled={loading}
              aria-label="Назад до розмови"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-45"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col leading-tight">
              <span className="font-brand text-[18px] font-semibold text-ink">
                Ваш сайт готовий до публікації
              </span>
              <span className="text-[13px] font-bold text-ink-muted">
                Перегляньте — і опублікуйте безкоштовно, коли все влаштовує
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
          {/* S4 QA tail (V4 must-fix): the owner lands HERE before any s4
              event arrives — the note must live on this screen, not only in
              the chat they already left. */}
          {genQa !== null && <GenQaNote qa={genQa} />}
          <div className="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-line bg-surface p-2 shadow-card">
            {/* Browser chrome around the live draft — the frame only; the iframe
                renders the real tenant site and is never styled from here. */}
            <div className="flex items-center gap-2 px-2 py-2">
              <span className="flex gap-1.5">
                {["#E6A5A0", "#EFC776", "#A9C9A4"].map((c) => (
                  <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </span>
              <span className="ml-1 flex-1 truncate rounded-full bg-sunken px-3 py-1 text-[12px] font-semibold text-ink-faint">
                {draft.host}
              </span>
            </div>
            <iframe
              // Absolute app-host URL (M3): the editor frame lives on app.<root>;
              // a relative src from the landing would 404 on the marketing host.
              src={appUrl(draft.previewUrl)}
              title="Попередній перегляд сайту"
              className="min-h-[420px] w-full flex-1 rounded-[16px] border border-line bg-canvas"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={loading}
              onClick={() => void handlePublish()}
              className="min-h-[60px] w-full text-[19px] shadow-[0_10px_28px_rgba(51,41,28,0.22)]"
            >
              {loading ? "Публікую…" : "Опублікувати сайт"}
            </Button>
            <div className="flex gap-2">
              <a
                href={appUrl(draft.editUrl)}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] border border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                <Pencil size={17} /> Відредагувати
              </a>
              <Button
                variant="quiet"
                size="md"
                disabled={loading}
                onClick={() => void runGenerate()}
                className="flex-1"
              >
                Згенерувати ще раз
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — login gate (journal #43): save the site behind an account
  // ---------------------------------------------------------------------------

  if (phase === "gate") {
    // The trust-builder gate (M7): the preview of what was collected, three
    // value lines, Google FIRST (zero emails), the email path second, and an
    // always-visible way back. Embedded: renders INSIDE the overlay (plan §5)
    // — no redirect; the honest message was already persisted into the chat
    // by handleCreateSite, and «Назад до розмови» returns to it.
    //
    // The ?conv= handoff (§3.2/M3): localStorage is per-origin, so the
    // conversation id must ride the login `next` URL to reach app./new.
    // Without a persisted conversation there is nothing to hand off — the
    // copy must not promise a resume.
    //
    // Cross-host Google (M7/M12): the gate NEVER calls the OAuth server
    // action itself. On the marketing root the action would run on the ROOT
    // origin and write the PKCE verifier cookie there, while /auth/callback
    // lives on the app host — the code exchange would always fail. Instead
    // BOTH hosts link to app./login?google=1&next=…, and /login (app host)
    // auto-triggers the action: one code path, and /login also stamps the
    // sessionStorage same-tab flag that M12's auto-resume requires.
    const gateConvId = convIdRef.current;
    const gateNext = gateConvId
      ? `/new?conv=${encodeURIComponent(gateConvId)}&resume=1`
      : "/new";
    const gateBiz = (facts.businessName ?? "").trim().slice(0, 60);
    const gateQuery =
      `next=${encodeURIComponent(gateNext)}` +
      (gateBiz ? `&biz=${encodeURIComponent(gateBiz)}` : "");
    const gateCity = (facts.city ?? "").trim();
    const gatePhotos = media.photos.length;
    const collected: { label: string; value: string }[] = [
      ...(gateBiz ? [{ label: "Назва", value: gateBiz }] : []),
      ...(gateCity ? [{ label: "Місто", value: gateCity }] : []),
      ...(gatePhotos > 0 ? [{ label: "Фото", value: String(gatePhotos) }] : []),
    ];
    return inEmbeddedOverlay(
      <div className={`flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10 ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <div className="animate-rise flex w-full max-w-md flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-honey font-brand text-[36px] font-semibold text-honey-text shadow-[0_18px_40px_-14px_rgba(51,41,28,0.4)]">
            3
          </span>
          <h2 className="mt-6 font-brand text-[24px] font-semibold leading-tight">
            {gateBiz ? `Сайт для «${gateBiz}» майже готовий` : "Ваш сайт майже готовий"}
          </h2>
          <p className="mt-2.5 text-[16px] leading-relaxed text-ink-muted">
            {gateConvId
              ? "Створіть акаунт, щоб зберегти його за вами — розмова продовжиться з того самого місця"
              : "Розмову не вдалося зберегти — після входу почнете з коротких питань"}
          </p>

          {/* What the chat already collected — nothing will be lost. */}
          {collected.length > 0 && (
            <div className="mt-5 flex w-full flex-col gap-2 rounded-[20px] border border-line bg-surface p-4 text-left shadow-card">
              {collected.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-bold uppercase tracking-wide text-ink-faint">
                    {row.label}
                  </span>
                  <span className="truncate text-[15px] font-semibold text-ink">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          <ul className="mt-5 flex w-full flex-col gap-1.5 text-left">
            {[
              "Безкоштовно — публікація нічого не коштує",
              "Без коду — все робить помічник",
              "Заявки клієнтів — одразу у ваш Telegram",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-[12px] text-ok"
                  aria-hidden
                >
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>

          {/* Google first (zero emails, Google-white per brand rules).
              Absolute app-host URL (M3) — /login does not exist on the
              marketing root; ?google=1 auto-triggers the OAuth action on the
              app host (see the comment above). */}
          <a
            href={appUrl(`/login?google=1&${gateQuery}`)}
            className="mt-6 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-[16px] border border-line-strong bg-surface px-7 text-[17px] font-bold text-ink shadow-[0_10px_28px_rgba(51,41,28,0.16)] transition-colors hover:bg-sunken"
          >
            <GoogleIcon size={20} /> Продовжити з Google
          </a>
          <a
            href={appUrl(`/login?${gateQuery}`)}
            className="mt-2.5 flex min-h-[52px] w-full items-center justify-center rounded-[16px] bg-brand px-7 text-[16px] font-bold text-white shadow-[0_8px_22px_rgba(51,41,28,0.18)] transition-colors hover:bg-brand-hover"
          >
            Пошта і пароль
          </a>
          <Button variant="quiet" size="md" className="mt-2" onClick={() => setPhase("chat")}>
            <ArrowLeft size={17} /> Назад до розмови
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — generating (design D)
  // ---------------------------------------------------------------------------

  if (phase === "generating") {
    // Real SSE stage data when the stream is delivering (V4, spec §7); the
    // plain elapsed-seconds clock (effect above) paces the fallback path and
    // the gap before the first stage event — steady progress, never finishing
    // early, never freezing.
    const { cards, msgIndex, barPct } = genCards(genElapsed, genStages);

    return inEmbeddedOverlay(
      <div className={`flex min-h-[100dvh] flex-col items-center justify-center px-8 ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <div className="flex w-full max-w-md flex-col items-center">
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full bg-honey font-brand text-[42px] font-semibold text-honey-text"
            style={{ animation: "ob-pulse 2.6s ease-in-out infinite" }}
          >
            3
          </span>
          <h2 className="mt-8 text-center font-brand text-[24px] font-semibold">Генеруємо ваш сайт…</h2>
          <p className="mt-3 text-center text-[17px] leading-relaxed text-ink-muted">
            {GEN_MESSAGES[msgIndex]}
          </p>

          <div className="mt-8 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
            <div
              className="relative h-2.5 overflow-hidden rounded-full bg-honey transition-all duration-1000 ease-out"
              style={{ width: `${barPct}%` }}
            >
              {/* Perpetual shimmer — the bar must never look frozen, even
                  while its width sits still between step ticks. */}
              <span
                className="absolute inset-y-0 left-0 w-1/3 bg-white/50"
                style={{ animation: "ob-shimmer 1.6s ease-in-out infinite" }}
                aria-hidden
              />
            </div>
          </div>

          <div className="mt-7 flex w-full flex-col gap-2.5">
            {cards.map((c) => (
              <GenStep key={c.key} state={c.status} leg={c.leg}>
                {c.label}
              </GenStep>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — success (design D). No "register to manage" link — flow removed.
  // ---------------------------------------------------------------------------

  if (phase === "done") {
    const displayUrl = siteUrl.replace(/^https?:\/\//, "");
    // Editor route key = tenant host (hostname strips the dev :port).
    let editHost = "";
    try {
      editHost = new URL(siteUrl).hostname;
    } catch {
      /* keep "" — the edit link just doesn't render */
    }
    return inEmbeddedOverlay(
      <div className={`relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <Confetti />
        <div className="animate-rise flex w-full max-w-md flex-col items-center text-center">
          <div className="animate-pop flex h-[72px] w-[72px] items-center justify-center rounded-full bg-honey text-honey-text shadow-[0_18px_40px_-14px_rgba(51,41,28,0.4)]">
            <PartyPopper size={34} />
          </div>
          <h2 className="mt-6 font-brand text-[26px] font-semibold">Ваш сайт готовий!</h2>
          <p className="mt-2.5 text-[17px] text-ink-muted">
            Він уже працює — безкоштовно — за адресою:
          </p>

          <Card className="mt-5 flex w-full flex-col gap-3.5 p-5">
            <span className="break-all text-center font-brand text-[18px] font-semibold text-ink">
              {displayUrl}
            </span>
            <div className="flex gap-2.5">
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-[54px] flex-[1.3] items-center justify-center rounded-[16px] bg-brand text-[16px] font-bold text-white shadow-[0_8px_22px_rgba(51,41,28,0.2)] transition-colors hover:bg-brand-hover"
              >
                Відкрити сайт ↗
              </a>
              <button
                onClick={copyUrl}
                className="flex h-[54px] flex-1 items-center justify-center rounded-[16px] border border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                {copied ? "Скопійовано ✓" : "Копіювати"}
              </button>
            </div>
          </Card>

          <p className="mt-3 text-[14px] text-ink-muted">
            Перегляньте сайт — фото й зображення можна замінити в редакторі.
          </p>

          {/* Domain step — the ONE paid step (owner decision 2026-08-06).
              Skippable: the site is already live on its subdomain. */}
          {draft && <DomainStep host={draft.host} />}

          <div className="mt-3.5 flex w-full items-center gap-3.5 rounded-[20px] border border-line bg-surface px-5 py-4 text-left shadow-card">
            <TelegramMark />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-extrabold text-ink">Наступний крок — Telegram</div>
              <div className="text-[14px] font-semibold leading-snug text-ink-muted">
                Підключіть Telegram, щоб заявки від клієнтів приходили прямо вам
              </div>
            </div>
            {tgLink ? (
              <a
                href={tgLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 shrink-0 items-center justify-center rounded-full bg-tg px-5 text-[15px] font-bold text-white transition-colors hover:bg-tg-dark"
              >
                Відкрити Telegram
              </a>
            ) : tgLink === null ? (
              <span className="flex min-h-11 shrink-0 items-center justify-center rounded-full bg-tg/60 px-5 text-[15px] font-bold text-white">
                Готуємо…
              </span>
            ) : (
              // Honest fallback: the link could not be minted (bot unset, or the
              // membership read failed). The sites list still carries the
              // connect button, so the owner is never stranded.
              <a
                href={appUrl("/sites")}
                className="flex min-h-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface px-5 text-[15px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                Мої сайти
              </a>
            )}
          </div>

          {/* Exits: the success screen must never be a dead end. */}
          <div className="mt-6 flex w-full flex-col gap-2">
            {editHost && (
              <a
                href={appUrl(`/edit/${editHost}`)}
                className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] border border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                <Pencil size={17} /> Редагувати сайт
              </a>
            )}
            <a
              href={appUrl("/sites")}
              className="flex min-h-11 items-center justify-center text-[15px] font-bold text-ink-muted transition-colors hover:text-ink"
            >
              Мої сайти →
            </a>
            {/* Embedded: every link above is cross-host — give the overlay a
                same-origin exit back to the landing (the conversation is done
                and its localStorage key already cleared). */}
            {embedded && (
              <Link
                href="/"
                className="flex min-h-11 items-center justify-center text-[15px] font-bold text-ink-muted transition-colors hover:text-ink"
              >
                На головну
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — error
  // ---------------------------------------------------------------------------

  return inEmbeddedOverlay(
    <div className={`flex min-h-[100dvh] flex-col items-center justify-center px-6 ${rootBase}`}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <div className="animate-rise flex w-full max-w-md flex-col items-center text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-danger-soft text-danger">
          <CircleAlert size={34} />
        </div>
        <h2 className="mt-6 font-brand text-[24px] font-semibold">Щось пішло не так</h2>
        <p className="mt-4 w-full rounded-[16px] bg-danger-soft px-5 py-4 text-[15px] font-semibold leading-relaxed text-danger">
          {errorMsg}
        </p>
        {errorMsg === CLAIMED_BY_OTHER_ERROR ? (
          // Retrying a claimed conversation refuses again by design — the only
          // honest way forward is the new conversation the copy promises.
          <Button size="lg" className="mt-6" onClick={startFreshConversation}>
            Почати нову розмову
          </Button>
        ) : (
          <Button size="lg" className="mt-6" onClick={() => void (draft ? handlePublish() : runGenerate())}>
            Спробувати ще раз
          </Button>
        )}
        {/* Never a dead end (plan should-fix): in embedded mode this screen
            covers the whole landing with body scroll locked — without an exit
            the only escape is a full reload. Returning to the chat keeps the
            conversation intact. */}
        <Button variant="quiet" size="md" className="mt-2" onClick={() => setPhase("chat")}>
          <ArrowLeft size={17} /> Назад до розмови
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small local sub-components + shared class strings
// ---------------------------------------------------------------------------

// Markdown-lite for agent replies: only **bold** is supported (the prompt
// forbids everything else). Built as React nodes — no HTML injection surface.
function renderBold(text: string): ReactNode[] {
  return text
    .split(/\*\*([^*]+)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

// Honey mark that fronts every assistant turn (bubble, typing, tool card) —
// the reference's assistant avatar. `busy` swaps in a spinning ring.
function AgentAvatar({ busy = false }: { busy?: boolean }) {
  return (
    <span
      className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-honey text-honey-text"
      aria-hidden
    >
      <Sparkles size={16} />
      {busy && (
        <span className="absolute inset-[-3px] animate-spin rounded-full border-2 border-honey border-t-transparent" />
      )}
    </span>
  );
}

function ChatBubble({ msg, streaming = false }: { msg: ChatMsg; streaming?: boolean }) {
  const isUser = msg.role === "user";
  const atts = msg.attachments ?? [];
  // SSE chunks land bursty; the smoothing hook types them out evenly.
  const shown = useSmoothText(msg.content, streaming && !isUser);
  if (!msg.content && atts.length === 0) return null;

  const body = (
    <>
      {atts.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${msg.content ? "mb-2.5" : ""}`}>
          {atts.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" className="h-24 w-24 rounded-[14px] object-cover" />
          ))}
        </div>
      )}
      {msg.content !== "" && (
        <p className="whitespace-pre-wrap">
          {isUser ? msg.content : renderBold(shown)}
          {streaming && !isUser && (
            <span aria-hidden className="animate-blink text-honey">
              ▍
            </span>
          )}
        </p>
      )}
    </>
  );

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="animate-pop max-w-[85%] rounded-[22px] rounded-br-[8px] bg-brand px-[18px] py-3.5 text-[17px] leading-relaxed text-white shadow-[0_6px_16px_rgba(51,41,28,0.14)] sm:max-w-[75%]">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <AgentAvatar />
      <div className="animate-rise max-w-[85%] rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-[18px] py-3.5 text-[17px] leading-relaxed text-ink shadow-[0_1px_2px_rgba(51,41,28,0.05)] sm:max-w-[75%]">
        {body}
      </div>
    </div>
  );
}

// Working indicator: an assistant bubble with three pulsing dots. Shown
// whenever a turn is in flight and no text has streamed yet — extended
// thinking and the plain pre-first-token wait are indistinguishable to the
// owner, so the dots claim nothing about which one it is (the honest
// «Думаю…» label survives for screen readers). Mutually exclusive with the
// live tool card (04 §2) at the call site: never two indicators at once.
function AgentTyping() {
  return (
    <div className="flex items-start gap-2.5" role="status">
      <AgentAvatar />
      <div className="flex items-center gap-1.5 rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-4 py-4 shadow-[0_1px_2px_rgba(51,41,28,0.05)]">
        {/* The honest label stays for assistive tech; sighted owners read the
            dots, which claim nothing about what the agent is doing. */}
        <span className="sr-only">Думаю…</span>
        <span className="h-2 w-2 animate-blink rounded-full bg-ink-faint [animation-delay:0ms]" aria-hidden />
        <span className="h-2 w-2 animate-blink rounded-full bg-ink-faint [animation-delay:200ms]" aria-hidden />
        <span className="h-2 w-2 animate-blink rounded-full bg-ink-faint [animation-delay:400ms]" aria-hidden />
      </div>
    </div>
  );
}

/** S4 QA tail note (V4): the honest running/done/skipped/interrupted line.
 *  Shown on the PREVIEW screen — where the owner actually is while the tail
 *  runs (settle() flips the phase before any s4 event) — and again in the chat
 *  if they navigate back. */
function GenQaNote({ qa, className = "" }: { qa: GenQaStatus; className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 text-[13px] font-bold text-ink-faint ${className}`}
      role="status"
    >
      {qa === "running" && (
        <span
          className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-honey border-t-transparent"
          aria-hidden
        />
      )}
      <span>
        {qa === "running"
          ? "Перевіряю тексти й контраст…"
          : qa === "done"
            ? "Готово, все перевірив"
            : qa === "skipped"
              ? "Перевірку пропущено"
              : "Перевірку не завершено"}
      </span>
    </div>
  );
}

function GenStep({
  state,
  leg = false,
  children,
}: {
  state: "done" | "active" | "pending" | "error";
  /** Parallel S2 sub-line («Пишу тексти» ∥ «Малюю оформлення») — indented. */
  leg?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 text-[16px] ${leg ? "pl-[26px]" : ""} ${
        state === "done"
          ? "font-bold text-ok"
          : state === "active"
            ? "font-bold text-ink"
            : state === "error"
              ? "font-bold text-danger"
              : "font-semibold text-ink-faint"
      }`}
    >
      {state === "done" ? (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ok-soft text-[11px]" aria-hidden>
          ✓
        </span>
      ) : state === "active" ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-[2.5px] border-honey border-t-transparent" aria-hidden />
      ) : state === "error" ? (
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-danger-soft text-[11px] text-danger"
          aria-hidden
        >
          !
        </span>
      ) : (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-line-strong" aria-hidden />
      )}
      <span>{children}</span>
    </div>
  );
}

function Confetti() {
  // Warm palette only: honey, deep ink, the soft-ok green — no leftover blue.
  const pieces = [
    { left: "16%", color: "#E9A23B", w: 10, h: 14, delay: 0, dur: 2.6 },
    { left: "38%", color: "#3A3128", w: 8, h: 12, delay: 0.4, dur: 3.1 },
    { left: "58%", color: "#177E53", w: 10, h: 10, delay: 0.8, dur: 2.8, round: true },
    { left: "80%", color: "#E9A23B", w: 8, h: 13, delay: 1.2, dur: 3.4 },
    { left: "27%", color: "#F2CE86", w: 9, h: 9, delay: 1.6, dur: 3, round: true },
    { left: "70%", color: "#3A3128", w: 9, h: 12, delay: 0.2, dur: 3.2 },
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-10 h-40" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: p.left,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: p.round ? 999 : 3,
            animation: `ob-confetti ${p.dur}s ease-in infinite ${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
