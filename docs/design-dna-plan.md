# План: design-DNA — виконання (хвилі DNA-1…DNA-4)

> **Джерело:** `docs/section-library-research.md` (adversarially validated, 2026-07-20).
> **Рішення власника 2026-07-20:** Фаза 0 (legal-гігієна) ПРОПУЩЕНА. Наслідки: Preline free
> і tweakcn НЕ використовуються до валідації їхніх ліцензій (у двадцятці — fallback MIT-джерела);
> `THIRD_PARTY_NOTICES.md` обовʼязковий з ПЕРШОЮ портованою секцією (початок DNA-2).
> Пріоритет хвиль: DNA-1 → DNA-2 (хвилями по 4–5 секцій) → DNA-3 → DNA-4 (постійний темп).

## Хвиля DNA-1 — Typography-фікс (P0) + DNA-ядро (~3–4 дні)

- [x] **DNA1.1. Шрифтові пари** — `lib/theme/font-pairs.ts`: 8–10 пар із `next/font/google`,
      `subsets: ["cyrillic"]`, усі `preload: false` + `display: "swap"` (дефолтна пара платформи
      лишається preload:true в root layout). Кандидати: Manrope+Inter, Montserrat+Rubik,
      Lora+Source Sans 3, PT Serif+Inter, Cormorant Garamond+Manrope (verify-first ґєії),
      Unbounded+Inter, Nunito+Nunito Sans, Playfair Display+Jost, Golos Text+Golos Text.
      Кожна пара — render-чек українського тексту (ґ є і ї) до включення. DM Sans виключений
      (нема кирилиці).
- [x] **DNA1.2. Tenant shell wiring** — `app/s/[host]/layout.tsx` вішає variable-класи всіх
      сімей; `FONT_STACK` → var-референси на реально завантажені сімʼї (legacy-ролі
      display/serif/rounded/sans мапляться на дефолтні завантажені сімʼї — старі пресети
      ПОЧИНАЮТЬ рендерити обіцяні шрифти); `themeSchema` + optional `fontPairId`
      (назад-сумісно, без SQL). FOUT обраної пари — свідомо прийнятий, заміряти на E2E.
- [x] **DNA1.3. DNA-ядро** — `lib/theme/dna.ts`: fnv1a + mulberry32, тип `DesignDNA`
      (bundleId?, presetId, fontPairId, radius, skinOverrides, motionId, decorId?, designNonce),
      персист optional-полями theme-JSON у `draft_theme` (Publish копіює draft→published як зараз).
      Пресети отримують метадані СІМʼЇ (тепла/холодна/нейтральна/землиста/контрастна).
- [x] **DNA1.4. Seeded lottery** — `randomSkin`/`randomPack` приймають `rng: () => number`
      (UWAGA: `lib/blocks/skins.ts` — ownership-зона паралельної сесії, git status перед правкою);
      generate/assemble використовують seeded rng з DNA; `lottery:false` поважається.
- [x] **DNA1.5. Re-roll механіка** — server action «перегенерувати дизайн»: інкремент
      designNonce → новий DNA, гарантія розбіжності Фази 1 (сімʼя палітри + шрифтова пара;
      hero-архетипи додадуться в DNA-2), draft-only (інваріант №6). UI-кнопка в редакторі —
      ЯКЩО EditorShell вільний від чужих правок; інакше — самодостатня панель + гачок,
      а хвиля тестує через dev-скрипт.
- [x] **DNA1.6. Motion-пресети** — 3 CSS-first пресети (none / fade-up / stagger),
      IntersectionObserver + CSS transitions, `prefers-reduced-motion`, видимість без JS
      (уроки H5); data-атрибут на shell, привʼязка до DNA.motionId.
- [x] **DNA1.7. Distinctness-скрипт (гейт Фази 1)** — dev-скрипт: N=6 генерацій однієї
      вертикалі з тих самих даних → скріншот-сітка; критерій Фази 1: пари шрифтів і сімʼї
      палітр візуально різняться між усіма прогонами.

> Верифікація хвилі: tsc, build, живі Playwright-скріншоти tenant-сайту ДО/ПІСЛЯ
> (шрифти реально вантажаться — перевірити network/computed styles), adversarial review,
> нотатки відхилень тут.

## Хвиля DNA-2 — Hero-архетипи + перша двадцятка + бандли (10–14 днів)

### Підхвиля DNA-2.А (поточна): архетипи + бандли + композиційна вісь

- [x] **DNA2.1. 5 hero-архетипів** — нові skins у `components/blocks/Hero.tsx`, re-authoring
      структур з MIT-джерел (HyperUI/Flowbite/TailGrids), лише токени var(--color-*/font-*/radius),
      ≥4 світлі, КОЖЕН з чесним no-photo станом (decor-фон, не primary band):
      `photo-scrim` (full-bleed фото+скрім), `editorial` (типографічний світлий, photo-poor герой),
      `split-light` (асиметричний спліт на світлому), `card-overlay` (картка поверх фото),
      `visit-card` (світла «візитка», CTA-ряд). Один агент = один файл.
- [x] **DNA2.2. Реєстрація + NOTICES** — skins у `blockSkins` (інтегратор), UA-лейбли;
      `THIRD_PARTY_NOTICES.md` з першими джерелами структур.
- [x] **DNA2.3. Стильові бандли** — `lib/design/bundles.ts`: 4 бандли (сімʼя палітр 2–3 пресети,
      fontPairId, heroArchetype, НАВМИСНО різні skin-сети решти блоків, photoPoorSet, verticalIds);
      rollDna v2: бандл → preset із сімʼї, пара з бандла; гарантія re-roll = інший бандл
      (⇒ інший hero+skin-set) + інша сімʼя + інша пара; фото-інвентар обирає photoPoorSet.
- [x] **DNA2.4. Композиційна вісь** — post-pass в assemble: skins/variants з allowlist бандла
      (seeded), seeded shuffle середніх секцій classic-шляху; склад секцій лишається data-driven.
- [x] **DNA2.5. Вживлення** — generateAndPublish/reroll застосовують бандл (тема+skins);
      бандл заміняє randomPack, коли для вертикалі є бандли; pack-шлях лишається fallback.
- [x] **DNA2.6. Гейт 3-осьовий** — dna-check v2 (бандл+сімʼя+пара), N=8 (2×бандли),
      скріншот-сітка, критерій «жодна пара не читається як той самий сайт».
- [x] **DNA2.7. Верифікація підхвилі** — tsc/build/живі скріншоти архетипів (з фото і без),
      adversarial review, нотатки.

### Наступні підхвилі DNA-2 (після 2.А)

- [ ] Хвилі по 4–5 секцій із двадцятки (партиціонування: один агент = один block type;
      skins.ts — один інтегратор); блок `team` окремо (новий block type, повна процедура).
- [ ] Visual-regression baseline (Playwright skin×breakpoint + diff; сюди ж браузерна
      перевірка hydration-флешу MotionDriver — борг з рев'ю DNA-1).

## Хвиля DNA-3 — Смакові множники (2–3 дні)

- [ ] logo→palette (`@material/material-color-utilities`, snap до curated preset, AA-guard);
      decor-токени (5–6 CSS-прийомів); presets → 25+ із сімʼями.

## Хвиля DNA-4 — Постійний темп

- [ ] ~0.5–1 день/секція з QA+baseline; +0.5 дня/бандл; ціль 60+ skins, 12+ бандлів/квартал.

> **Нотатка хвилі DNA-1 (2026-07-20, gate + знахідки):** Логічний гейт DNA1.7 —
> `/api/dev/dna-check` (dev-only): 6 ланцюгових ролів, 0 порушень (кожен рол міняє і
> СІМʼЮ палітри, і пару шрифтів). Візуальна сітка: 3 застосовані стани на
> `wave-dna-smoke.lvh.me` — палітри міняються наскрізно. ЗНАХІДКА (чесний борг у DNA-2):
> на PACK-сайтах mined-скіни несуть власні шрифти (Poppins тощо), які перекривають
> `--font-heading` — вісь пари шрифтів зараз ПОВНІСТЮ видима лише на legacy-скінах
> (перевірено: Playfair на kvity-oksany) і не пробиває pack-скіни. Це підтверджує
> дизайн-рішення DNA-2: бандли замінюють паки, скіни де-фонтяться до var(--font-*).
> Дрібне: steps у dna-check клампиться до min=2 (steps:1 повертає 2 роли) — косметика.
> Смоук-тенант wave-dna-smoke.lvh.me — у чистку разом з попередніми.

> **Нотатка хвилі DNA-1 (adversarial review, виправлено):** codex дав 4 must-fix + 10 should-fix.
> Виправлено: (1) switchTheme/switchDesignPack/regenerateSite стирали fontPairId+dna з draft_theme —
> тепер геном переноситься через carryDnaFields (preset оновлюється, пара/motion/нонс-історія живуть);
> (2) dna-check: apply-мутації замкнені на *.lvh.me (спільна Supabase — NODE_ENV не є authz-межею),
> steps:1 дозволений (скріншот-сітка покроково), published-запис задокументований як свідомий dev-only
> виняток; (3) publish.ts падає голосно при помилці pre-read (замість тихого скидання нонса в 0);
> (4) MotionDriver: cleanup знімає mo-armed (контент не застрягає прихованим), справжній stagger через
> transitionDelay з драйвера (CSS nth-child-трюк не працював), CSS заскоуплений під [data-motion];
> (5) forward-compat: невідомий motionId деградує в "none" через zod .catch, межі на nonce/fontPairId,
> дедуп пулу пресетів, «інша сімʼя» деградує в «інший preset» при невідомій сімʼї попередника.
> Прийнято свідомо: неатомарний read-before-upsert нонса (прееxisting RMW-патерн repo; наслідок гонки —
> двічі той самий DNA, останній запис виграє — нешкідливо для one-click UI); порожній allowedPresets →
> увесь каталог (single-preset вертикалі мають резолвитись); FOUT обраної пари і CSS-пейлоад 12 сімей —
> прийнятий трейд-оф зі спеки (замір у DNA-2 при бандлах); hydration-флеш при швидкому скролі —
> заміряти браузерно в DNA-2 разом із visual-regression базлайном.

> **Нотатка підхвилі DNA-2.А (2026-07-20, гейт + КЛЮЧОВА ЗНАХІДКА):** 3-осьовий гейт
> (dna-check v2, N=8) — ok, 0 порушень: кожен послідовний рол міняє бандл+сімʼю+пару, hero
> чесно photo-poor. АЛЕ візуальна сітка розкрила архітектурний факт: з хвилі B промпт
> генерації каже «ШАБЛОН обовʼязково» — модель ЗАВЖДИ обирає один із 4 шаблонів, тому
> нові сайти НІКОЛИ не йдуть класичним шляхом, і бандли на генерації фактично не
> застосовуються (isClassic=false); скіни/пара зберігаються в БД, але шаблонний рендер
> (враппери з ВЛАСНИМИ next/font, напр. Poppins у SalonWrapper) їх ігнорує. Бандли зараз
> реально працюють лише на legacy-класиці через re-roll. ВИСНОВОК для DNA-2b (наступна
> підхвиля, ПЕРШИЙ пріоритет): інтеграція DNA у ШАБЛОННИЙ шлях — теми/пари шаблонів
> через var(--font-*) (де-фонтінг wrapper-ів), бандли поверх шаблонних секцій, або
> повернення класичної композиції як рівноправного шляху генерації. Також у dna-check
> додано revalidateTenant після apply (три «різні» стани сітки рендерили одну кешовану
> сторінку). Смоук-тенант wave-dna-smoke.lvh.me — шаблонний (salon), для класичних тестів
> потрібен legacy-тенант або прапорець класичного шляху в dev/generate.

> **Нотатка DNA-2.А (adversarial review, виправлено):** codex: 8 must-fix + 7 should-fix.
> Виправлено: bundlesFor вимагає пул ≥2 (нова вертикаль більше не колапсує в один бандл і
> не ламає гарантію); reroll при відсутній сторінці — помилка, а не «тема оновлена, скіни ні»;
> dna-check: помилка оновлення сторінки більше не ковтається, revalidateTenant awaited,
> док-коментарі оновлені до v2; shuffleMiddles пінить hero/funnel/services ПО ТИПУ (стійко до
> переставлених власником чернеток), themePresetId у PublishResult звітує фактично збережений
> пресет; hero-фото photo-scrim/card-overlay — loading eager (LCP) і без aria-hidden при
> живому alt; заголовок Hero.tsx чесно звужує claim про токени (білий текст над реальним
> фото — контентна константа, як у legacy photo). Відхилено з обґрунтуванням: A→B→A цикл
> (спека гарантує розбіжність із ПОПЕРЕДНІМ; історія бандлів — кандидат у DNA-2b), неатомарний
> RMW reroll (прецедент repo, UI серіалізує; вікно ≈мс), auth на dev-роуті (repo-wide патерн
> NODE_ENV-гейта + lvh.me-замок, прийнято ще в хвилі A), rgba-тіні над фото (контентні),
> visit-card aspect-ratio CLS (полірування — у хвилю visual-regression). Підтверджено
> рев'ювером: pocket/seo переживають reroll, price-hiding скінів у бандлах нема, no-photo
> стани чесні, CTA-контракт спільний.

## Хвиля DNA-2b — DNA у шаблонному шляху: вісь шрифтової пари (гілка wave-DNA2b)

> Знахідка 2.А: нові сайти завжди шаблонні, а враппери несуть власні next/font —
> DNA-осі до них не діставали. 2b дає шаблонам вісь ПАРИ (найпомітніша після фіксу
> шрифтів); палітри/data-theme шаблонів = 2c (зміна інтерфейсу врапперів, координація
> з паралельною сесією шаблонів).

- [x] **B1. Registry allowlists** — `dnaFontPairs` на кожному шаблоні (пари, що не ламають
      ідентичність: salon serif-люкс, studio модерн, ferri преміум, restaurant тепло).
- [x] **B2. Shell wiring** — template-гілка TenantLayout і frame: інлайн `--font-heading/--font-body`
      з `resolveFontPair(theme.fontPairId)` (нема пари → шаблонні дефолти, нуль змін).
- [x] **B3. CSS де-фонтінг** — font-індирекції 4 шаблонів у globals.css отримують
      `var(--font-heading|--font-body, <шаблонний дефолт>)` fallback-ланцюги.
- [x] **B4. Publish** — шаблонна гілка: пара з allowlist шаблону (seeded, ≠попередня).
- [x] **B5. Re-roll** — дозволити шаблонним сайтам pair-only re-roll (draft-only).
- [x] **B6. Живий доказ** — wave-dna-smoke (salon): два роли → різні пари в computed h1;
      без fontPairId — рендер untouched (регресія нуль).

> **Нотатка DNA-2b (2026-07-20):** вісь пари доведена на шаблонному шляху наживо:
> дві реальні генерації salon-тенанта → у БД `cormorant-manrope`, у DOM body=Manrope,
> heading=Cormorant Garamond; старий шаблонний тенант БЕЗ пари — Poppins, байт-у-байт
> як раніше (регресія нуль). Борги: (а) ferri де-фонтінг відкладений — секції читають
> `font-[family-name:var(--font-cormorant)]` напряму, без центральної індирекції
> (потрібна коордінація з template-сесією); (б) portfolio/aisaas/nextly/react2021 —
> без allowlist (без оверрайду свідомо); (в) палітри/data-theme шаблонів = DNA-2c
> (зміна інтерфейсу врапперів); (г) dev-гочас: едіт globals.css під запущеним
> Turbopack може не примінитись — перезапускати dev перед замірами шрифтів.

> **Нотатка DNA-2b (adversarial review, виправлено):** 3 must-fix: (1) ferri рекламував
> пари, які його рендер не читає (re-roll = візуальний no-op) — allowlist знятий до
> де-фонтінгу ferri; (2) blanket-правило заголовків studio перекривало legacy
> font-утиліти БЕЗ пари — оверрайд тепер лише під shell-маркером `data-dna-pair`;
> (3) шаблони без allowlist більше не персистять чужу бандл-пару в DNA — чесне `""`.
> Should-fix: presetId у template-reroll більше не фабрикується ("" замість
> rose-classic); repeat-avoidance враховує top-level fontPairId при непарсабельній DNA;
> restaurant-allowlist звужений до warm-serif ідентичності (Lora/Literata/Playfair).
> Відхилено/відкладено: типізація dnaFontPairs літералами (FONT_PAIRS без as const —
> рефакторинг окремо; валідація реєстру — кандидат у тест DNA-2c). Рев'ювер підтвердив:
> nested-var() валідний, salon dark неторкнутий, portfolio не ловить salon-ребайндинг,
> draft-only межа reroll збережена. Живий пост-фікс чек: salon-смоук рендерить пару
> (data-dna-pair=cormorant-manrope, body Manrope, heading Cormorant) — без регресій.

> **Чистка (2026-07-20, наказ власника «проду нема, все тестове»):** повний вайп бази
> через новий dev-роут `/api/dev/wipe` (guard-слово, NODE_ENV-гейт): tenants 63, pages 40,
> conversations 23, members 19, leads 6, rate_limits 38 + спорожнений бакет photos.
> Всі смоук-тенанти з нотаток попередніх хвиль — зникли разом з усім. Код-аудит легасі:
> справжніх мертвих гілок «під старі рядки» нема — optional-поля схем лишаються як
> захисні (рядок може бути створений посеред флоу), carryDnaFields — це перенесення
> генома, не компат; паки досі живлять типи блоків, які бандли не покривають, і редактор.
> СПРАВЖНІ кандидати на видалення старого (свідомим рішенням, не побіжно): 6 legacy
> hero-скінів «primary band» (default/split/minimal/photo/gradient/mesh) + консолідація
> packs→bundles — заплановано в DNA-2c/3 після де-фонтінгу ferri.

## Хвиля DNA-2c — жонглювання секціями шаблонів + палітри + legacy clean (гілка wave-DNA2c)

- [x] **C1. Variant-жонглювання шаблонів** — publish, template-гілка: сідований вибір
      layout-варіанта кожної секції з варіантів шаблону (повтори секції не отримують
      однаковий варіант — правило C1 хвилі C), сідована перестановка середніх блоків
      (shuffleMiddles уже пінить по типу), re-roll теж перекидає варіанти.
- [x] **C2. Data-theme вісь** — `TemplateBrand.dnaTheme`; шаблони з ≥2 темами (salon
      light/dark, ferri dark/light) отримують сідований вибір стартової теми з DNA;
      тумблер відвідувача далі працює.
- [x] **C3. Ferri де-фонтінг** (агент A) — центральна індирекція замість прямих
      `var(--font-cormorant)` у секціях + body-ланцюг; після цього повернути
      `dnaFontPairs` ferri в registry (інтегратор).
- [x] **C4. Legacy hero clean** (агент B) — видалити 6 band-скінів
      (default/split/minimal/photo/gradient/mesh) з Hero.tsx; дефолт-диспетч →
      `editorial`; інтегратор: skins.ts (лише 5 архетипів), packs.ts hero→архетипи.
- [x] **C5. Верифікація** — tsc/build; жива генерація шаблонного сайта ×2: різні
      варіанти секцій/порядок/тема/пара; adversarial review; нотатки.

> **Нотатка DNA-2c (2026-07-20, verification):** живий доказ на salon-шаблоні, ті самі
> дані, nonce 1 → 2: пара lora-source→playfair-jost, тема light→dark, hero editorial→split,
> services rows→def, середина services|testimonials|process|faq → services|faq|process|
> testimonials (воронка приколота). Шаблонні сайти тепер жонглюють ВСІМА осями. Legacy:
> 6 band hero-скінів видалені (-373 рядки), fallback ""→editorial/split-light; паки
> переведені на архетипи; ferri де-фонтнутий (25 замін, no-pair рендер ідентичний) і
> повернутий у dnaFontPairs. Смоук-тенант dna2c-smoke.lvh.me. Codex-рев'ю — запущене.
