// ════════════════════════════════════════════════════════════════
// worker/index.ts — Cron-triggered Worker
// Scrapes sports.gov.tw and idempotently upserts into D1.
//
// Cron:   daily at 06:00 UTC (14:00 Taiwan) — see wrangler.worker.toml
// Deploy: pnpm deploy:worker
// ════════════════════════════════════════════════════════════════

import {
  type ScrapedCoach,
  deterministicId,
  dedupe,
  parseCoaches,
} from "./parse";

export interface Env {
  DB: D1Database;
  SOURCE_URL: string;
  USER_AGENT: string;
  // Secret — required for POST /sync. Set with:
  //   pnpm exec wrangler secret put SYNC_TOKEN -c wrangler.worker.toml
  SYNC_TOKEN?: string;
}

// A sync that shrinks the roster by more than this fraction is
// treated as a failed scrape rather than 100+ genuine removals.
const MAX_SHRINK_RATIO = 0.4;

// ════════════════════════════════════════════════════════════════
// Fetch + parse
// ════════════════════════════════════════════════════════════════

async function fetchSource(url: string, userAgent: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    },
    cf: { cacheTtl: 300 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return await res.text();
}

async function scrape(url: string, userAgent: string): Promise<{
  coaches: ScrapedCoach[];
  via: string;
}> {
  const html = await fetchSource(url, userAgent);
  const { coaches, via } = parseCoaches(html);
  return { coaches: dedupe(coaches), via };
}

// ════════════════════════════════════════════════════════════════
// Idempotent D1 sync
// ════════════════════════════════════════════════════════════════

interface SyncResult {
  total: number;
  newRecords: number;
  updatedRecords: number;
  removedRecords: number;
  via: string;
}

async function syncToD1(
  db: D1Database,
  scraped: ScrapedCoach[],
  sourceUrl: string,
  via: string
): Promise<SyncResult> {
  const now = new Date().toISOString();

  const logResult = await db
    .prepare(`INSERT INTO sync_log (started_at, status, source_url) VALUES (?, 'running', ?)`)
    .bind(now, sourceUrl)
    .run();
  const logId = logResult.meta?.last_row_id;

  try {
    const existing = await db
      .prepare(`SELECT id FROM coaches WHERE is_active = 1`)
      .all<{ id: string }>();
    const existingIds = new Set(existing.results.map((r) => r.id));

    const withIds = await Promise.all(
      scraped.map(async (c) => ({
        ...c,
        id: await deterministicId(c.name, c.sport, c.judgmentUrl),
      }))
    );
    const scrapedIds = new Set(withIds.map((c) => c.id));

    // Guard: a partial or malformed scrape must not deactivate the
    // roster wholesale. Only meaningful once we have a baseline.
    const wouldRemove = [...existingIds].filter((id) => !scrapedIds.has(id)).length;
    if (existingIds.size > 0 && wouldRemove / existingIds.size > MAX_SHRINK_RATIO) {
      throw new Error(
        `Refusing to sync: would deactivate ${wouldRemove}/${existingIds.size} records ` +
        `(> ${MAX_SHRINK_RATIO * 100}%). Scraped ${scraped.length} via ${via}.`
      );
    }

    const upsert = db.prepare(
      `INSERT INTO coaches
         (id, name, sport, category, judgment_url, judgment_type, source_url,
          court, case_no, judgment_date, first_seen_at, last_updated_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         sport = excluded.sport,
         category = excluded.category,
         judgment_url = excluded.judgment_url,
         judgment_type = excluded.judgment_type,
         source_url = excluded.source_url,
         court = excluded.court,
         case_no = excluded.case_no,
         judgment_date = excluded.judgment_date,
         last_updated_at = excluded.last_updated_at,
         is_active = 1`
    );

    const statements = withIds.map((c) =>
      upsert.bind(
        c.id, c.name, c.sport, c.category,
        c.judgmentUrl || null, c.judgmentType, c.sourceUrl || null,
        c.court || null, c.caseNo || null, c.judgmentDate || null,
        now, now
      )
    );

    // Deactivate anything that fell out of the source.
    const removedIds = [...existingIds].filter((id) => !scrapedIds.has(id));
    for (const id of removedIds) {
      statements.push(
        db
          .prepare(`UPDATE coaches SET is_active = 0, last_updated_at = ? WHERE id = ?`)
          .bind(now, id)
      );
    }

    // D1 caps a batch; chunk to stay well inside it.
    for (let i = 0; i < statements.length; i += 100) {
      await db.batch(statements.slice(i, i + 100));
    }

    const newRecords = withIds.filter((c) => !existingIds.has(c.id)).length;
    const updatedRecords = withIds.length - newRecords;

    await db
      .prepare(
        `UPDATE sync_log
         SET completed_at = ?, total_fetched = ?, new_records = ?, updated_records = ?,
             removed_records = ?, status = 'success'
         WHERE id = ?`
      )
      .bind(
        new Date().toISOString(), scraped.length,
        newRecords, updatedRecords, removedIds.length, logId
      )
      .run();

    return {
      total: scraped.length,
      newRecords,
      updatedRecords,
      removedRecords: removedIds.length,
      via,
    };
  } catch (err) {
    await db
      .prepare(`UPDATE sync_log SET completed_at = ?, status = 'error', error = ? WHERE id = ?`)
      .bind(
        new Date().toISOString(),
        err instanceof Error ? err.message : String(err),
        logId
      )
      .run();
    throw err;
  }
}

async function runSync(env: Env): Promise<SyncResult> {
  const sourceUrl = env.SOURCE_URL || "https://www.sports.gov.tw/News/6295";
  const userAgent = env.USER_AGENT || "unfit-coach-tracker/1.0";

  console.log(`[sync] scraping ${sourceUrl}`);
  const { coaches, via } = await scrape(sourceUrl, userAgent);
  console.log(`[sync] parsed ${coaches.length} records via ${via}`);

  if (coaches.length === 0) {
    throw new Error("Scrape returned 0 records — aborting to prevent data loss");
  }

  const result = await syncToD1(env.DB, coaches, sourceUrl, via);
  console.log(
    `[sync] done: ${result.newRecords} new, ${result.updatedRecords} updated, ` +
    `${result.removedRecords} removed`
  );
  return result;
}

// ════════════════════════════════════════════════════════════════
// Worker entry point
// ════════════════════════════════════════════════════════════════

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runSync(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/sync" && request.method === "POST") {
      // Fail closed: without a configured secret, /sync is disabled.
      const expected = env.SYNC_TOKEN;
      if (!expected) {
        return Response.json(
          { ok: false, error: "SYNC_TOKEN is not configured — /sync is disabled" },
          { status: 503 }
        );
      }
      const provided = request.headers.get("X-Sync-Token") ?? "";
      if (!timingSafeEqual(provided, expected)) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      try {
        return Response.json({ ok: true, ...(await runSync(env)) });
      } catch (err) {
        return Response.json(
          { ok: false, error: err instanceof Error ? err.message : String(err) },
          { status: 500 }
        );
      }
    }

    // Read-only probe: does the source still fetch and parse? Touches
    // no data, so it is safe to leave unauthenticated.
    if (url.pathname === "/debug/source") {
      const sourceUrl = env.SOURCE_URL || "https://www.sports.gov.tw/News/6295";
      try {
        const html = await fetchSource(sourceUrl, env.USER_AGENT || "unfit-coach-tracker/1.0");
        const { coaches, via } = parseCoaches(html);
        const deduped = dedupe(coaches);
        return Response.json({
          ok: true,
          bytes: html.length,
          via,
          parsed: coaches.length,
          deduped: deduped.length,
          withJudgmentUrl: deduped.filter((c) => c.judgmentUrl).length,
          withSourceUrl: deduped.filter((c) => c.sourceUrl).length,
          sample: deduped.slice(0, 2),
        });
      } catch (err) {
        return Response.json(
          { ok: false, error: err instanceof Error ? err.message : String(err) },
          { status: 502 }
        );
      }
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, time: new Date().toISOString() });
    }

    return new Response(
      "Unfit Coach Sync Worker\n\n" +
      "  POST /sync          — manual sync (requires X-Sync-Token)\n" +
      "  GET  /debug/source  — dry-run scrape, writes nothing\n" +
      "  GET  /health        — health check\n",
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  },
};
