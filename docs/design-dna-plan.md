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
- [ ] **DNA1.5. Re-roll механіка** — server action «перегенерувати дизайн»: інкремент
      designNonce → новий DNA, гарантія розбіжності Фази 1 (сімʼя палітри + шрифтова пара;
      hero-архетипи додадуться в DNA-2), draft-only (інваріант №6). UI-кнопка в редакторі —
      ЯКЩО EditorShell вільний від чужих правок; інакше — самодостатня панель + гачок,
      а хвиля тестує через dev-скрипт.
- [ ] **DNA1.6. Motion-пресети** — 3 CSS-first пресети (none / fade-up / stagger),
      IntersectionObserver + CSS transitions, `prefers-reduced-motion`, видимість без JS
      (уроки H5); data-атрибут на shell, привʼязка до DNA.motionId.
- [ ] **DNA1.7. Distinctness-скрипт (гейт Фази 1)** — dev-скрипт: N=6 генерацій однієї
      вертикалі з тих самих даних → скріншот-сітка; критерій Фази 1: пари шрифтів і сімʼї
      палітр візуально різняться між усіма прогонами.

> Верифікація хвилі: tsc, build, живі Playwright-скріншоти tenant-сайту ДО/ПІСЛЯ
> (шрифти реально вантажаться — перевірити network/computed styles), adversarial review,
> нотатки відхилень тут.

## Хвиля DNA-2 — Hero-архетипи + перша двадцятка + бандли (10–14 днів)

- [ ] 5 hero-архетипів (≥4 світлі) + обовʼязкові no-photo fallback-и; далі хвилі по 4–5 секцій
      (партиціонування: один агент = один block type; skins.ts/packs.ts — один інтегратор).
- [ ] `THIRD_PARTY_NOTICES.md` з першою секцією; блок `team` окремо (новий block type).
- [ ] 3–4 стильові бандли з НАВМИСНО різними hero/skin-сетами; композиційна вісь
      (variants з allowlist бандла + seeded shuffle середини).
- [ ] Visual-regression baseline (Playwright скріншоти skin×breakpoint + diff, окремий бюджет).
- [ ] Повний 3-осьовий distinctness-гейт наприкінці хвилі 1 (N = 2×бандли, мін. 6).

## Хвиля DNA-3 — Смакові множники (2–3 дні)

- [ ] logo→palette (`@material/material-color-utilities`, snap до curated preset, AA-guard);
      decor-токени (5–6 CSS-прийомів); presets → 25+ із сімʼями.

## Хвиля DNA-4 — Постійний темп

- [ ] ~0.5–1 день/секція з QA+baseline; +0.5 дня/бандл; ціль 60+ skins, 12+ бандлів/квартал.
