import { headers } from "next/headers";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CHAT_MODEL } from "@/lib/ai/anthropic";
import { stripLoneSurrogates, safeSlice, sanitizeMessages } from "@/lib/ai/sanitize";
import {
  onboardTools,
  applySaveFacts,
  buildOnboardSystem,
  computeProgress,
  buildFactsSummary,
  sanitize,
  sanitizeInboundMessage,
  historyToMessages,
  scrapeInstagramInput,
  analyzeImageInput,
  setMediaRoleInput,
  DATA_TOOL_NAMES,
  START_GENERATION_TOOL_NAME,
  hasContactChannel,
  COLLECTING_FLOOR_MSG,
  CONFIRMED_FLOOR_MSG,
  type ChatMsg,
  type OnboardAccum,
} from "@/lib/ai/onboard";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { validateFacts } from "@/lib/onboard/validate";
import { selectGaps } from "@/lib/onboard/gaps";
import { getVertical } from "@/lib/verticals/registry";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";
import { canonicalizeContactFacts } from "@/lib/blocks/contact-links";
import {
  MAX_PHOTOS,
  MAX_PHOTO_META,
  mediaSchema,
  photoIdFor,
  sanitizeMedia,
  type SiteMedia,
  type PhotoMeta,
} from "@/lib/media/media";
import { isEligiblePhoto, rankPhotoUrls } from "@/lib/media/rank";
import { scrapeInstagramDeep } from "@/lib/ig/deep";
import { getLatestSnapshot, type IgSnapshot } from "@/lib/ig/snapshots";
import { buildDossier } from "@/lib/dossier";
import { analyzePhoto } from "@/lib/media/analyze-photo";
import { isApifyConfigured } from "@/lib/ig/apify";

/**
 * Agentic onboarding turn (refactor 04 §2; W0 «вільний агент», plan 2026-08-07
 * §0). Per user turn the model loops until it stops calling data tools: it can
 * scrape Instagram, analyze photos, sort photo roles, fetch URLs (Anthropic
 * server tool) and save facts. `start_generation` is TERMINAL: the owner
 * explicitly agreed to generate, the loop ends and the client starts the
 * existing generate flow. Modeled on the editor-chat loop; Sonnet 5 API surface
 * (adaptive thinking, output_config.effort, task_budget beta) fixes the old
 * budget_tokens 400.
 *
 * SSE events: {t:"think"} thinking started · {t:"tool",name,label} a tool began ·
 * {t:"d",text} text delta · {t:"generate"} the model called start_generation —
 * the client must invoke the runGenerate flow (auth gate included); ALWAYS
 * followed by {t:"final"} · {t:"final",message,facts,verticalId,ready,confirmed,
 * quickReplies,progress,media} · {t:"error",message}.
 * Refusals (rate limit / over-long chat) come back as plain JSON, not a stream.
 */

export const maxDuration = 300;

const MAX_ROUNDS = 4; // real tool rounds (task_budget paces within them)
const MAX_ITERATIONS = 10; // hard cap incl. pause_turn (web_fetch) resumes
const MAX_BODY_BYTES = 128 * 1024;
const ANALYZE_CONCURRENCY = 4;

function maxChatMessages(): number {
  const n = Number.parseInt(process.env.RATE_LIMIT_CHAT_MAX_MESSAGES ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

// Ukrainian status-chip labels for tool lifecycle (the owner watches the agent
// work, not a spinner — 04 §2 "the honest inverse of gap #1").
const TOOL_LABELS: Record<string, string> = {
  scrape_instagram: "Зазираю у ваш Instagram…",
  analyze_image: "Розглядаю фото…",
  web_fetch: "Читаю сторінку…",
  set_media_role: "Сортую фото…",
  save_facts: "Занотовую…",
  [START_GENERATION_TOOL_NAME]: "Запускаю створення сайту…",
};

function parseBody(body: unknown): {
  history: ChatMsg[];
  facts: Partial<BusinessFacts>;
  verticalId?: string;
  media: SiteMedia;
  conversationId?: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages) || b.messages.length > maxChatMessages() + 1) return null;
  const history: ChatMsg[] = [];
  for (const m of b.messages) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    // C1 (plan 2026-08-07 §8а): user text is capped + surrogate-stripped;
    // assistant text passes through byte-identical (it is our own model's
    // output — slicing it made the model's view diverge from the persisted
    // transcript and the model echoed the truncated text back). The old
    // 4000-char cut landing inside an emoji also left a lone surrogate that
    // 400'd the WHOLE next Anthropic call — stripping stays for both roles.
    history.push({ role, content: sanitizeInboundMessage(role, content) });
  }
  const factsParsed = businessFactsSchema.partial().safeParse(b.facts ?? {});
  if (!factsParsed.success) return null;
  const verticalId = typeof b.verticalId === "string" ? b.verticalId.slice(0, 40) : undefined;
  // Uploaded media feeds the dossier's photo inventory (untrusted → sanitized).
  const media = b.media != null && mediaSchema.safeParse(b.media).success
    ? sanitizeMedia(b.media)
    : { photos: [] };
  const conversationId =
    typeof b.conversationId === "string" && b.conversationId.trim()
      ? b.conversationId.trim().slice(0, 64)
      : undefined;
  // The client re-sends the accumulated facts every turn, so a conversation
  // started BEFORE identity canonicalization would keep replaying its old
  // «https://www.instagram.com/x» through the agent forever. Canonicalizing at
  // the boundary repairs those in place on the next message; values that do not
  // normalize are byte-identical, so nothing the owner said is ever rewritten.
  return {
    history,
    facts: canonicalizeContactFacts(factsParsed.data),
    verticalId,
    media,
    conversationId,
  };
}

const dedupe = (arr: string[]): string[] => [...new Set(arr)];
const idOf = (m: PhotoMeta): string => m.id ?? photoIdFor(m.url);

/** Upsert a photoMeta entry by url (later fields win). */
function upsertMeta(list: PhotoMeta[], entry: PhotoMeta): PhotoMeta[] {
  const i = list.findIndex((m) => m.url === entry.url);
  return i === -1 ? [...list, entry] : list.map((m, j) => (j === i ? { ...m, ...entry } : m));
}

export async function POST(req: Request): Promise<Response> {
  // Rate limit + size caps BEFORE parsing (an abuser costs neither CPU nor tokens).
  const limit = await checkRateLimit("chat_turn", ipFromHeaders(await headers()));
  if (!limit.ok) return Response.json({ t: "refusal", message: rateLimitMessage(limit.retryAfterSec) });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ t: "refusal", message: "Запит завеликий." }, { status: 413 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ t: "refusal", message: "Запит завеликий." }, { status: 413 });
  }

  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    /* handled below */
  }
  const parsed = parseBody(json);
  if (!parsed) return Response.json({ t: "refusal", message: "Некоректний запит." }, { status: 400 });
  const { history, facts, verticalId, conversationId } = parsed;

  if (history.length > maxChatMessages()) {
    return Response.json({
      t: "refusal",
      message:
        "Ця розмова вже дуже довга. Якщо кнопка «Створити сайт» вже зʼявилась — тисніть її, або почніть нову розмову.",
    });
  }

  const transcript = historyToMessages(history);
  if (transcript.length === 0) {
    return Response.json({ t: "refusal", message: COLLECTING_FLOOR_MSG });
  }

  // Request-scoped mutable state — tools mutate it; the final event ships it back.
  let media: SiteMedia = parsed.media;
  let snapshot: IgSnapshot | null = conversationId
    ? await getLatestSnapshot({ conversationId })
    : null;
  const accum: OnboardAccum = {
    facts,
    verticalId: getVertical(verticalId).id,
    status: "collecting",
    quickReplies: [],
  };
  const apifyEnabled = isApifyConfigured();
  const ip = ipFromHeaders(await headers());

  const client = getAnthropic();

  // --- Tool handlers (fail-open: partial/empty result beats throwing). ---

  async function runScrape(input: unknown): Promise<string> {
    const p = scrapeInstagramInput.safeParse(input);
    if (!p.success) return "Не впізнав нікнейм чи посилання Instagram — попросіть власника надіслати ще раз.";
    if (!apifyEnabled) return "Instagram-імпорт зараз недоступний.";
    // Per-tenant scrape limit BEFORE Apify spend (keyed by conversation, IP fallback).
    const rl = await checkRateLimit("ig_scrape", conversationId ?? ip);
    if (!rl.ok) return "Ліміт запитів до Instagram вичерпано — спробуйте пізніше або розкажіть про бізнес самі.";
    try {
      const res = await scrapeInstagramDeep({ handle: p.data.handle, conversationId });
      // Merge returned media (dedupe by url). Owner-uploaded logo wins over avatar.
      let photoMeta = media.photoMeta ?? [];
      for (const m of res.media.photoMeta) photoMeta = upsertMeta(photoMeta, m);
      photoMeta = photoMeta.slice(0, MAX_PHOTO_META);
      const logoUrl = media.logoUrl ?? res.media.logo;
      // Feed order is not quality order: an import arrives newest-first, so the
      // MAX_PHOTOS cut used to keep whatever the owner posted last. Rank the
      // freshly imported batch by the vision score (wave A) before it competes
      // for slots; photos already on the site keep their place at the front.
      const eligible = rankPhotoUrls(
        res.media.photoMeta
          .filter(isEligiblePhoto)
          .map((m) => m.url)
          .filter((u) => u !== logoUrl),
        res.media.photoMeta,
      );
      const photos = dedupe([...media.photos, ...eligible])
        .filter((u) => u !== logoUrl)
        .slice(0, MAX_PHOTOS);
      media = { ...media, ...(logoUrl && { logoUrl }), photos, photoMeta };
      // Feed the fresh scrape into the dossier rebuilds this turn.
      snapshot = {
        id: snapshot?.id ?? "",
        conversationId: conversationId ?? null,
        tenantId: null,
        handle: res.parsed.handle,
        raw: null,
        parsed: res.parsed,
        scrapedAt: new Date().toISOString(),
      };
      return res.digest || "Не вдалося витягти дані з Instagram.";
    } catch (e) {
      // Loud log (prod debugging: a silent catch here hid the real scrape
      // failure behind the model's improvised «збережу ваш профіль»).
      console.error(
        `[onboard] scrape_instagram failed for ${p.data.handle}: ${e instanceof Error ? e.message : e}`,
      );
      return "ПОМИЛКА: не вдалося відкрити Instagram-профіль (тимчасова технічна помилка). ЧЕСНО скажи власнику, що зазирнути не вийшло, і запропонуй: спробувати ще раз (виклич scrape_instagram повторно) або розповісти основне самому. НЕ вдавай, що профіль збережено.";
    }
  }

  async function runAnalyze(input: unknown): Promise<string> {
    const p = analyzeImageInput.safeParse(input);
    if (!p.success) return "Некоректний запит на аналіз фото.";
    const meta = media.photoMeta ?? [];
    const targets = p.data.photoIds
      .map((id) => meta.find((m) => idOf(m) === id))
      .filter((m): m is PhotoMeta => Boolean(m));
    if (targets.length === 0) return "Не знайшов фото з такими id.";

    const analyzed: { url: string; result: Awaited<ReturnType<typeof analyzePhoto>> }[] = [];
    for (let i = 0; i < targets.length; i += ANALYZE_CONCURRENCY) {
      const chunk = targets.slice(i, i + ANALYZE_CONCURRENCY);
      const rs = await Promise.all(
        chunk.map(async (m) => ({ url: m.url, result: await analyzePhoto(m.url) })),
      );
      analyzed.push(...rs);
    }

    let photoMeta = media.photoMeta ?? [];
    let photos = media.photos;
    const lines: string[] = [];
    for (const { url, result } of analyzed) {
      if (!result) {
        lines.push(`- ${photoIdFor(url)}: не вдалося проаналізувати.`);
        continue;
      }
      photoMeta = upsertMeta(photoMeta, {
        url,
        id: photoIdFor(url),
        kind: result.kind,
        // §3-S0 deterministic palette, piggybacked on the analysis byte fetch
        // (chat-upload path). Spread only when present so an import-time
        // palette already on the meta survives a paletteless re-analysis.
        ...(result.palette?.length && { palette: result.palette }),
        ...(result.alt && { alt: result.alt }),
        ocrText: result.ocrText,
        textHeavy: result.textHeavy,
        extractedInfo: result.extractedInfo,
        useOnSite: result.useOnSite,
        siteQuality: result.siteQuality,
        subjectCentered: result.subjectCentered,
        burnedText: result.burnedText,
        heroCandidate: result.heroCandidate,
        ...(result.warnings.length && { warnings: result.warnings }),
      });
      // A text-heavy/unsuitable image leaves the visible gallery (still an info source).
      if (result.useOnSite === false) photos = photos.filter((u) => u !== url);
      const ocr = result.ocrText ? ` OCR:"${safeSlice(result.ocrText, 80)}"` : "";
      lines.push(
        `- ${photoIdFor(url)} [${result.kind}, наСайт:${result.useOnSite ? "так" : "ні"}]${
          result.alt ? ` ${result.alt}` : ""
        }${ocr}`,
      );
    }
    media = { ...media, photos, photoMeta };
    return lines.join("\n");
  }

  function runSetRole(input: unknown): string {
    const p = setMediaRoleInput.safeParse(input);
    if (!p.success) return "Некоректний запит на роль фото.";
    const meta = media.photoMeta ?? [];
    const entry = meta.find((m) => idOf(m) === p.data.photoId);
    if (!entry) return "Не знайшов фото з таким id.";
    const url = entry.url;
    const role = p.data.role;
    const photoMeta = upsertMeta(meta, { url, id: idOf(entry), role });
    let photos = media.photos;
    let logoUrl = media.logoUrl;
    if (role === "logo") {
      logoUrl = url;
      photos = photos.filter((u) => u !== url);
    } else if (role === "text_source" || role === "hidden") {
      photos = photos.filter((u) => u !== url);
    } else if (role === "site") {
      if (!photos.includes(url) && photos.length < MAX_PHOTOS) photos = [...photos, url];
    }
    media = { ...media, ...(logoUrl && { logoUrl }), photos, photoMeta };
    const label =
      role === "logo" ? "лого" : role === "site" ? "у галерею" : role === "text_source" ? "як джерело тексту" : "приховано";
    return `Ок: фото ${p.data.photoId} — ${label}.`;
  }

  async function runDataTool(name: string, input: unknown): Promise<string> {
    if (name === "scrape_instagram") return runScrape(input);
    if (name === "analyze_image") return runAnalyze(input);
    if (name === "set_media_role") return runSetRole(input);
    return "Невідомий інструмент.";
  }

  const enc = new TextEncoder();
  const rs = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const apiMessages: Anthropic.Beta.BetaMessageParam[] = transcript.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      let finalText = "";
      let sawText = false;
      // The model called start_generation (terminal, plan C2/C7): emit
      // {t:"generate"} before {t:"final"} so the client starts runGenerate.
      let generateRequested = false;
      // Last-built system prompt — reused by the no-tools "speak up" call below.
      let lastSystem = "";

      try {
        let rounds = 0;
        let iterations = 0;
        while (rounds < MAX_ROUNDS && iterations < MAX_ITERATIONS) {
          iterations += 1;
          const vertical = getVertical(accum.verticalId);
          const dossier = buildDossier({
            facts: accum.facts,
            media,
            snapshot,
            transcript,
          });
          // Data-shaped gaps, recomputed each round for the same reason: a
          // scrape that just landed 12 photos and a bio can close a gap (or
          // open one) mid-turn. The detector is pure and budget-aware — it
          // returns [] once the owner has been asked twice, said «just do it»,
          // or agreed to generate, so a gap can never turn into an interrogation
          // and never gates start_generation.
          const gaps = selectGaps({
            facts: accum.facts,
            media,
            dossier,
            transcript,
            status: accum.status,
          });
          // System is rebuilt each round so the model sees its own scrape/analyze
          // results (mutated media + fresh snapshot flow into the dossier).
          const system = buildOnboardSystem({
            vertical,
            facts: accum.facts,
            dossier,
            issues: validateFacts(accum.facts, vertical).map((i) => i.note),
            apifyEnabled,
            gaps,
          });
          lastSystem = system;

          const stream = client.beta.messages.stream({
            model: CHAT_MODEL,
            max_tokens: 8000,
            thinking: { type: "adaptive" },
            output_config: { effort: "medium", task_budget: { type: "tokens", total: 40000 } },
            betas: ["task-budgets-2026-03-13"],
            // Strip lone surrogates (emoji cut mid-pair by our excerpt slices) —
            // an unpaired surrogate anywhere in the body is a hard 400 (§sanitize).
            system: stripLoneSurrogates(system),
            tools: onboardTools,
            messages: sanitizeMessages(apiMessages),
          });

          let roundHasText = false;
          for await (const ev of stream) {
            if (ev.type === "content_block_start") {
              const cb = ev.content_block;
              if (cb.type === "thinking") {
                send({ t: "think" });
              } else if (cb.type === "tool_use" || cb.type === "server_tool_use") {
                send({ t: "tool", name: cb.name, label: TOOL_LABELS[cb.name] ?? "Працюю…" });
              }
            } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              if (!roundHasText && sawText) {
                finalText += "\n\n";
                send({ t: "d", text: "\n\n" });
              }
              roundHasText = true;
              sawText = true;
              finalText += ev.delta.text;
              send({ t: "d", text: ev.delta.text });
            }
          }

          const final = await stream.finalMessage();

          // Server web_fetch may pause the turn — resume WITHOUT consuming a round.
          if (final.stop_reason === "pause_turn") {
            apiMessages.push({ role: "assistant", content: final.content });
            continue;
          }
          rounds += 1;

          // Fold every save_facts (last-wins) — the "commit".
          for (const b of final.content) {
            if (b.type === "tool_use" && b.name === "save_facts") {
              Object.assign(accum, applySaveFacts(b.input, accum));
            }
          }

          const toolUses = final.content.filter(
            (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
          );
          const dataUses = toolUses.filter((b) => (DATA_TOOL_NAMES as readonly string[]).includes(b.name));
          const generateNow = toolUses.some((b) => b.name === START_GENERATION_TOOL_NAME);
          // C7 backstop where the signal is minted: start_generation without a
          // business name + contact channel must NOT become {t:"generate"} —
          // the client's runGenerate gate would reject it one render later and
          // the UI would contradict itself. The model gets a corrective
          // tool_result and another round to ASK for the missing requisite.
          const canGenerate =
            Boolean(accum.facts.businessName?.trim()) && hasContactChannel(accum.facts);
          if (generateNow && canGenerate) generateRequested = true;
          const startGenerationResult = canGenerate
            ? "OK: запуск підтверджено"
            : "НЕ запущено: бракує назви бізнесу або контакт-каналу (телефон / Instagram / Telegram / Viber). Збережи відоме через save_facts і попроси, чого бракує, одним коротким питанням.";

          // No data tools this round → the turn is done (save_facts already folded).
          // Close the tool loop first (save_facts/start_generation still need
          // their tool_result) so the "speak up" continuation below can extend
          // this conversation.
          if (dataUses.length === 0) {
            if (toolUses.length) {
              apiMessages.push({ role: "assistant", content: final.content });
              apiMessages.push({
                role: "user",
                content: toolUses.map(
                  (tu): Anthropic.Beta.BetaToolResultBlockParam => ({
                    type: "tool_result",
                    tool_use_id: tu.id,
                    content:
                      tu.name === START_GENERATION_TOOL_NAME ? startGenerationResult : "OK: збережено",
                  }),
                ),
              });
            }
            // A rejected start_generation gets one more round (bounded by
            // MAX_ROUNDS) so the model can ask instead of the UI flapping.
            if (generateNow && !canGenerate) continue;
            break;
          }

          // Round-trip: execute data tools (parallel), answer EVERY tool_use (the
          // API requires it), then continue so the model sees the results.
          apiMessages.push({ role: "assistant", content: final.content });
          const dataResults = await Promise.all(
            dataUses.map(async (tu) => ({ id: tu.id, text: await runDataTool(tu.name, tu.input) })),
          );
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) =>
            (DATA_TOOL_NAMES as readonly string[]).includes(tu.name)
              ? {
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content: dataResults.find((r) => r.id === tu.id)?.text ?? "Нема даних.",
                }
              : {
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content:
                    tu.name === START_GENERATION_TOOL_NAME ? startGenerationResult : "OK: збережено",
                },
          );
          apiMessages.push({ role: "user", content: results });

          // start_generation on a round that ALSO ran data tools is NOT
          // terminal: `media` is mutated in-place by the handlers, but
          // `accum.facts` only changes through save_facts — breaking here
          // would generate from facts the model never got to commit. Keep
          // generateRequested latched and give the model the next round to
          // fold the scrape/analyze results; a tool-free round breaks above.
        }

        // W0: enforceReadyGate is DELETED (plan C7 — the phone-required gate
        // silently reset ready→collecting and deadlocked the CTA). The model's
        // status + start_generation ARE the readiness signal; the server-side
        // backstop lives in generateDraftAction (name + contact channel).
        if (generateRequested && accum.status !== "confirmed") accum.status = "confirmed";
        let message = sanitize(finalText);

        // Model-always-speaks (owner decision): a tool-only turn gets ONE extra
        // no-tools call so the reply is the model's own voice — deterministic
        // strings below are only the API-failure floor.
        if (!message) {
          try {
            apiMessages.push({
              role: "user",
              content:
                "(службова примітка: твоя минула відповідь не мала тексту — напиши ЗАРАЗ повідомлення власнику українською, без викликів інструментів)",
            });
            const speak = client.beta.messages.stream({
              model: CHAT_MODEL,
              max_tokens: 2000,
              thinking: { type: "adaptive" },
              output_config: { effort: "low" },
              system: stripLoneSurrogates(lastSystem),
              tools: onboardTools,
              tool_choice: { type: "none" },
              messages: sanitizeMessages(apiMessages),
            });
            for await (const ev of speak) {
              if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
                finalText += ev.delta.text;
                send({ t: "d", text: ev.delta.text });
              }
            }
            await speak.finalMessage();
            message = sanitize(finalText);
          } catch {
            /* canned floor below */
          }
        }

        // NO question-append guard here (owner decision): «скиньте посилання»
        // is a perfectly good turn-ender without a «?», and a code-appended
        // second ask reads as two conflicting requests. The prompt owns the
        // one-ask-per-turn rule; code only floors total silence below.
        // Deterministic floor — only reachable when the speak-up call itself
        // failed. Status-aware, and HONEST (plan C2): the confirmed floor must
        // never claim generation started — only the {t:"generate"} signal (the
        // client auto-starts on it) or the owner's button starts it.
        if (!message) {
          // «Запускаю…», not «Починаю збирати…»: the route is auth-blind — an
          // anonymous visitor hits the login gate next, so the copy may only
          // claim the SIGNAL was sent (the client owns the honest gate line).
          message = generateRequested
            ? "Запускаю створення сайту."
            : accum.status === "confirmed"
              ? CONFIRMED_FLOOR_MSG
              : accum.status === "ready"
                ? buildFactsSummary(accum.facts)
                : COLLECTING_FLOOR_MSG;
        }

        // The terminal start_generation signal — BEFORE final so the client can
        // flip into the generating state, while final still delivers the
        // authoritative facts/media it generates from.
        if (generateRequested) send({ t: "generate" });

        send({
          t: "final",
          message,
          facts: accum.facts,
          verticalId: accum.verticalId,
          ready: accum.status !== "collecting",
          confirmed: accum.status === "confirmed",
          // Mirrors the {t:"generate"} event (same field as the non-stream
          // fallback's OnboardTurnResult) so a client that missed the event can
          // still see the signal on final.
          generate: generateRequested,
          quickReplies: accum.quickReplies,
          progress: computeProgress(accum.facts),
          media: {
            photos: media.photos,
            ...(media.logoUrl && { logoUrl: media.logoUrl }),
            ...(media.photoMeta?.length && { photoMeta: media.photoMeta }),
          },
        });
      } catch {
        send({ t: "error", message: "Щось пішло не так. Спробуйте ще раз." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(rs, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
