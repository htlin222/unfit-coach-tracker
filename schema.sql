-- ════════════════════════════════════════════════════════════════
-- unfit-coach-tracker — D1 Schema
-- Run: npx wrangler d1 execute unfit-coach-db --file=schema.sql
-- ════════════════════════════════════════════════════════════════

-- Main table: one row per (name, sport, judgment_url) tuple
-- PK is a deterministic SHA-256 hash → idempotent upserts
CREATE TABLE IF NOT EXISTS coaches (
  id            TEXT PRIMARY KEY,         -- hex(sha256(name + '|' + sport + '|' + judgment_url))
  name          TEXT NOT NULL,
  sport         TEXT NOT NULL,
  category      TEXT,                      -- 球類運動 | 格鬥類 | 目標類 | 水上運動類 | 競技類 | 戶外運動類 | 傳統類 | 冬季運動類
  judgment_url  TEXT,
  judgment_type TEXT DEFAULT '裁判書',
  first_seen_at TEXT NOT NULL,             -- ISO 8601
  last_updated_at TEXT NOT NULL,           -- ISO 8601
  is_active     INTEGER DEFAULT 1          -- 1 = present in latest sync, 0 = removed
);

CREATE INDEX IF NOT EXISTS idx_coaches_sport    ON coaches(sport);
CREATE INDEX IF NOT EXISTS idx_coaches_category ON coaches(category);
CREATE INDEX IF NOT EXISTS idx_coaches_name     ON coaches(name);
CREATE INDEX IF NOT EXISTS idx_coaches_active   ON coaches(is_active);

-- Sync log: one row per cron run
CREATE TABLE IF NOT EXISTS sync_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at      TEXT NOT NULL,
  completed_at    TEXT,
  total_fetched   INTEGER DEFAULT 0,
  new_records     INTEGER DEFAULT 0,
  updated_records INTEGER DEFAULT 0,
  removed_records INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'running',   -- running | success | error
  error           TEXT,
  source_url      TEXT
);

-- Meta key-value store for misc state
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Insert initial meta
INSERT OR IGNORE INTO meta (key, value) VALUES ('source_url', 'https://www.sports.gov.tw/News/6295');
INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');
