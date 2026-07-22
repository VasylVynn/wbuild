# Дослідження: бібліотека секцій + design-DNA (Relume / Tailwind Plus / альтернативи)

> **Дата:** 2026-07-20. **Статус:** дослідження завершене, план схвалений adversarial-ревʼю (обидва опоненти: approve_with_notes).
> **Процес:** 3 паралельні web-дослідники (Tailwind Plus / Relume / альтернативи+рестайлінг) → синтез плану → 2 адверсарні опоненти (лінзи: license+економіка+ops; дизайн-якість+унікальність) → rebuttal по кожному запереченню → фінальні вердикти. 17 заперечень (5 must-fix) — всі розвʼязані або прийняті як правки; 6 залишкових нотаток вшиті в план і в додаток нижче. Всі license-цитати перевірені live у 2026.
> **Замовлення власника:** секції під лендінги локального бізнесу (не app-UI); ліцензійна чистота для AI-білдера; унікальний вигляд на кожну генерацію навіть з тих самих даних.

# План: бібліотека секцій + design-DNA для 3minsite (rev.2 після adversarial review)

## ВИСНОВКИ ДОСЛІДЖЕННЯ

### 1. Tailwind Plus — ЗАБОРОНЕНО (попри найкращу якість каталогу)

- **Каталог:** ~198 marketing-компонентів (Heroes 12, Features 15, Pricing 12, Testimonials 8, FAQ 7, CTA 11, Team 9, Contact 7...) — покривають усі потреби one-pager. АЛЕ всі 13 повних templates — tech/SaaS/docs/agency, жодного local-business.
- **Ціна:** one-time, Personal $299 / Team $979 (до 25 осіб), lifetime updates.
- **License — фатальний блокер** (перевірено live, tailwindcss.com/plus/license, 2026). Дослівно, Prohibited Use:
  > "Use the Components, Templates, or Libraries to create End Products that are **designed to allow an End User to build their own End Products** using the Components, Templates, Libraries, **or derivatives of them**."

  І названий приклад not-allowed:
  > "Creating a **'website builder' project** where end users can build their own websites using components, templates, or libraries included with or derived from Tailwind Plus."

  Client-loophole закрита прямо:
  > "Customers of software-as-a-service products are **not considered clients** for the purpose of this document."

  Server-side AI-збірка і form-only редагування НЕ рятують: заборона на ПРИЗНАЧЕННЯ продукту, не на механізм. Порт секцій у наш registry = "derivatives", теж під забороною.
- **Вердикт: NO FIT.** Улюблений варіант власника (one-time) — юридично найгірший. Купівля = оплачений breach.

### 2. Relume — NO-GO без письмового OEM-дозволу

- **Каталог:** найкраще покриття саме нашого кейсу — 1,400+ React-компонентів, десятки варіантів на тип секції (27 hero-варіантів лише в Header 44–70), усі категорії local-business one-pager.
- **Ціна:** лише підписка (без lifetime): Pro ~$40/мс (~$24 annual) — саме цей tier дає React/HTML export.
- **License** (relume.ai/legal/licensing-agreement) написана під "one finished website per client". Дослівно:
  > "Under no circumstances should the Item be **re-distributed**, regardless of any modifications... This includes... listing products in a way that allows them to be **accessed by other accounts**."
  > "You are not allowed to **offer the components downloaded to any third party**."
  > Derivatives: "The works that result are **subject to the terms of this licence**."

  Плюс copy-detection: "Each component has a unique encoded signature" — механізм націлений саме на такий scaled reuse, як наш. Слова builder/generator/SaaS у license відсутні — carve-out'у немає.
- **Технічно:** React-export = Tailwind v3 / React 18.3 (у нас v4 / React 19 / Next 15) — ручна міграція на кожну секцію; Site-Builder export взагалі unstyled wireframe.
- **Вердикт: PARTIAL за каталогом, NO-GO за license.** Можна паралельно (не блокуючи план) написати на hello@relume.io про enterprise/OEM — але стратегія не має від цього залежати.

### 3. Альтернативи: MIT-мікс — ЄДИНА легальна сировина

- **HARD NO (окрім Tailwind Plus):** shadcnblocks — забороняє "Creating an AI generator... tool that allows End Users to generate websites", $8,000/breach; Cruip — "usage in website builders or theme generators is not allowed"; Preline PRO — "cannot... create... 'generators'"; Magic UI PRO — заборона redistribute, $10,000/instance.
- **SAFE (MIT/permissive, $0):** HyperUI (300+ блоків, найкращий структурний fit), Flowbite core, Preline UI free (MIT + Fair Use, який ПРЯМО дозволяє: "Users are permitted to create and sell derivative works such as templates, themes, and **page builders**" — з non-compete; **клаузу валідуємо у Фазі 0, ДО використання**), TailGrids core, Meraki UI, DaisyUI (MIT, готова система тем), Aceternity free / Magic UI core (MIT, motion), Once UI (референс токенів), material-color-utilities (Apache-2.0, logo->palette).
- **GREY (лише з письмовим підтвердженням):** Flowbite Pro, Aceternity Pro. Не потрібні для старту. tweakcn — license НЕ підтверджена, перевірити у Фазі 0 перед використанням як сіда пресетів.
- **Ключовий інсайт (уточнений):** repo має каркас механіки унікальності (`lib/theme/tokens.ts` — CSS-var токени; `lib/theme/presets.ts` — куровані палітри; `lib/blocks/skins.ts` — `blockSkins`+`randomSkin`; `lib/design/packs.ts` — 6 packs; конвеєр template-mining), АЛЕ перевірка коду показала, що два критичні шари цього каркаса зараз не працюють — див. наступний розділ.

## ЩО ПОКАЗАЛА ПЕРЕВІРКА КОДУ (verified, критично для плану)

1. **Типографіка на tenant-сайтах ЗЛАМАНА.** `FONT_STACK` у `lib/theme/tokens.ts` називає "Playfair Display" (display) і "Nunito" (rounded), але жоден із них ніде не вантажиться: `app/layout.tsx` підключає через next/font лише Manrope+Unbounded як `--font-manrope`/`--font-unbounded` — змінні, які `FONT_STACK` не референсить; `app/s/[host]/layout.tsx` лише spread'ить `themeToCssVars`. Наслідок: усі registry-сайти сьогодні рендеряться у Georgia/system — фактично 2 типографічні look'и на весь продукт. Це не «покращення», а P0-фікс.
2. **Hero-skins структурно однакові.** У `components/blocks/Hero.tsx` 5 із 6 skins (default, split, minimal, photo-без-фото, gradient) — той самий «кольоровий band»: `backgroundColor: var(--color-primary)` + світлий текст; різниця лише у вирівнюванні/колонках/паддінгах. Лише mesh світлий. Re-roll сьогодні = зміна палітри, не дизайну.
3. **Packs — селектор палітри, не layout'у.** Усі 6 packs у `lib/design/packs.ts` мають ~ідентичні skin-мапи (switchback:framed, testimonials:spotlight, gallery:captions, faq:accordion — у всіх; hero:photo — у 4/6). «6 packs» ≈ «6 палітр на одному layout».
4. **Фото-бідний кейс деградує у скаргу №1.** hero:photo без imageUrl падає у той самий primary band; усі packs зав'язані на фото-skins — а типовий власник 45+ на онбордингу дає мало/нуль придатних фото.

**Висновок:** обіцянка «same data → visibly different site» вимагає СПОЧАТКУ полагодити шрифтовий шар, зробити hero-архетипи структурно різними і диверсифікувати packs — і лише потім нарощувати кількість skins.

## РЕКОМЕНДОВАНА СТРАТЕГІЯ

**Одне рішення: платні каталоги не купуємо, бо КОЖЕН придатний прямо забороняє наш продукт — а не тому, що «безкоштовне = виграш». Сировина — MIT-мікс (layout-таксономія), гроші — в інженерний час і арт-дирекцію, унікальність — з нашого seeded design-DNA.**

1. **Чесний кост-облік (виправлено після рев'ю):** ліцензійні $0 — НЕ економічна перемога. Ні one-time ліцензія, ні CapEx порту не є per-tenant витратами і не чіпають runtime-маржу. Реальна інвестиція цього плану — ~16–22 інж.-дні (≈$6–13k loaded) — у 5–40 разів більше за ціну будь-якої ліцензії. Якби багатий каталог був юридично чистим, купівля була б ДЕШЕВШОЮ за MIT-порт. MIT-мікс обраний тому, що Tailwind Plus/Relume/shadcnblocks/Cruip/Preline Pro/Magic UI Pro прямо забороняють website-builder/generator або redistribution (частина — з liquidated damages $8–10k). **Decision rule на майбутнє:** новий платний каталог оцінюємо (а) license-gate на наш exact use case, (б) ціна проти вартості інж.-днів порту — ніколи проти «$0».
2. **НЕ купувати:** Tailwind Plus, shadcnblocks, Cruip, Preline Pro, Magic UI Pro, Relume (стандартні tiers). Фіксуємо в `docs/architecture-brief.md` ІНВАРІАНТ походження коду: жоден компонент із license, що забороняє builders/generators, не потрапляє в repo.
3. **Використовувати (безкоштовно):**
   - **Структура секцій:** HyperUI + Flowbite core + TailGrids + Meraki UI (+ Preline free після license-gate Фази 0) — copy-paste HTML/Tailwind, найдешевший порт.
   - **Motion (полірування, не відмінність):** Aceternity free / Magic UI core — лише як референс для 2–3 CSS-пресетів; НЕ тягнемо Framer Motion.
   - **Палітри/теми:** DaisyUI themes (+ tweakcn після license-чеку) як сіди для розширення `themePresets`.
   - **Logo->palette:** `@material/material-color-utilities` (Apache-2.0).
4. **Чому це правильно:** ми беремо з MIT-джерел ТАКСОНОМІЮ layout'ів. 100% сприйнятої краси (палітра, шрифти, decor, ритм) дає наш токен-шар — тому смакова праця (арт-дирекція бандлів) забюджетована окремим рядком, а не захована в «порт секцій».
5. **Гігієна:** `THIRD_PARTY_NOTICES.md` у корені (MIT вимагає зберігати copyright notice); снапшоти license-сторінок у `docs/licenses/` з датою; **license-gate Preline Fair Use і tweakcn ДО першої хвилі**; e-mail-запити до Relume (OEM) і Flowbite (Pro) — паралельно, non-blocking.

## МЕХАНІКА УНІКАЛЬНОСТІ (design-DNA v2)

**Мета: та сама розмова/дані + повторна генерація => помітно ІНШИЙ сайт. Принцип салієнтності (виправлено після рев'ю): відчутну відмінність дають ТРИ осі — сім'я палітри, hero-архетип, шрифтова пара. Саме на них ми ГАРАНТУЄМО розбіжність. Radius, motion, decor — полірування, вони не входять в аргументацію унікальності. Жодної реклами «десятків тисяч комбінацій» — це мультиплікативна хиба над непомітними осями.**

Модель ніколи не емітить hex і не вигадує стилі — вона обирає mood, код обирає DNA з hand-blessed множин.

### Стильові бандли (еволюція design packs — розв'язання конфлікту «когезія vs розмаїття»)

Packs довели когезію, але виродились у селектор палітри (всі 6 мають однаковий skin-set). Бандл v2 — закритий, вручну авторований кортеж:

```
Bundle = {
  сім'я палітр (2–4 пресети однієї сім'ї),
  fontPairId (кирилична пара),
  decorId,
  heroArchetype + ВЛАСНИЙ skin-set (навмисно РІЗНИЙ між бандлами),
  photoPoorSet (обов'язковий: hero/services без фото-слотів),
  verticalIds
}
```

- Різні бандли зобов'язані відрізнятись hero-архетипом і skin-набором — вибір бандла міняє САМЕ layout, не лише палітру.
- RNG ніколи не робить вільний cross-product палітра×шрифт×decor — лише вибір бандла + благословенні варіації всередині нього (короткий per-bundle список альтернативних skins). Смак гарантується авторингом кортежів, AA-контраст — на етапі авторингу пресетів.
- Вільна per-block лотерея в генерацію не повертається (рішення власника 2026-07 підтверджене).

### DNA-об'єкт

Персистується як **optional-поля theme-JSON у `draft_theme`** (zod optional + fallback — БЕЗ SQL-міграції; опубліковані теми рендеряться без змін; Publish копіює draft→published, human-only, інваріант №6):

```ts
type DesignDNA = {
  bundleId: string;
  presetId: ThemePresetId;      // конкретний пресет із сім'ї бандла
  fontPairId: string;           // кирилична пара heading/body
  radius: Radius;
  skinOverrides: Partial<Record<BlockType, string>>; // лише з per-bundle allowlist
  motionId: "none" | "fade-up" | "stagger";          // полірування; parallax видалено (мобільний джанк)
  decorId?: string;
  designNonce: number;          // теж у theme-JSON — жодної колонки на tenants
};
```

1. **Seed:** `seed = fnv1a(tenantId + ":" + designNonce)`; PRNG — mulberry32. `designNonce` інкрементиться кнопкою «Перегенерувати дизайн» і кожним re-run генерації. Той самий nonce => відтворюваний результат (дебаг), новий => інший look.
2. **Гарантія розбіжності re-roll:** новий DNA зобов'язаний відрізнятись від попереднього одночасно за (а) СІМ'ЄЮ палітри (не сусідній відтінок — пресети отримують метадані сім'ї: тепла/холодна/нейтральна/землиста/контрастна), (б) hero-архетипом, (в) шрифтовою парою. Redraw, поки всі три не розійшлись. Попередній DNA зберігається поруч у theme-JSON.
3. **Рефакторинг лотереї:** `randomSkin`/`randomPack` приймають `rng: () => number` замість `Math.random()`; `lottery: false` (приховування цін) поважається як зараз.
4. **Фото-інвентар:** вибір архетипу враховує кількість storage-фото тенанта — фото-бідний власник отримує typography/decor-led бандл-варіант, який виглядає НАВМИСНИМ, а не деградований primary band.
5. **Distinctness-тест (acceptance для всієї механіки):** dev-скрипт генерує N сайтів однієї вертикалі з однакових даних (N = 2×бандли вертикалі, мін. 6 — див. додаток п.1), збирає скріншот-сітку; критерій — жодна пара не читається як «той самий сайт» (палітра-сім'я/hero/шрифти візуально різні). Проганяється до шипу Фази 1 (осі шрифт+палітра) і повністю — наприкінці хвилі 1 Фази 2.
6. **Композиційна вісь (додано за питанням власника 2026-07-20).** Сьогодні variant-и секцій формально обирає модель генерації («що найкраще пасує бізнесу»), тому за тих самих даних вона сходиться до того самого вибору — регенерація не міняє композицію. Правка: layout-variant кожної секції визначає DNA-сід з allowlist-у бандла (вибір моделі поважається лише якщо входить у allowlist); при re-roll variant-и зобовʼязані зсунутись відносно попереднього DNA там, де секція має >1 варіанта; порядок СЕРЕДНІХ секцій отримує seeded-перестановку в межах дозволеного шаблоном («порядок — орієнтир»). СКЛАД секцій лишається data-driven (нема відгуків → нема секції відгуків): різноманіття йде від форми, не від викидання контенту.

### Шрифти — P0-фікс + найбільший видимий важіль

Зараз шар НЕ ПРАЦЮЄ (див. «Перевірка коду» п.1) — це передумова, не enhancement:

- `lib/theme/font-pairs.ts`: 8–10 пар із перевіреною кирилицею, через `next/font/google` з `subsets: ["cyrillic"]`. Кандидати: Manrope+Inter, Montserrat+Rubik, Lora+Source Sans 3, PT Serif+Inter, Cormorant Garamond+Manrope (**verify-first: render-чек ґ/є/і/ї по вагах**), Unbounded+Inter (сміливий), Nunito+Nunito Sans (м'який), Manrope+Unbounded (наявна платформна пара). **DM Sans видалено — на Google Fonts без кирилиці.** Кожна пара до включення проходить render-чек українського тексту (ґ є і ї).
- **Механізм завантаження (специфіковано після рев'ю):** усі сім'ї декларуються module-level з `preload: false` (лише дефолтна пара — `preload: true`) і `display: "swap"`; tenant shell (`app/s/[host]/layout.tsx`) вішає variable-класи, а `themeToCssVars` виставляє `--font-heading`/`--font-body` як референси на `var(--font-<family>)` обраної пари. Браузер завантажує woff2 ЛИШЕ тих сімей, на які посилається застосований CSS — байти на lead-funnel сторінці платить тільки обрана пара; невикористані сім'ї коштують лише @font-face-декларації. Manrope+Unbounded лишаються платформними шрифтами root layout і співіснують як одна з пар.
- `themeSchema` розширюється **назад-сумісно**: optional `fontPair`; за відсутності — старий `FONT_STACK` fallback; опубліковані теми в БД рендеряться без міграції.

### Motion і decor (полірування)

- Motion: 3 CSS-first пресети (IntersectionObserver + CSS transitions, `prefers-reduced-motion`), data-атрибут на shell. Нуль JS-бібліотек на lead-funnel сторінці. НЕ рахується віссю відмінності (невидимий на першому paint).
- Decor: 5–6 CSS-only прийомів (м'який mesh-градієнт, dot-grid, діагональні розділювачі, noise) як токени — підсилювач навмисності photo-poor макетів.

## КОНВЕЄР СЕКЦІЙ

Шлях однієї секції (той самий mining-конвеєр, що вже пройшли 9 `template_sources/`):

1. **Відбір:** секція з MIT-джерела (скріншот + HTML) у shortlist з тегом block type і vertical-affinity. Джерело/URL фіксується для `THIRD_PARTY_NOTICES.md`.
2. **Мапінг на схему:** секція лягає на існуючий block type як **новий skin**; нові типи (team) — окремий блок у registry за повною процедурою (schema -> render -> AI description -> editor form) і ОКРЕМИЙ бюджет — не skin.
3. **Re-authoring (не copy-paste):** ре-авторинг ЗІ СКРІНШОТА/СТРУКТУРИ, а не перенос коду; HTML -> React-компонент із `BlockProps`; усі хардкоджені кольори/шрифти/радіуси -> `var(--color-*)`, `var(--font-*)`, `var(--radius)`; тексти -> поля блока; Tailwind-класи адаптуються до v4.
4. **Інваріанти зображень:** слоти лише під storage-URLs (`sanitizeMedia`); декоративні градієнти/патерни — CSS, не картинки. Кожен фото-skin зобов'язаний мати НЕ-деградуючий no-photo варіант (decor/typography-led, не primary band).
5. **Реєстрація:** skin id + українська label у `blockSkins`; за потреби `lottery: false`; включення в бандли.
6. **Арт-дирекція (окремий крок):** приймання секції/бандла — скріншот-рев'ю на реальному українському контенті вертикалі (теплота для квіткарки ≠ діловитість для СТО), не лише tsc/build.
7. **Верифікація:** `npx tsc --noEmit`, `npm run build`, Playwright-скріншоти на 3 breakpoints з українським текстом (кирилиця й переноси — українські слова довші!); скріншоти комітяться як visual-regression baseline.

**Оцінка: 2–6 годин на skin-варіант**, ПЛЮС арт-дирекція бандлів окремим рядком. Провенанс: PR цитує джерело з дозволеною license — це бухгалтерія для NOTICES і матеріал для spot-review, а НЕ enforcement (структура layout загалом не охороняється копірайтом; під забороною verbatim-код платних джерел, не ідеї). Основний контроль — дисципліна re-authoring зі скріншота + вибірковий рев'ю.

**Перші 20 секцій (пріоритет №1 — структурно РІЗНІ hero-архетипи, ≥4 на світлому фоні; Preline-рядки — після license-gate Фази 0, з fallback):**

| # | Block type | Skin / архетип | Джерело-кандидат |
|---|---|---|---|
| 1 | hero | full-photo + scrim (оновлений: no-photo fallback -> світлий decor-hero) | HyperUI |
| 2 | hero | типографічний editorial БЕЗ фото (світлий, decor-led) — photo-poor герой | HyperUI |
| 3 | hero | asymmetric split: текст + вертикальне фото, СВІТЛИЙ фон | Flowbite |
| 4 | hero | card-overlay: контент-картка поверх фото | TailGrids |
| 5 | hero | «візитка» з контактами в шапці (світлий) | HyperUI |
| 6 | services | іконки-картки 3-кол | HyperUI |
| 7 | services | прайс-лист «меню» (пекарня/салон) | Flowbite |
| 8 | services | горизонтальні картки з фото | TailGrids |
| 9 | services | таблиця тарифів compact | Preline free* (fallback: HyperUI) |
| 10 | gallery | masonry | HyperUI |
| 11 | gallery | стрічка-карусель | Flowbite |
| 12 | testimonials | картки з аватарами + рейтинг | Flowbite |
| 13 | testimonials | велика цитата + фото автора | Preline free* (fallback: Meraki UI) |
| 14 | faq | двоколонковий акордеон | HyperUI |
| 15 | stats | 4-up counters band | TailGrids |
| 16 | cta | full-width банер з decor-патерном | HyperUI |
| 17 | cta | картка-заклик з телефоном | Meraki UI |
| 18 | contacts | split: карта + години + lead_form | Flowbite |
| 19 | switchback | before/after (СТО) | HyperUI |
| 20 | switchback | «як ми працюємо» 3 кроки | Preline free* (fallback: Flowbite) |

**Окремо, поза skin-бюджетом:** блок `team` (картки майстрів, TailGrids) — новий block type за повною процедурою registry, 1–2 дні.

**Координація:** footer-варіанти веде агент e9-footers — виключені з двадцятки. Протокол хвиль: один агент = один block type (володіє своїм `components/blocks/*.tsx`); правки `skins.ts`/`packs.ts` вносить ОДИН інтегратор наприкінці хвилі (серіалізовано); перед кожною хвилею — SendMessage-синк з e9-footers + `git status`.

## ЕТАПИ І ОЦІНКИ (переглянуті після рев'ю)

- **Фаза 0 — Legal-гігієна + license-gates (1 день):** `THIRD_PARTY_NOTICES.md`; снапшоти licenses у `docs/licenses/`; **валідація Preline Fair Use і tweakcn ДО їх використання** (не пройшло — fallback-джерела з таблиці); ІНВАРІАНТ походження в architecture-brief; non-blocking листи Relume/Flowbite.
- **Фаза 1 — Typography-фікс + DNA-ядро (3–4 дні):** **P0: полагодити шар шрифтів** (font-pairs.ts, механізм preload:false + variable-класи, FONT_STACK -> var-референси, назад-сумісний themeSchema); seeded PRNG + designNonce у theme-JSON (без SQL-міграції); рефакторинг `randomSkin`/`randomPack` на injected rng; кнопка «Перегенерувати дизайн» + гарантія розбіжності (сім'я/архетип/пара); distinctness-тест (скрипт + скріншот-сітка); motion-пресети.
- **Фаза 2 — Hero-архетипи + перша двадцятка + бандли (10–14 днів):** хвиля 1 = 5 hero-архетипів + no-photo fallback'и; далі хвилі по 4–5 секцій, агенти партиціоновані по block types, registry-правки серіалізовані; **арт-дирекція: 3–4 стильові бандли з НАВМИСНО різними skin-наборами (2–3 дні всередині фази)**; **блок team окремо (1–2 дні)**; **visual-regression baseline** (Playwright-скріншоти skin×breakpoint + diff-скрипт).
- **Фаза 3 — Смакові множники (2–3 дні):** logo->palette (material-color-utilities + snap до curated preset + AA-guard); decor-токени; розширення presets до 25+ З МЕТАДАНИМИ СІМЕЙ.
- **Фаза 4 — Стабільний темп (постійно):** ~0.5–1 день/секція **включно з QA і baseline-скріншотами**; +0.5 дня на кожен новий бандл (арт-дирекція); регресійний прогін visual-diff при кожному bump Tailwind/Next; ціль 60+ skins і 12+ бандлів за квартал; нові вертикалі отримують бандли без зміни коду генерації.

**Разом до відчутного результату: ~16–22 інж.-дні (чесний CapEx ≈ $6–13k loaded).** Ліцензії: $0 — тому, що всі придатні платні каталоги юридично заборонені для нашого use case, а не тому, що «безкоштовно = краще».

## РИЗИКИ

1. **Естетика MIT-джерел «tech-нейтральна»** — квіткарці потрібна теплота. Мітигація: look диктує наш токен-шар + окремо забюджетована арт-дирекція бандлів; НЕ портувати flashy-ефекти (beams, 3D) з Aceternity/Magic UI.
2. **Кирилиця:** display-шрифти часто без ґ є і ї — кожна пара проходить render-чек українського тексту ДО включення; DM Sans вже виключений; Cormorant Garamond — verify-first; лише `subsets: ["cyrillic"]`.
3. **Назад-сумісність теми:** `draft_theme`/`published_theme` — версіоновані дані в БД; розширення `themeSchema` (fontPair, dna, designNonce) ТІЛЬКИ optional-полями з fallback — жодних SQL-міграцій у Фазі 1; якщо колонка колись знадобиться — окремий крок 0007 з явною ручною координацією (міграції в цьому repo застосовуються вручну).
4. **Якість комбінацій:** смак гарантують hand-blessed бандли-кортежі (сім'я палітр × пара × decor × skin-set), а не вільний cross-product; AA-контраст — на авторингу пресетів; фінальний аргумент — distinctness-тест, а не комбінаторика.
5. **Виродження бандлів у «палітри на одному layout»** (вже сталося з packs v1): правило — новий бандл ПРИЙМАЄТЬСЯ лише якщо його hero-архетип + skin-set відрізняються від усіх наявних; перевіряється на скріншот-рев'ю.
6. **Photo-poor власник (частий кейс):** без обов'язкових no-photo варіантів «красиві» бандли колапсують у band — кожен бандл шипиться разом із photoPoorSet, DNA враховує фото-інвентар.
7. **MIT-обов'язки:** зберігати notices; re-authoring зменшує, але не знімає обов'язок — `THIRD_PARTY_NOTICES.md` обов'язковий у Фазі 0.
8. **QA-борг росте зі skin-кількістю:** visual-regression baseline з Фази 2 обов'язковий; без нього ручна матриця skins×breakpoints×теми з'їсть темп Фази 4 при першому ж bump фреймворка.
9. **Перф lead-funnel:** motion лише CSS/IO з `prefers-reduced-motion` (parallax видалено — джанк на мобайлі, головному viewport'і lead-funnel); next/font з preload:false — байти платить лише обрана пара.
10. **Паралельні агенти:** `skins.ts`/`packs.ts` — один інтегратор на хвилю; агенти партиціоновані по block types; SendMessage-синк з e9-footers перед хвилею. «git status перед стартом» — необхідно, але недостатньо.
11. **Relume-спокуса:** якщо OEM-відповідь позитивна — бонус для таксономії layout'ів через той самий re-authoring конвеєр; до письмової згоди жодного Relume-КОДУ в repo (encoded signatures ловлять саме verbatim-код).

---

## Додаток: результат дебатів і залишкові правки (вшиті в план)

**Вердикти опонентів після rebuttal:** обидва — approve_with_notes. Опонент дизайн-лінзи: «автор прийняв усі 8 моїх заперечень із СУТТЄВИМИ змінами плану, не performative agreement; без ухилянь».

**Залишкові нотатки, прийняті як правки плану:**

1. **Поріг бандлів для distinctness-тесту (pigeonhole).** Повний 3-осьовий тест з N=10 неможливо пройти, маючи 3–4 бандли (два сайти з одного бандла ділять hero+пару). Правка: N масштабується від пулу — N = 2×(бандли вертикалі), мінімум 6; ціль Фази 4 (12+ бандлів) відновлює N=10+.
2. **Секвенування гейта.** Гейт Фази 1 перевіряє лише осі шрифт+сімʼя палітри (бандлів ще нема); повний 3-осьовий гейт — наприкінці хвилі 1 Фази 2. 
3. **Голодування redraw.** Для вертикалі з малим пулом бандлів гарантія «інший архетип І інша пара» може бути нездійсненною: мінімум 3 бандли на вертикаль; якщо пул менший — деградація гарантії у порядку hero-архетип → пара → сімʼя (перше досяжне), без вічного циклу.
4. **Правило buy/build.** У порівняння «ціна каталогу vs інж.-дні порту» додається довічний supроводжувальний борг власних skins (QA, baseline, bump-регресії) — інакше правило системно схиляє до build.
5. **FOUT обраної пари.** preload:false на всіх сімʼях означає swap-мигання hero-заголовка на lead-funnel сторінці. Правка: preload:true для DNA-обраної пари конкретного тенанта (render-time), або свідоме прийняття зі заміром.
6. **Візуально-регресійний харнес — окремий бюджет.** Скріншот-diff у repo без тест-інфри — це власний міні-проєкт (+0.5–1 день у Фазі 2, з допуском на шрифтовий/AA-недетермінізм рендера).
