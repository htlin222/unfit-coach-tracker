-- ════════════════════════════════════════════════════════════════
-- 001 — Add per-record reference metadata to `coaches`.
--
-- Adds the announcement permalink on sports.gov.tw plus the court,
-- case number and judgment date decoded from the judgment id.
--
-- Run once against an existing database:
--   pnpm exec wrangler d1 execute unfit-coach-db --remote \
--     --file=migrations/001-add-case-metadata.sql
--
-- Fresh databases get these columns from schema.sql directly; this
-- file exists only for databases created before 2026-08-02.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE coaches ADD COLUMN source_url    TEXT;
ALTER TABLE coaches ADD COLUMN court         TEXT;
ALTER TABLE coaches ADD COLUMN case_no       TEXT;
ALTER TABLE coaches ADD COLUMN judgment_date TEXT;

UPDATE meta SET value = '2' WHERE key = 'schema_version';
