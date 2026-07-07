# Вітрина — Модель даних (MVP)

> **Статус:** ✅ зафіксовано 2026-07-07; оновлено 2026-07-07 — додано `leads` + Telegram-колонки + shipped-нотатки. Закриває §5.5, §5.6, O1. Джерело правди схеми — міграції `supabase/migrations/0001_init.sql` + `0002_leads.sql`; цей документ пояснює *чому*.
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

## switchTemplate → «Перегенерувати» (shipped 2026-07-07, журнал #36)

- Реалізовано як **«Перегенерувати»** (адаптація §4.7 до вільної композиції):
  ре-запуск генерації з `tenants.facts` пише нові блоки+тему в **чернетку**;
  старі draft-блоки йдуть у `draft_content.pocket` (не видаляються, кеп 40);
  факти живуть у `tenants.facts`, тож не губляться. Плюс окремий перемикач
  тема-пресетів (миттєвий, детермінований).

## Таблиці (стисло)

| Таблиця | Призначення | Ключові поля |
|---|---|---|
| `tenants` | конфіг сайту + версійована тема + Telegram | `host` (nullable, unique), `canonical_hostname`, `status`, `nav_mode`, `brand`, `footer`, `facts`, `vertical`, `draft_theme`, `published_theme`, `telegram_chat_id`, `telegram_connect_token` |
| `pages` | сторінки + версійований контент | `slug` (`''`=home), `draft_content`, `published_content`, `is_published`, `unique(tenant_id, slug)` |
| `conversations` | онбординг агент-чат (§4.9) | `tenant_id`, `messages` (інтерфейс чату), `facts_state` (slot-filling стан — `{facts, verticalId, ready}`), `is_complete` |
| `tenant_members` | auth↔tenant членством (§3.1) | `(tenant_id, user_id)`, `role` |
| `leads` | заявки з `lead_form` (§5.6) | `tenant_id`, `name`, `phone`, `message`, `source`, `meta`, `created_at`; `pushed_at` (timestamptz — час успішного пушу, NULL = не надіслано) |

## Впроваджені рекомендації ревю

- **S1:** `tenants.facts`, `tenants.status`, `schemaVersion` у блоці (`blockPlacementSchema`), UNIQUE `host` + reserved-subdomains (`lib/tenant/reserved.ts`).
- **S2:** `noindex` коли `status ≠ published` (у `generateMetadata`, §10.4).
- **S3:** RLS увімкнено при створенні таблиць (політики членства — з Фазою 3);
  публічний рендер обходить RLS через сервісний ключ + кеш (§9).
- **S4:** `conversations` без `site_id` (неіснуюча сутність — док-баг брифа §4.9);
  замість цього `facts_state` — відновлення без переграшу транскрипту.
- **S5:** підтверджено — middleware без БД, tenant виводиться з `Host`; existence-check
  у сторінці через кешований read (KV/Edge Config **не** будуємо в MVP).

## Shipped-нотатки (оновлено 2026-07-07)

### `leads` таблиця (§5.6, журнал #33)
`leads(id, tenant_id, name, phone, message, source, meta, pushed_at, created_at)` — міграція `0002_leads.sql`. `/api/leads` резолвить `tenant_id` з `Host`-заголовку (ніколи з body); honeypot + origin check. Запис створюється завжди; `pushed_at` виставляється лише після успішного Telegram-пушу (best-effort, NULL = не надіслано).

### Telegram-колонки в `tenants` (§5.6, журнал #33)
- `telegram_connect_token` — одноразовий токен для deep-link `/start <token>`. Генерується при натисканні «Підключити Telegram» у дашборді; очищується після валідації ботом.
- `telegram_chat_id` — `chat_id` власника; зберігається ботом після `/start`. Null = Telegram не підключений.

### `conversations.facts_state` (§4.9, журнал #37)
`facts_state: { facts: Record<string, unknown>, verticalId: string, ready: boolean }`. `facts` = поточний стан slot-filling; `verticalId` = класифікована вертикаль (прокидається через усі turns); `ready` = агент вирішив «достатньо» (не детермінований чекліст). Resume через localStorage: при відновленні сесії `facts_state` підвантажується, транскрипт `messages` — вторинний.

### O1 вирішено в практиці (журнал #37)
Placeholder tenant з `host=null` створюється на старті чату; `host` призначається після підтвердження піддомену. `tenants.host nullable` тримає цю модель без змін схеми. Фінальний флоу таким чином стабілізовано.

## Досі відкрите (потребує власника)

- **O2 — rate-limit на створення tenant** (§11 «мінімум із MVP»): для тесту на
  друзях відкладається свідомо; kill-switch = `status='suspended'` → 404 (shipped 2026-07-07).
