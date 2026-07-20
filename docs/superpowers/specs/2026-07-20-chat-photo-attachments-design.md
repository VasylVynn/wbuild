# Chat photo attachments — attach-then-send

Date: 2026-07-20 · Status: approved by owner · Scope: onboarding chat composer

## Problem

Wave G shipped immediate single-photo upload: picking a file in the onboarding
chat uploads, analyzes and routes it at once, blocking the chat. Owner feedback:
photos must **attach to the composer (several at a time) and be sent only when
the send button is pressed** — messenger-style.

## Design (approved)

### 1. Attaching

- The paperclip opens a file dialog with `multiple`. Picked files do NOT hit the
  server — they become local pending attachments: a thumbnail strip (with ✕
  remove) above the input row. More files can be attached before sending.
- Cap: 8 files per message; extra picks are dropped with an inline hint.
- Send button is enabled when there is text OR attachments. Paperclip stays
  disabled while a turn is in flight.

### 2. Sending

On send, in order (owner picked variant A — aggregated summary):

1. A user bubble appears immediately: text + thumbnail grid (local object URLs,
   swapped for storage URLs once uploaded).
2. All photos process **in parallel** (client compress → `POST /api/upload` →
   `analyzePhotoAction`), with a transient progress card
   («Роздивляюсь фото… X з N»).
3. Routing per photo is unchanged (logo → header, work/interior/menu/person →
   gallery + meta, unsuitable → refusal, analysis failure → fail-open plain
   gallery add), but the result is ONE aggregated assistant summary message
   («Лого поставив у шапку. Два фото додав у галерею (3 з 8). Одне не
   підходить: …»).
4. Review screenshots → a QUEUE of confirmation cards, shown one at a time
   (save/decline advances the queue). Invariant №5 unchanged: OCR text is a
   candidate until the owner confirms; the author field shows exactly what will
   be saved.
5. If the message had text — a normal streamed agent turn follows the summary.
   If photos only — no agent turn; the summary (+ cards) is the response.

### 3. Model-facing contract

- `ChatMsg` gains `attachments?: string[]` (storage URLs).
- `prepareOnboardCall` maps history to `{role, content}` and, when a message
  has attachments, appends a count marker («[надіслано N фото]») to the
  content — never the URLs. Models still never see photo URLs (§4.8 grounding
  stays deterministic). Empty-text photo messages become marker-only content
  (Anthropic rejects empty text blocks).
- The aggregated summary is persisted in history but EXCLUDED from the model
  call of the same turn (the media inventory in the system prompt already
  reflects the new uploads — G4). Later turns include it; consecutive
  same-role messages are fine for the API.
- `/api/onboard` `parseBody` carries a validated `attachments` array
  (strings, ≤8 per message) so the marker survives the API path.

### 4. Persistence

- Same single-write pattern as wave G: ONE `saveTurn` carries the summary
  message AND the updated media; the agent turn's `applyResult` save passes the
  same media explicitly. No racing `saveMediaAction`.
- `saveTurn` filters message attachments through `isStorageUrl` (defense in
  depth) before persisting; resume renders the thumbnails from storage URLs.

### 5. Failure handling

- Per-photo upload failure → a line in the summary («одне фото не вдалося
  завантажити»); the failed photo drops from the bubble's attachments.
- Analysis failure → fail-open: plain gallery add, no meta (unchanged).
- Pool overflow (MAX_PHOTOS=8) → a line in the summary.
- All uploads failed, no text → the summary degrades to a single error line.

### 6. Out of scope

The media step (PhotoField grid), generation pipeline, vision layer
(`analyze-photo.ts`), `/api/upload`, and the editor remain untouched.
`components/editor/PhotoField.tsx` / `EditorShell.tsx` hold a parallel
session's uncommitted changes — not touched.

## Success criteria

- Live E2E (Playwright, lvh.me): attach logo+menu+review in ONE batch with
  text → one user bubble with 3 thumbnails, one aggregated summary, a review
  card, then a streamed agent reply; photos-only send works without an agent
  turn; thumbnails survive reload.
- `npx tsc --noEmit` and `npm run build` green.
