# Вітрина — Модель даних (MVP)

> **Статус:** ✅ зафіксовано 2026-07-07. Закриває відкрите питання брифа §5.5
> («колонки vs версійні рядки») і крок 2 §13. Джерело правди схеми — міграція
> `supabase/migrations/0001_init.sql`; цей документ пояснює *чому*.
> **Підстава:** стратегічне ревю (Fable) визначило форму draft/published як
> найризикованіше несуче рішення фундаменту — воно тримає редактор, публікацію,
> purge кешу і switchTemplate.

## Несучий принцип — версіонування

- **Контент сторінки** версіонується на **рівні сторінки** як jsonb-масиви блоків:
  `pages.draft_content` = `{ blocks, pocket }`, `pages.published_content` = `{ blocks }`.
  Нормалізована таблиця `blocks` у MVP **не потрібна**: `PageSchema.parse` і так
  валідує весь масив, а окрема таблиця конфліктує з атомарною публікацією і
  «кишенею» switchTemplate.
- **Тема** версіонується на **рівні tenant**: `tenants.draft_theme` /
  `tenants.published_theme`. **НЕ** одна «жива» колонка — інакше неопублікований
  switchTemplate (який міняє тему в чернетці, §4.7 крок 6) миттєво перефарбує
  **живий** сайт.
- **«Опублікувати»** — одна транзакція: `draft_theme → published_theme` для
  tenant **і** `draft_content.blocks → published_content.blocks` для кожної
  сторінки, далі `revalidateTag('tenant:{host}')` (§9.1). Збереження чернетки
  кеш **не** чіпає.

## Резолвінг на рендері

Рантайм-типи (`Tenant`, `Page` у `lib/tenant/types.ts`) — це **resolved view**:
- публічний рендер → `published_theme` + `published_content.blocks`;
- редактор → `draft_theme` + `draft_content.blocks`.

Data-layer вибирає, який зріз повернути; рендер-код лишається незмінним. Саме
тому впровадження draft/published **не** зачепило `PageRenderer`, middleware чи
компоненти.

## switchTemplate (у MVP — рішення власника 2026-07-07)

- Лишається **в MVP** (журнал #5): 2-й пресет квіткарні будуємо у Фазі 2,
  тверда фіча — у Фазі 4.
- Алгоритм (§4.7): новий каркас+тема застосовуються в **чернетку**; блоки, яких
  нема в новому каркасі, йдуть у `draft_content.pocket` (не видаляються);
  факти живуть у `tenants.facts`, тож не губляться; тема — від нового пресету.

## Таблиці (стисло)

| Таблиця | Призначення | Ключові поля |
|---|---|---|
| `tenants` | конфіг сайту + версійована тема | `host` (nullable, unique), `canonical_hostname`, `status`, `nav_mode`, `brand`, `footer`, `facts`, `draft_theme`, `published_theme`, `vertical` |
| `pages` | сторінки + версійований контент | `slug` (`''`=home), `draft_content`, `published_content`, `is_published`, `unique(tenant_id, slug)` |
| `conversations` | онбординг агент-чат (§4.9) | `messages` (лише інтерфейс), `facts_state` (slot-filling стан), `is_complete` |
| `tenant_members` | auth↔tenant членством (§3.1) | `(tenant_id, user_id)`, `role` |

## Впроваджені рекомендації ревю

- **S1:** `tenants.facts`, `tenants.status`, `schemaVersion` у блоці (`blockPlacementSchema`), UNIQUE `host` + reserved-subdomains (`lib/tenant/reserved.ts`).
- **S2:** `noindex` коли `status ≠ published` (у `generateMetadata`, §10.4).
- **S3:** RLS увімкнено при створенні таблиць (політики членства — з Фазою 3);
  публічний рендер обходить RLS через сервісний ключ + кеш (§9).
- **S4:** `conversations` без `site_id` (неіснуюча сутність — док-баг брифа §4.9);
  замість цього `facts_state` — відновлення без переграшу транскрипту.
- **S5:** підтверджено — middleware без БД, tenant виводиться з `Host`; existence-check
  у сторінці через кешований read (KV/Edge Config **не** будуємо в MVP).

## Досі відкрите (потребує власника)

- **O1 — момент створення tenant:** `conversations.tenant_id` потрібен до вибору
  піддомену. Схема це **не блокує** (`tenants.host` nullable): tenant можна
  створити на старті чату, host призначити пізніше апдейтом. Фінальний флоу —
  за власником (рішення для Фази 3).
- **O2 — rate-limit на створення tenant** (§11 «мінімум із MVP»): для тесту на
  друзях відкладається свідомо; kill-switch = `status='suspended'`.
