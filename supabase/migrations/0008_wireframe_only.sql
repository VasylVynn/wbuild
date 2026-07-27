-- 0008 — wireframe-only cleanup (2026-07-27)
--
-- The design layer is gone. There is no template choice, no palette preset, no
-- design-DNA roll, no per-block skin: the model composes the page from the
-- block library and writes that site's stylesheet, which is stored on the page
-- content beside the blocks it was written for.
--
-- Owner decision: existing tenants are disposable test data. This migration
-- WIPES them rather than migrating, because their content is composed against
-- templates that no longer route and their themes describe a system that no
-- longer exists. Nothing here is reversible — take a snapshot first if any row
-- still matters.
--
-- Apply MANUALLY in the Supabase SQL editor (repo convention: no DATABASE_URL,
-- no migrate script).

begin;

-- ── 1. Drop every site generated under the old design system ───────────────
-- One statement is enough: every table that references a tenant declares
-- `on delete cascade` (pages/leads/conversations/tenant_members in 0001,
-- site_events/custom_requests in 0005, editor_chats in 0006, ig_snapshots in
-- 0007), so the children go with the parent. Naming them here would break on a
-- database where a later migration has not been applied yet.
delete from tenants;

-- ── 2. Drop the theme columns ─────────────────────────────────────────────
-- `draft_theme` / `published_theme` held the design tokens the classic shell
-- turned into CSS variables, plus the design-DNA genome (bundle, palette
-- family, font pair, motion, decor, nonce). Every one of those axes is deleted.
-- The generation counter that survived them now lives in `brand.designNonce`.
alter table tenants drop column if exists draft_theme;
alter table tenants drop column if exists published_theme;

-- `nav_mode` only ever had one value ('onepage'); multi-page navigation is a
-- future feature that will reintroduce it with a real second value.
alter table tenants drop column if exists nav_mode;

commit;

-- ── Notes ─────────────────────────────────────────────────────────────────
-- `brand` (jsonb) stays and now carries: businessName, logoUrl, logoAdaptedUrl,
--   logoDisplay, photos, generatedHero, designNonce.
-- `pages.draft_content` / `published_content` (jsonb) now carry:
--   blocks, seo, templateId, wireCss, genToken, generatedHero.
-- Nothing else about the schema changed.
