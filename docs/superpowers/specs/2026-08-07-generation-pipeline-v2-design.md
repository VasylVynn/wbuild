# Generation Pipeline v2 — Design Brief як артефакт, різноманіття як система

> **Дата:** 2026-08-07. **Статус:** v2 — після adversarial-рев'ю (6 лінз, 45
> must-fix внесено). Чекає затвердження власником.
> **Мета власника (сесія 2026-08-07):** «great production experience with great
> different website landings that are beautiful with animations, with proper
> images, proper palette, and different even between regenerating for the same
> business with the same incoming data». Рівень — Lovable-відчуття в нашій
> data-driven архітектурі.
> **Джерела:** 9-агентна розвідка кодбази + 6-лінзове рев'ю 2026-08-07;
> docs/architecture-brief.md (журнал 2026-07-27 «wireframe-only», 2026-07-28
> «QA gate»); docs/generation-quality-plan.md (waves A–D — ВЖЕ в коммітах
> 60692c4, 1a971be, 08aee9b); docs/superpowers/plans/2026-08-07-landing-chat-first-plan.md;
> спайк docs/superpowers/specs/2026-07-27-wireframe-styling-spike.md.

## 0. Межі та тверді факти

- НЕ повертаємо вибір шаблонів/тем/пресетів (рішення 2026-07-27 стоїть; один
  wireframe salonwire). НЕ даємо моделі писати код/markup. НЕ headless-браузер
  у QA (рішення 2026-07-28).
- **БД: wipe/реструктуризація ДОЗВОЛЕНІ** (рішення власника 2026-08-07:
  наявні orders/tenants — тестові, реальних користувачів не було; стару
  структуру і флоу підтримувати не треба). Рев'ю-застереження знято
  свідомо. При цьому wipe НЕ обов'язковий: усі нові поля v2 — опційні в
  jsonb. Migration 0010 пишемо там, де вона реально спрощує: contentRev
  у page-content (§9), progress-store для /api/generate (§7), nonce-RPC
  (§4); чистка тестових tenants — окремим кроком у V2 (з wipe падає і
  сумісність із «можливо незастосованими» міграціями — 0010 фіксує clean
  slate: всі 0001–0010 застосовані, fail-open-толерантність до відсутніх
  таблиць лишається тільки для ig_snapshots).
- Landing-chat план виконується своїми хвилями; перетини файлів — явно
  скоординовані в §11 (це виправлення: попередня версія хибно заявляла
  «не перетинаємось»).

## 1. Ре-літигація журналу #45 (шрифти + motion) — потрібен підпис власника

Рішення 2026-07-27 видалило design-DNA разом зі шрифт-парами і motion. Його
обґрунтування (незасіяний шаблон, кардинальність-1 кольору) шрифтів/motion не
стосувалось. v2 повертає обидві осі в новій механіці:

- **Шрифти:** кураторський whitelist пар (пул — 14 cyrillic-сімей, що ВЖЕ
  завантажуються: 12 у TENANT_FONT_CLASSES + Manrope/Unbounded з root-layout;
  lib/fonts.ts:49-63, :23-25). Вибір — у Brief. **Інʼєкція — НЕ в CSS-рядок**
  (рев'ю: префікс у wireCss гине при audit-regen, при `...(wireCss && ...)`
  і при 60К-slice з хвоста) — а **на рендері з designSpec** (§3-S3).
  Code-gate: css-lint додає `--font-heading`/`--font-body` у strip-set +
  тест. Обґрунтування (актуалізоване під inline-механізм): inline-стиль
  виграє каскад у звичайних правил, але модельне `--font-*` з `!important`
  його б'є, а `:root`-селектори проходять crop-скоупінг НЕзачепленими
  (css-lint.ts:146-155) і мають глобальний резон — тож strip-set
  необхідний, не «про запас»; плюс сторонні `--font-*` засмічують
  audit-поверхню.
- **Motion:** рівень 0–3 у Brief; носій — data-атрибут на `.tpl-salonwire`,
  який wrapper читає з **designSpec у page content** (НЕ з колонки
  tenants.brand — це різні речі: TemplateBrand — рендер-проп із page
  content; інваріант 6 цілий). Механіка в wire.css. **Рев'ю-факт:** уся
  scroll-reveal сидить за `@supports (animation-timeline: view())` — на
  двигунах без підтримки рівні были б нерозрізненні. Тому рівні 2–3
  отримують support-незалежний шар: load-entrance @keyframes (крім hero —
  LCP-інваріант «hero ніколи не анімується на першому пейнті», wire.css:282),
  hover-хореографія, transition-тайминги; scroll-stagger лишається
  прогресивним підсиленням. Stagger потребує НОВИХ селекторів до дітей
  грідів (`.wire-grid-3 > *` + animation-delay/ranges) — окремий пункт V3.

Власник 2026-08-07 явно запросив «custom styling, animations, palettes» —
фіксуємо як рішення; журнальний рядок у architecture-brief додається у V5.

## 2. Що вже є (будуємо на цьому)

Waves A–D закоммічені: photo vetting, hue-вікна (дані), hero-варіанти
split/mirror/banner (seeded fallback + model override + banner-veto),
CSS-motion, збагачений buildStyleBrief. Seeded-механіка designNonce →
designSeed → mulberry32. Варіантна механіка generic (registry → промпт →
resolvedVariant → PageRenderer). QA-контур lint→contrast→audit + inspect,
fail-open. Шрифтова інфраструктура-сирота жива. vitest працює (98 тестів,
node-only — БЕЗ jsdom: CSS/markup ним не покрити; CLAUDE.md «no test suite»
застарів — виправити у V5). `lib/ai/hero-variant.test.ts` — закоммітити ДО
V1 (зараз untracked, guard на один git clean від смерті).

## 3. Архітектура v2

```
Факти + media (чат / IG)
  │
  ├─ S0 GROUNDING (детерм., бюджет ≤5с, fail-open → hue-вікно вертикалі)
  ├─ S1 DESIGN BRIEF (1 виклик, thinking, ≤40с) → designSpec
  ├─ S2а CSS ═╗ паралельно (allSettled, НЕ Promise.all), обидві ≤120с
  ├─ S2б БЛОКИ ═╝ sectionPlan ОБОВ'ЯЗКОВИЙ для S2б (див. нижче)
  ├─ S3 КОМПІЛЯЦІЯ (детерм.): lint ДО персисту + assemble + reconcile + запис
  │        → ПРЕВ'Ю ПОКАЗУЄТЬСЯ ТУТ (TFAO-точка)
  └─ S4 QA — ПІСЛЯ прев'ю, поза критичним шляхом, патчить через CAS
       (потім after(): images, як сьогодні)
```

**S0 Grounding.** Per-photo палітра: `@material/material-color-utilities`
(ВЖЕ в package.json — QuantizerCelebi + Score, не винаходимо своє) поверх
sharp-байтів. **Рев'ю-фікси:** екстракція з CORRECTED буфера (сьогодні
analyzeImage біжить паралельно з correctImage на оригіналі — upload
route.ts:31, import.ts:78-87, де результат взагалі викидається) —
послідовно після корекції; результат `palette?: string[]` їде через
**шість символів** (V1 шукає за символами, не рядками — рев'ю-нота):
PhotoMeta + photoMetaSchema (lib/media/media.ts), siteScopedPhotoMeta
(там само), meta-збірка deep.ts, upsertMeta (app/api/onboard/route.ts:116 —
chat-upload шлях), MediaInventoryItem + її .map у lib/dossier.ts.
importExternalImage розширює повернення (сьогодні `string|null`). Лого — окрема alpha-aware
гілка (kind='logo' минає quality pass). generated/ виключені. Агрегат —
pure-функція біля rank.ts, зважено photoScore. Durable-дім —
facts_state.media (є); fallback-перерахунок з бакета — В МЕЖАХ S0-бюджету
5с (≤12 GET + sharp; при перевищенні — fail-open), НЕ «сотні мс».

**S1 Design Brief.** Вхід: dossier + палітра-кандидати + seeded-пропозиції
+ whitelist-и + **стислий опис wireframe-можливостей** (перелік секцій і
їхніх варіантів — НЕ повний сорс; рев'ю: наосліп план не скласти). Вихід
(tool use, zod; НЕ строгий SO — «grammar too large»):

```
positioning { promise, painPoints[], tone, voiceNotes }
palette     { bg, surface, ink, accent, accentInk }      ← hex-ЯКОРІ (див. нижче)
typography  { pairId }                                    ← enum whitelist
sectionPlan [{ section, variant, budgetHint }]            ← ОБОВ'ЯЗКОВИЙ
motion      { level: 0|1|2|3, notes }
imagery     { treatment, heroPhotoId? }
```

`rationale` — ОКРЕМИЙ top-level ключ `designRationale` у PageContent +
запис у DRAFT_ONLY (рев'ю: DRAFT_ONLY стрипає лише top-level ключі —
page-content.ts:53/:60; вкладене поле опублікувалось би).

**Валідація S1 кодом:** pairId ∈ whitelist; variant ∈ registry; палітра —
контраст-перевірка + детермінований ремонт ролей; **факт-гейт** (рев'ю:
дірка інваріанта 5): S1 отримує той самий анти-вигадування system-рядок,
що generateSite, + детермінований пост-чек — promise/painPoints/voiceNotes
з числами, датами, тривалостями («10 років», «цілодобово») чи
контакто-подібними рядками, яких нема в confirmed facts, — стрипаються.
S1 fail → v1-шлях (buildStyleBrief) БЕЗ brief-полів, рендер тотальний на
`designSpec === undefined` (дефолт-пара + motion=1 — константи в коді).

**sectionPlan — ОБОВ'ЯЗКОВИЙ, не порада** (рев'ю-консенсус трьох лінз:
інакше S2а стилізує композицію-фантом). S2б отримує план як завдання;
відхилення дозволені ТІЛЬКИ в межах зареєстрованих варіантів запланованих
секцій. Порядок енфорсу зафіксований: перевірка застосовується до
МОДЕЛЬНИХ блоків ПЕРЕД force-інʼєкціями assemble (lead_form, contacts,
gallery-інʼєкція — вони поза планом легітимно, інваріант 8 цілий);
зворотний запис sectionPlan бере ПІСЛЯ-інʼєкційну композицію. Свобода
композиції переїжджає в S1 (він для цього і бачить можливості wireframe).

**Палітра — якір, не диктат** (рев'ю design-quality: жорсткі ролі проти
живого SYSTEM-промпту, який сьогодні прямо забороняє «стандартні набори» —
wire-style.ts:33 — знизили б якість). Ролі подаються S2а в манері hue-якоря:
«збудуй палітру навколо цих ролей; тон/нюанси — твої». SYSTEM-промпт
(рядки 32-33, 56-60) переписується узгоджено — це частина V2, не деталь.
Авторитет фінальних кольорів: model CSS → fixContrast-ремонти (вони —
істина, adherence-чек у S4 толерантний до них).

**S2а/S2б паралельно через allSettled** (рев'ю: Promise.all при падінні
S2а вбив би готовий S2б). Контракт часткових провалів: S2а fail → prevWireCss
(тільки для повторної генерації — publish.ts:98; перша генерація деградує
в сірий каркас, чесно кажемо); S2б fail → чесна помилка і НІЧОГО не
персистимо (§10-міф «жодна помилка не лишає без чернетки» ВИДАЛЕНО — його
і сьогодні нема: publish.ts:313). Вартість втраченого S2а при цьому
приймаємо (retry перекуповує).

**S3 Компіляція (детермінована, ~0с моделей):**
1. **lintWireCss ДО першого персисту** (рев'ю-критикал: сьогодні сирий
   модельний CSS лягає в draft_content ДО лінту, QA-цикл fail-open з
   трьома early-return — незалінчений sheet публікується; url()-дірка
   РЕАЛЬНА). Плюс `url(` додається в BLOCKED sanitizeCss (другий шар,
   сьогодні відсутній — SalonWireWrapper.tsx:20-27).
2. assemble() як є + reconcile: sectionPlan-енфорс (вище) і зворотний
   запис — designSpec.sectionPlan перезаписується ФАКТИЧНОЮ зібраною
   композицією (рев'ю: force-інʼєкції/дропи assemble неминуче розходяться
   з планом; зберігаємо істину, S4 не карає легітимні розходження).
3. charBudget-клампи (патерн clampSeo; НЕ zod .max — overshoot не сміє
   дропнути блок).
4. designSpec + designRationale пишуться в PageContent. **Шрифти/motion у
   CSS НЕ записуються** — рендер читає designSpec (нижче).
5. Прев'ю віддається користувачу (це TFAO-точка).

**Рендер-протяжка designSpec (рев'ю: «безкоштовно» було міфом — читачі
hand-pick):** правки у V2-списку: lib/tenant/types.ts (Page), data.ts:59-66
(mapPage), edit/actions.ts (EditorData + getEditorData), lib/templates/
registry.ts (TemplateBrand.designSpec), brand.ts (buildTemplateBrand),
обидва call-сайти (app/s/[host]/…/page.tsx, edit/[host]/frame/page.tsx) +
SalonWireWrapper: ставить data-motion і `--font-*` inline-стилем з
designSpec. **Editor-parity:** EditorShell сьогодні НЕ інжектить wireCss
і не має TENANT_FONT_CLASSES (рев'ю) — власник превʼював би не той сайт;
виправлення у V3.

**S4 QA — після прев'ю, поза TFAO** (рішення з рев'ю-питання: тільки так
TFAO<2хв і глибина QA сумісні). Механіка: **onboard = 1 inspect-раунд
(MAX_FIXES 2) + style-audit ≤1 corrective regen; editor = тільки
style-audit (0 текст-раундів)** — одна таблиця в §6, числа НЕ дублюються
деінде. Adherence-виміри: brief-тон у inspect; палітра/шрифт у audit —
audit отримує designSpec НОВИМ ПАРАМЕТРОМ, corrective regen ре-ассертить
палітру-якорі замість голого altHue. Бюджет S4 — ВЛАСНИЙ (S4-локальний,
не chain-час): ≤150с, corrective regen стартує тільки якщо в S4-бюджеті
лишається ≥120с (вміщає один CSS-виклик). Якщо QA пропущено дедлайном —
`qa_skipped_deadline` у styleAudit (адмінка бачить). Патчі — ТІЛЬКИ через
CAS (див. §9-contentRev). Publish людський і зазвичай пізніше за S4;
якщо власник тисне раніше — публікується поточний стан (fail-open, як
сьогодні з відкладеними images).

## 4. Різноманіття — seeded-осі

| Вісь | Roll | Обмеження |
|---|---|---|
| hue-якір | `:hue` (є) | вікна вертикалі |
| font-пара | `:font` | whitelist, ваги по вертикалях |
| варіанти секцій | `:variant:<id>` | registry |
| motion-рівень | `:motion` | 0–3, ваги по вертикалях |
| brief-напрям | `:direction` | 3–4 «кути подачі» (сіємо кут, не стиль) |

Seeded значення → Brief як пропозиція-дефолт; модель відхиляє з
обґрунтуванням. Семантика — відрізнятись від попереднього (A→B→A ок).
Кортеж-guard: порівнюємо **pre-S1 seeded ПРОПОЗИЦІЇ** (дешево, без другого
S1 — рев'ю-фікс); збіг (font, variant-вектор, hueBucket) → один
додатковий roll.

**designNonce — атомарний** (рев'ю-критикал: read-modify-write розтягнутий
на ~2хв; дві паралельні генерації одного хоста → ідентичні сіди на ВСІХ
осях): інкремент через RPC/jsonb_set З ПОВЕРНЕННЯМ значення ДО S0;
деривація факторизується в lib/design/seed.ts (зараз зфоркана publish.ts:92
/ edit-actions.ts:297). **brand пишеться спредом** (рев'ю: generateDraft
перебудовує brand по полях — логотип, виставлений під час генерації,
зникав би; publish.ts:198-214 vs logo-actions.ts:46-58); інваріант
spread-what-you-read розширюється на brand (§10).

## 5. Варіанти секцій + силует

Розширення wave B (markup + locked-CSS + registry; стилює generated sheet):

- services: grid (є) / list / **cards-with-photo** — фото-варіант вимагає
  genServicesSchema з photoId + casting в assemble (рев'ю: photoId-каст
  існує тільки для hero/gallery; model-URL стрипається) — окрема таска V3
- gallery: grid (є) / masonry / stream
- testimonials: cards (є) / big-quote / strip
- cta: band (є) / centered-card;  process: timeline (є) / numbered-cards
- **НОВЕ (рев'ю design-quality: найгучніший same-y сигнал — силует):**
  nav: split (є) / centered-brand; footer: 4-col (є) / 2-col / single;
  вісь ширини: contained (є) / full-bleed для 1–2 секцій

**Repeat-cap фікс (рев'ю-критикал):** сьогодні наявність варіантів робить
секцію повторюваною ×2 (generate.ts:643-645) — п'ять нових варіантних
секцій означали б дві CTA-смуги на сторінці. ДО додавання варіантів:
`repeatable?: boolean` на TemplateSectionDef, розв'язаний від variants
(повторювані: gallery, testimonials; НЕ повторювані: hero, cta, lead_form,
contacts, nav, footer) + vitest.

PAIRS (css-contrast) на нові класи — плюс тест «кожен варіант-клас
sections.tsx має ≥1 PAIRS-запис» (рев'ю: ручна синхронізація зогниє
першою). UNREACHABLE_TYPES: switchback/richText вже поза промптом —
рішення connect-or-delete у V3, не «прибрати з промпта».

## 6. Латентність — чесна таблиця

Прев'ю (TFAO) = S0+S1+max(S2а,S2б)+S3. S4 — після прев'ю.

| Стадія | Бюджет | Деградація |
|---|---|---|
| S0 | ≤5с | без палітри → hue-вікно |
| S1 | ≤40с | v1-brief, дефолт шрифт/motion |
| S2а ∥ S2б | ≤120с (кожна) | S2а→prevWireCss/сірий; S2б→чесна помилка |
| S3 | ~0 | — |
| **TFAO** | **≤165с worst, ~100–130с типово** | план <2хв: ✓ |
| S4 onboard | ≤150с S4-ЛОКАЛЬНИХ, після прев'ю; 1 inspect-раунд + audit; regen лише при залишку ≥120с | skip + `qa_skipped_deadline` |
| S4 editor | тільки style-audit | те саме |

Механіка: chain-signal (TFAO-частина) створюється НА ПОЧАТКУ generateDraft
(рев'ю: зараз S0-еквівалент поза дедлайном); S4 має окремий власний signal.
Кожна стадія — `AbortSignal.any([chain, timeout(stage)])` (рев'ю: один
глобальний signal означав, що «fallback» стартує з нульовим залишком).
**Ретраї на S2-ногах ВИМКНЕНІ** (per-call maxRetries 0): одна спроба 120с
= весь бюджет стадії, другої не вміщає — 429/збій одразу йде в деградацію
(рев'ю-нота: «ретрай у бюджеті стадії» був арифметично неможливий).
Editor-шлях: chain-deadline додається (сьогодні signal=undefined). Токени: S2а-вхід росте з варіантами wireframe (~35К сорсу вже) —
V3 міряє і або підіймає max_tokens, або шле лише вибрані sectionPlan-ом
варіанти. Три стелі розміру CSS зводяться до одного контракту
(sanitizeCss 60К / audit 80К / 16К токенів) з репортом у styleAudit.

## 7. Прогрес: транспорт, якого «вже є» НЕ було

Рев'ю-критикал: generateDraft живе в awaited server action — стрімити
нема звідки; «SSE-патерн /api/onboard» до генерації не причетний, а
полінг без progress-store сліпий (draft-рядок з'являється в кінці).

Рішення: **новий authed POST /api/generate (SSE), maxDuration=300**, куди
переїжджають з generateDraftAction: auth-гейт, onboard_generate ліміт,
saveDraftHost, trackFunnel. **M1 claim-gate: V2 готує тільки hook-point у
/api/generate; сам гейт імплементує W2 вже в новому модулі** (один
власник, один напрям — рев'ю-фікс). Події: `stage {name, status, detail?}`
для s0…s4. Плюс **progress-store** (стовпчик/рядок стадії, пишеться на
межах стадій): потрібен НЕ для краси, а для M12-регідрації — крос-хостовий
handoff означає, що чат, який стартував генерацію, може бути іншим
документом на іншому origin; картки стадій відновлюються з нього при
маунті. `images` У СТРІМІ НЕМАЄ (after() живе після відповіді —
publish.ts:284); чат дізнається полінгом draft-рядка по genToken.
Fallback-транспорт: той самий progress-store полінгом.

## 8. Уніфікація generateDraft/regenerateSite

Один модуль lib/site/pipeline.ts, `mode: 'onboard' | 'editor'`. **Явний
write-контракт по полях** (рев'ю: шляхи РІЗНІ, і це не деталі):

| Поле | onboard | editor |
|---|---|---|
| pocket | `[]` (нова сторінка) | накопичує старі блоки (…slice(-40)) — ЗБЕРЕГТИ, інакше мовчазне видалення власницьких блоків |
| genToken | мінтить | **мінтить теж** (сьогодні дропає — і це єдиний захист від старої image-job; уніфікація закриває дірку свідомо, CAS-історія — §9) |
| generatedHero | з media | з oldDraft |
| brand | СПРЕД + свої поля | спред (є) |
| draft_content | спред-райд усіх нових полів | **спред oldDraft** (сьогодні field-by-field — дропає навіть genToken) |

## 9. Цілісність запису: contentRev

Рев'ю-критикал: genToken — ідентифікатор генерації, НЕ версія; QA-цикл
пише блоки БЕЗ CAS і без перевірки error (inspect.ts:536-541), stale-запис
воскрешає старий genToken і знову «оживляє» чужі CAS-писці. v2 вводить
**`contentRev: number` у PageContent** — монотонний, інкрементується
кожним писцем; ВСІ async-писці DRAFT-копії (QA-блоки, QA-стиль, S4-патчі,
image-job-драфт-патч) CAS-яться на ньому з **coalesce-семантикою для
до-v2 рядків**: `coalesce((draft_content->>'contentRev')::int, 0) = N`
(рев'ю: інакше NULL ніколи не матчиться і всі писці мовчки вмирають
назавжди). contentRev — у DRAFT_ONLY (внутрішній ключ, published-копії
не потрібен); патчі PUBLISHED-копії (image-job) лишаються на genToken-CAS
як сьогодні. genToken лишається як «чия генерація». Migration 0010
бекфілить contentRev=0 на наявні рядки (застосовується вручну, як усі).
Тести: stale-write не воскрешає токен; два конкурентні пайплайни одного
хоста не інтерлівляться; до-v2 рядок приймає перший CAS-запис.

## 10. Інваріанти (чек-лист рев'ю кожної хвилі)

Один registry; факти §5 (звужений план-W0 сенс) + string-пост-валідація
+ **S1-факт-гейт (§3)**; lead_form force-injection; draft/published split
(designSpec їде published, designRationale — DRAFT_ONLY); canonicalHostname;
№1 no-foreign-images (**lint до персисту + url( у sanitizeCss**); publish
human-only (publish копіює designSpec — окремого cache-event не треба:
шлях лише через publish); middleware без Postgres; fail-open стадій S0/S1/
S2а/S4 (S2б — чесна помилка); **contentRev-CAS для всіх async-писців**;
spread-what-you-read для draft_content **І brand**; hero не анімується
на першому пейнті (LCP); контент видимий без JS.

## 11. Хвилі (мульти-агентно; V-хвилі перетинаються з W-хвилями ЯВНО)

Порядок: **W0 → V1 → V2 → {V3 ∥ W1} → W2 → V4 → V5 → W3-залишки.**
Колізії назвами: `app/app/new/actions.ts` — W0 (зняття гейтів) → V2
(переїзд у pipeline.ts + /api/generate; M1-гейт W2 приземляється ВЖЕ в
новому модулі — план W2 ребейзиться); `OnboardChat.tsx` — W1 (embedded-
рефакторинг) ПЕРЕД V4 (картки стадій пишуться під нову структуру; C6
має одного власника — V4, з плану W3 він вилучається). Прекондиція V1:
закоммітити hero-variant.test.ts. Кожна хвиля: git status-синхронізація
з паралельною сесією; tsc + build + vitest + незалежний код-рев'ю.

- **V1. Дані й осі** (~1.5 дня): палітра (6 символів §3-S0, corrected-
  buffer, material-color-utilities, importExternalImage), лого-гілка,
  агрегатор, seeded-осі + атомарний nonce-RPC + факторизація,
  font-whitelist модуль (14 сімей, ваги; замінює висячий референс
  lib/fonts.ts:17 на неіснуючий lib/theme/font-pairs.ts), brand-спред у
  generateDraft. Vitest на детерміноване.
- **V2. Brief + pipeline.ts + транспорт** (~2.5–3 дні, серце): designSpec-
  схема + S1 + валідація/факт-гейт; PageContent.designSpec/designRationale/
  contentRev (+coalesce-CAS); **migration 0010** (contentRev-бекфіл,
  progress-store, nonce-RPC, чистка тестових tenants; застосувати вручну);
  **рендер-протяжка (8 правок §3)**; SYSTEM-промпт wire-style переписаний
  під палітру-якорі; sectionPlan-енфорс + reconcile + **charBudget-клампи**
  у S3 (споживач budgetHint — інакше сирота до V5); lint-до-персисту +
  url( у sanitizeCss + **css-lint strip-set для `--font-*` + тест**;
  allSettled S2 (ретраї ніг вимкнені); уніфікація pipeline.ts
  (write-контракт §8); /api/generate SSE + progress-store + перенос гейтів
  (M1 — тільки hook-point); стадійні сигнали §6; перевірка ITPM/OTPM-лімітів
  орга під паралельні S2. businessFactsSchema: city/phone → optional +
  contact-channel backstop (координація з W0; аудит ~22 споживачів
  facts.phone/city).
- **V3. Wireframe** (~2–2.5 дні, координація з паралельною сесією):
  варіанти §5 включно з nav/footer/width, repeatable-флаг ДО них,
  genServicesSchema, motion-рівні (support-незалежний шар + stagger-
  селектори до дітей грідів), PAIRS + тест, UNREACHABLE_TYPES
  connect-or-delete, editor-parity — **desktop-режим EditorShell**
  (wireCss-інʼєкція + TENANT_FONT_CLASSES; tablet/mobile-iframe вже
  коректний — рев'ю-уточнення), токен-замір S2а. Playwright-скріншоти
  замість vitest для CSS (node-only обмеження).
- **V4. Прогрес-UI** (~1 день, ПІСЛЯ W1): картки стадій у чаті з SSE +
  регідрація з progress-store (M12), заміна GEN_STEPS-театру.
- **V5. QA + чистки** (~1 день): adherence у audit (designSpec-параметр)
  + inspect, StyleAuditReport + адмін-колонка (adherence-поле),
  qa_skipped_deadline, стелі CSS-розміру, вестигії (factPaths
  connect-or-delete, стейл-коментарі), CLAUDE.md (тести!) +
  architecture-brief журнал.
- **Фінальна верифікація:** 3 бізнеси × 3 регенерації → Playwright-
  скріншоти (десктоп+мобайл, `lvh.me`): різні палітри/шрифти/варіанти/
  motion/силует між регенами; контраст; лід-форма; publish; edge-кеш;
  editor-parity; браузер без scroll-timeline (motion-рівні відрізняються).
  Живий прогін власником.

## 12. Питання власнику (з рекомендаціями)

1. **S4 після прев'ю** (інакше TFAO<2хв недосяжний — рев'ю-математика §6):
   ок? Рекомендація: так; publish майже завжди пізніший за S4.
2. **designSpec публікується** (мінус designRationale)? Рекомендація: так.
3. **Анти-повтор:** differ-from-previous + кортеж-guard досить? Рек.: так.
4. **Font-пул:** стартуємо з наявних 14 сімей? Рек.: так, розширення —
   дані. (Рев'ю-нота: з locked-силуетом типографіка несе левову частку
   відмінності — тому nav/footer-варіанти §5 важливіші за 15-й шрифт.)
5. **Motion-покриття:** приймаємо scroll-linked тільки Chromium/Safari-26+,
   з support-незалежним шаром для рівнів 2–3? Рек.: так.
6. **Editor-регенерація:** отримує 240с-дедлайн (сьогодні безлімітна)?
   Рек.: так, з чесним тостом при аборті.

## 13. Ризики

- Паралельна сесія в salonwire/generate.ts — V1/V3 синхронізуються по
  git status перед стартом; вузькі комміти.
- S1 — нова точка відмови → повний v1-fallback + тотальний рендер без
  designSpec.
- Палітра з поганих фото → бруд: кандидати-не-диктат, фото-поріг
  photoScore, hue-вікно як підстраховка.
- Токени: +S1 (~2–4К) + ширший S2а-вхід після V3 — заміри в V3, ~+15–20%
  вартості генерації.
- Регресії A–D: hero-variant.test.ts (закоммічений) + нові vitest на осі
  + Playwright-прогін у верифікації.
- Дві генерації одного хоста конкурентно: закрито atomic-nonce + contentRev
  (тести в V2).
