# 不適任教練資訊追蹤平台 · Unfit Coach Tracker

> 公部門公開之不適任教練資訊，即時同步、可搜尋、可篩選。
> Built with [Primer.style](https://primer.style/), Cloudflare D1, and cron-synced Workers.

![Architecture](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20Worker%20%2B%20D1-F38020)
![Primer](https://img.shields.io/badge/UI-Primer.style-0969da)
![License](https://img.shields.io/badge/License-MIT-green)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                          │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  Pages (CDN) │    │   Worker     │    │     D1       │ │
│  │              │    │  (cron 06:00)│    │  (SQLite)    │ │
│  │  React +     │───▶│              │───▶│              │ │
│  │  Primer.style│    │  Scrape      │    │  coaches     │ │
│  │              │    │  sports.gov  │    │  sync_log    │ │
│  │  functions/  │───▶│              │    │  meta        │ │
│  │  api/*.ts    │    │  Deterministic│   │              │ │
│  │              │    │  Upsert      │    │              │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                   ▲         │
│         ▼                    ▼                   │         │
│    /api/coaches         POST /sync         read/write      │
│    /api/stats           GET /health                        │
└─────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
   ┌──────────┐                         ┌──────────────────┐
   │  User    │                         │ sports.gov.tw    │
   │  Browser │                         │ /News/6295       │
   └──────────┘                         └──────────────────┘
```

## Quick Start

Requires **Node ≥ 20** and **pnpm** (the repo pins `packageManager`).

```bash
# 1. Install deps
pnpm install

# 2. Create D1 database
pnpm db:create
# → Copy the database_id into wrangler.toml AND wrangler.worker.toml

# 3. Run schema + seed (remote)
pnpm db:migrate
pnpm db:seed

# 4. Deploy cron Worker
pnpm deploy:worker

# 5. Build & deploy frontend + Functions
pnpm deploy:pages

# Or: one-shot deploy (does all of the above, idempotent)
./deploy.sh
```

### Local development

```bash
pnpm dev          # Vite dev server (expects `wrangler pages dev` on :8788 for the API)
pnpm dev:full     # build + wrangler pages dev with a local D1
pnpm typecheck    # tsc --noEmit
```

## Project Structure

```
unfit-coach-tracker/
├── wrangler.toml           # Pages config (dist/ + D1 binding for Functions)
├── wrangler.worker.toml    # Worker config (cron + D1 binding)
├── schema.sql              # D1 schema (coaches, sync_log, meta)
├── seed.sql                # Initial 147 records from OSINT scrape
├── index.html              # Vite entry + SEO meta + JSON-LD
├── vite.config.ts
├── tsconfig.json
│
├── src/                    # Frontend (React + @primer/react)
│   ├── main.tsx            # Entry — ThemeProvider + BaseStyles
│   ├── App.tsx             # Main app — search, filter, table
│   ├── components/
│   │   ├── Header.tsx      # Sticky header + sync badge + stat cards
│   │   ├── SearchBar.tsx   # TextInput + Select (sport filter)
│   │   ├── CategoryTabs.tsx# 球類運動 / 格鬥類 / 水上運動類 ...
│   │   ├── CoachTable.tsx  # Primer Table with judgment links
│   │   └── States.tsx      # Loading / Error states
│   ├── lib/
│   │   ├── types.ts        # TypeScript interfaces + category map
│   │   └── api.ts          # Fetch wrappers for /api/*
│   └── styles/
│       └── app.css         # Global overrides + category label colors
│
├── worker/
│   └── index.ts            # Cron Worker — scrape → deterministic upsert
│
├── functions/api/          # Pages Functions (API layer)
│   ├── coaches.ts          # GET /api/coaches?q=&category=&sport=&page=
│   └── stats.ts            # GET /api/stats
│
├── public/                 # Copied verbatim into dist/
│   ├── favicon.svg
│   ├── apple-touch-icon.png
│   ├── og.png              # 1200×630 social card
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── site.webmanifest
│   └── _headers            # Pages response headers (security + caching)
└── deploy.sh               # One-shot deployment script
```

## D1 Schema

```sql
coaches (
  id            TEXT PK,    -- SHA-256(name|sport|judgment_url)
  name          TEXT,
  sport         TEXT,
  category      TEXT,       -- 球類運動 | 格鬥類 | ...
  judgment_url  TEXT,       -- Link to judicial.gov.tw
  judgment_type TEXT,       -- 裁判書 / 判決書
  first_seen_at TEXT,       -- When first discovered
  last_updated_at TEXT,     -- Last sync that confirmed this record
  is_active     INTEGER     -- 1 = in latest sync, 0 = removed
)

sync_log (
  id, started_at, completed_at, total_fetched,
  new_records, updated_records, removed_records,
  status, error, source_url
)
```

## Deterministic Sync Logic

The Worker's `syncToD1()` function:

1. **Scrape** all pages from `sports.gov.tw/News/6295` via regex-based HTML table parser
2. **Deduplicate** by `(name, sport, judgment_url)` tuple
3. **Compute deterministic ID**: `SHA-256(name + "|" + sport + "|" + judgment_url)`
4. **Upsert**: For each scraped record:
   - If ID exists → `UPDATE` (set `is_active=1`, refresh `last_updated_at`)
   - If ID new → `INSERT` (set `first_seen_at` + `last_updated_at`)
5. **Deactivate**: Records in D1 but NOT in scrape → `SET is_active=0`
6. **Log**: Write `sync_log` entry with counts + status

> **Safety**: If scrape returns 0 records, sync aborts to prevent accidental data wipe.

## Cron Schedule

`wrangler.worker.toml`:

```toml
[triggers]
crons = ["0 6 * * *"]   # Daily at 06:00 UTC = 14:00 Taiwan
```

Manual sync via HTTP:
```bash
curl -X POST https://unfit-coach-sync.<your-subdomain>.workers.dev/sync
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/coaches` | GET | List coaches with `q`, `category`, `sport`, `page`, `per_page` |
| `/api/stats` | GET | Aggregate stats + last sync info |
| `/sync` | POST | Manual trigger (Worker) |
| `/health` | GET | Health check (Worker) |

## SEO

The frontend is a client-rendered SPA, so discoverability is handled at the document level:

| Asset | Purpose |
|-------|---------|
| `index.html` `<head>` | Title/description, canonical, `robots`, Open Graph, Twitter card, `theme-color` |
| JSON-LD `@graph` | `WebSite` (+ `SearchAction`), `Dataset` (source, license, JSON distribution), `WebPage` |
| `<noscript>` block | Human- and crawler-readable summary + links to the open API |
| `public/robots.txt` | Allows crawling, disallows `/api/`, points at the sitemap |
| `public/sitemap.xml` | Single canonical URL, `changefreq: daily` |
| `public/og.png` | 1200×630 social preview card |
| `public/_headers` | `nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS, immutable asset caching, CORS on `/api/*` |

## Data Source

- **Primary**: [運動部「涉及違法事件不適任教練資訊專區」](https://www.sports.gov.tw/News/6295)
- **Legal basis**: 個人資料保護法第16條但書第2款
- **Supplementary**: [教育部各教育場域不適任人員通報及查詢系統](https://unfitinfo.moe.gov.tw/)
- **Local**: [臺中市運動局公告](https://www.sport.taichung.gov.tw/2419024/2428366/3258151)

## Disclaimer

本站僅整理公部門已公開資訊，不對任何裁判書內容做實質判斷。所有資料以官方來源為準。

## License

MIT
