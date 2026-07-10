# Template-mining: аналіз джерел і план конвертації

> **Дата:** 2026-07-10. Джерела: `template_sources/design-template-main` (MIT, StudioMeyer — темний SaaS-onepager) і `template_sources/template-site-main` (MIT, Jim van Duijsen — 5 нішевих шаблонів: bakery, organic-market, whole-foods, construction-pro, dental-care + shadcn UI).
> Аналіз: 4 паралельні агенти (секції → мапінг на наші блоки; ліцензії; техсумісність). **Ліцензії обох — MIT, юридично чисто.** Фото з шаблонів НЕ переносимо (походження не задокументоване, і нам вони не потрібні — у нас свої/згенеровані).

## Технічні вердикти (зафіксовано)

- **framer-motion / motion — НЕ додаємо.** 100% анімацій шаблонів = scroll-reveal + прості лупи; v1 портуємо БЕЗ анімацій (блоки лишаються серверними), поліш пізніше через CSS `animation-timeline: view()` з graceful fallback.
- **lucide-react — НЕ додаємо** пакетом; ~10–15 потрібних іконок інлайнимо як власні SVG-компоненти (MIT дозволяє).
- **radix / cva — не потрібні** (сидять лише в chrome-компонентах шаблонів, не в секціях).
- **Головна пастка портування:** shadcn-класи (`bg-primary`, `text-muted-foreground`) у нас мовчки стають no-op — у нашій системі кольори тенант-сайтів ідуть ЛИШЕ через інлайн `style={{...var(--color-*)}}` (ідіома `Services.tsx`). Рецепт: скопіювати JSX → викинути motion/lucide/next-themes/dark:-варіанти → перекласти класи на var()-токени → зареєструвати скін. ~30–60 хв/секцію.
- Next 16 → 15: проблем нема. Шрифти шаблонів (Inter latin-only) — не переносимо. Dark-mode обв'язку стрипаємо (у нас light-only форс).

## Консолідована таблиця скінів-кандидатів

| # | Скін | Джерело | Блок | Зміни схеми | Цінність |
|---|---|---|---|---|---|
| 1 | hero **photo** (повноекранне фото + затемнення + центрований текст) | усі food + construction | hero | — (reuse imageUrl) | ★★★ найбільший візуальний апгрейд |
| 2 | hero **gradient** (градієнт від primary, без фото) | dental | hero | — (color-mix) | ★★ гарний no-photo варіант |
| 3 | hero **mesh-blobs** (анімовані CSS-блоби, без фото) | design-tpl | hero | — | ★★ преміальний no-photo, адаптуємо під світлі теми |
| 4 | services **trust-grid** (4 кол. іконка+назва+опис, без цін) | 6× повторів у всіх шаблонах | services | опційно `icon` | ★★★ найчастіший патерн; сертифікати/гарантії для СТО/клінік |
| 5 | services **gallery-cards** (hover-zoom фото + оверлей) | bakery/organic | services | — | ★★ рітейл-відчуття |
| 6 | services **pricing-cards** (чекліст + бейдж «популярний») | design-tpl | services | опційно `badge` | ★★ прайси — часта потреба |
| 7 | services **steps** (нумеровані кроки процесу) | design-tpl | services | — (номер замість ціни) | ★ |
| 8 | switchback **framed** (обрамлена панель фото+текст) | whole-foods | switchback | — | ★★ полірований «про нас» |
| 9 | switchback **+CTA-кнопка** | dental | switchback | опційно buttonLabel | ★ |
| 10 | testimonials **spotlight** (одна велика цитата) | dental | testimonials | — | ★★ trust для клінік |
| 11 | faq **accordion** (одна відкрита, CSS-only) | design-tpl | faq | — | ★★ прямий 1:1 |
| 12 | gallery **captioned-cards** (підпис/категорія на hover) | construction | gallery | опційно title у image | ★★ «наші роботи» для сервісних |
| 13 | hero **dual-CTA** (другий outline-баттон) | whole-foods/construction | hero | опційно secondary CTA | ★ |
| 14 | **Глобальний поліш**: noise-текстура + «eyebrow»-мікрозаголовки | design-tpl | всі скіни | — | ★★ найдешевший приріст сприйняття |
| 15 | блок **«Команда»** (аватар+ім'я+роль+опис) | design-tpl (без AI-гіміка) | НОВИЙ блок | новий тип | ★★ клініки/салони/майстерні |
| 16 | портфоліо/кейси (метадані проєктів) | construction | НОВИЙ блок | новий тип | відкладено |

**Пропуски (свідомо):** logo-cloud (фейкові лого), integrations-grid (не SMB), контакт-сторінки side-by-side (не лягає в стек блоків), каталог /products (е-commerce, ретаргетимо CTA на заявку), кастом-курсор (гімік).

## Хвилі виконання — СТАТУС: хвилі 1+2 ✅ shipped 2026-07-10

> 10 нових скінів live (hero: photo/gradient/mesh; services: trust/showcase/pricing/steps; switchback: framed; testimonials: spotlight; faq: accordion; gallery: captions) + опційні пропси (secondary CTA, icon, badge, switchback button, gallery captions). Рендер кожного скіна перевірено e2e по маркерах у HTML. **Запобіжник:** скіни, що ховають ціни (trust/steps), — editor-only, виключені з лотереї генерації (`lottery: false`). Глобальний noise-поліш перенесено в десктоп-поліровку. `template_sources/` в .gitignore + tsconfig exclude.

- **Хвиля 1 — «нуль змін схеми»** (№1,2,3,5,7,8,10,11 + №4 без іконок + №14): ~8–9 скінів + поліш, паралельно агентами, ~1–1.5 дня. Лотерея генерації одразу підхоплює нові скіни.
- **Хвиля 2 — з розширенням схеми** (№4-icon, 6, 9, 12, 13): опційні пропси (back-compatible, schemaVersion), ~1 день. Генерація/редактор/AI-edit автоматично отримують нові поля через реєстр.
- **Хвиля 3 — новий блок «Команда»** (№15): ~0.5–1 день, якщо власник підтвердить.

> УВАГА виконавцям: тенант-розмітка НІКОЛИ не використовує платформні класи (text-ink, bg-canvas) і shadcn-аліаси — лише інлайн var(--color-*) токени. Кожен скін = запис у lib/blocks/skins.ts + варіант у components/blocks/<Type>.tsx (патерн Hero/Services).
