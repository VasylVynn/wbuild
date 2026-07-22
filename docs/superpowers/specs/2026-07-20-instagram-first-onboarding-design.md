# Instagram-first onboarding — link → scrape → confirm → gap-fill

Date: 2026-07-20 · Status: approved by owner · Scope: onboarding chat (wave E redesign)

## Problem

The original wave E treated Instagram as a side-feature: the agent asks for a
handle mid-conversation and *offers* an import. Owner pivot: our core persona
(florist / bakery / salon in Ukraine) has no site but an active Instagram —
the import should be the OPENING move. Paste a link, we learn the business
ourselves, then only ask for what Instagram doesn't have.

## Design (approved)

### 1. UX flow

- Greeting invites both paths: «Розкажіть трохи про бізнес — **або просто
  надішліть посилання на ваш Instagram**, я витягну все сам» (+ quick-reply
  chip «У мене є Instagram» → agent asks for the link).
- User sends a link/handle → **blocking spinner card** in the chat (input
  disabled) with real stages: «Відкриваю профіль… → Читаю пости… → Розкладаю
  фото…» (~1–2 min). Owner chose blocking over fire-and-continue: simpler and
  it *feels* honest («he is really looking at my profile right now»).
- Done → ONE aggregated assistant message: what we learned (name, bio→about,
  services/prices from captions, city if present) + what we routed (logo,
  N gallery photos, menu photos, review screenshots → OCR confirm cards) +
  question «Все вірно?» (quick replies «Так, все вірно» / «Хочу виправити»).
- Extracted facts land in factsPatch immediately (visible in progress chips +
  SitePreviewPanel); corrections ride the normal last-wins conversation.
- Then the agent asks ONLY the gaps (phone, hours, address — Instagram rarely
  has them) and never re-asks what the import already filled. From there the
  standard flow: ready summary → confirm → media step (pre-filled) → generate.
- Mid-chat path: if a handle surfaces later in free text (agent saves
  `facts.instagram`), a deterministic button «Підтягнути з Instagram» appears —
  same pipeline.
- Fail-open: no IG / private profile / Apify down / timeout → soft message
  («Не вдалося зазирнути у профіль — нічого страшного, розкажіть самі…») and
  the classic conversation continues. No APIFY_API_TOKEN → the feature is
  never mentioned anywhere (greeting rule is token-conditional).

### 2. Architecture (max reuse of wave G)

- `lib/ig/apify.ts` — client for the `apify/instagram-profile-scraper` actor:
  async run start → status polling → dataset fetch. Extracts bio, full name,
  avatar, 10–15 latest posts (reels: cover image as a photo, caption as text).
  Token via lazy env read, never logged. Every failure → null (fail-open).
- New SSE route `/api/ig-import` (same SSE pattern as `/api/onboard`, extended
  `maxDuration`): streams progress stages, final event carries the payload.
  Server actions (15s ceiling) can't host a 1–2 min pipeline.
- Per photo: `lib/media/import.ts` → `importExternalImage(url, {conversationId})`
  — fetch (timeout, 8MB cap, image mime) → sharp qualityPass → our Storage
  bucket → publicUrl. §4.8 holds automatically (everything served is ours).
  Then the EXISTING vision layer (`analyzePhoto`, wave G) classifies each
  image, and the EXISTING client `routeBatch` routes: logo (only if none
  uploaded yet) / gallery (cap 8) / menu / review→OCR confirm card / reject.
- New LLM extraction pass `lib/ig/extract.ts`: bio + captions → factsPatch
  candidates (businessName, about, services with prices, city) with a strict
  anti-invention rule — only what is literally written, no guessing; phones
  and requisites are NOT extracted (asked explicitly in chat instead).
- Rate limit: new LimitName `ig_import` (~10/day per IP).
- Client trigger: regex-detect an instagram.com URL / bare @handle in the sent
  message → run the import INSTEAD of a normal agent turn (the message stays
  in history); otherwise the «Підтягнути» button path.

### 3. Invariants & cost

- Invariant №5 (no invented facts): everything extracted is a CANDIDATE the
  owner confirms — immediate «Все вірно?» + the existing pre-generation
  summary gate (wave A6). Requisites (phone) are still asked explicitly.
- §4.8: photos only from the profile the user themselves provided, through our
  Storage pipeline; the model never sees photo URLs.
- Cost: ~$0.01–0.05 Apify + 10–15 vision calls ≈ up to ~2–3 грн per
  onboarding; accepted by owner (now near-every onboarding, not on demand).

### 4. Cut (YAGNI) / kept from old wave E

- Cut: reels as video, scrape resume after page reload, re-import from the
  editor (later).
- Kept: site rendering of the IG link (contacts button, template footers,
  `sameAs` already reads `facts.instagram` since D2), `.env.example` +
  Vercel env (`APIFY_API_TOKEN`; absent → feature silently off).

## Testing

- tsc + build; Playwright E2E of the greeting-link path with a real token
  (blocked until the owner provides `APIFY_API_TOKEN` — flagged), fail-open
  E2E without/with an invalid token; extraction sanity pass on fixture
  bio/captions; invariant check: generated site contains only storage URLs.
