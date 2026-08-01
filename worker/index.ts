// ════════════════════════════════════════════════════════════════
// worker/index.ts — Cron-triggered Worker
// Deterministically scrapes sports.gov.tw and upserts into D1.
//
// Cron: daily at 06:00 UTC (14:00 Taiwan)
// Deploy: npx wrangler deploy
// ════════════════════════════════════════════════════════════════

export interface Env {
  DB: D1Database;
  SOURCE_URL: string;
  USER_AGENT: string;
}

// ── Category mapping (mirrors frontend) ───────────────────────────
const SPORT_CATEGORY: Record<string, string> = {
  籃球: "球類運動", 棒球: "球類運動", 桌球: "球類運動", 羽球: "球類運動",
  橄欖球: "球類運動", 曲棍球: "球類運動", 冰上曲棍球: "球類運動",
  足球: "球類運動", 排球: "球類運動", 卡巴迪: "球類運動",
  手球: "球類運動", 網球: "球類運動", 壘球: "球類運動",
  保齡球: "球類運動", 撞球: "球類運動",
  跆拳道: "格鬥類", 柔道: "格鬥類", 拳擊: "格鬥類", 擊劍: "格鬥類",
  空手道: "格鬥類", 泰國拳: "格鬥類", 柔術: "格鬥類",
  射擊: "目標類", 射箭: "目標類",
  游泳: "水上運動類", 輕艇: "水上運動類", 滑水: "水上運動類",
  划船: "水上運動類", 帆船: "水上運動類", 蹼泳: "水上運動類",
  舉重: "競技類", 健美: "競技類", 健力: "競技類", 自由車: "競技類",
  滑輪溜冰: "競技類", 田徑: "競技類", 定向越野: "競技類", 合球: "競技類",
  高爾夫: "戶外運動類",
  國武術: "傳統類",
  雪橇: "冬季運動類", 滑雪系列: "冬季運動類", 滑冰系列: "冬季運動類",
};

// ── Deterministic ID: SHA-256(name|sport|judgment_url) ───────────
async function deterministicId(name: string, sport: string, judgmentUrl: string): Promise<string> {
  const raw = `${name}|${sport}|${judgmentUrl}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Parsed record ─────────────────────────────────────────────────
interface ScrapedCoach {
  name: string;
  sport: string;
  category: string;
  judgmentUrl: string;
  judgmentType: string;
}

// ════════════════════════════════════════════════════════════════
// HTML Scraper — uses HTMLRewriter (streaming, no DOM needed)
// ════════════════════════════════════════════════════════════════

async function scrapePage(url: string, userAgent: string): Promise<ScrapedCoach[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    },
    cf: { cacheTtl: 300 },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

  const html = await res.text();
  const coaches = parseTableFromHTML(html);

  // Try to detect total pages from the HTML
  const totalPagesMatch = html.match(/\/\s*(\d+)\s*頁/);
  const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1], 10) : 1;

  // The CMS uses JavaScript pagination. Try common patterns for subsequent pages.
  // Pattern 1: CCMS often uses POST with form data or query params
  if (totalPages > 1) {
    for (let p = 2; p <= totalPages; p++) {
      try {
        // Try query parameter approach
        const pageUrl = new URL(url);
        pageUrl.searchParams.set("page", String(p));
        const pageRes = await fetch(pageUrl.toString(), {
          headers: {
            "User-Agent": userAgent,
            "Accept": "text/html,application/xhtml+xml",
            "Referer": url,
          },
          cf: { cacheTtl: 300 },
        });
        if (pageRes.ok) {
          const pageHtml = await pageRes.text();
          const pageCoaches = parseTableFromHTML(pageHtml);
          if (pageCoaches.length > 0) {
            coaches.push(...pageCoaches);
          } else {
            break; // No more data via this method
          }
        } else {
          break;
        }
      } catch {
        break; // Stop if pagination fails — we have at least page 1
      }
    }
  }

  // Deduplicate by (name, sport, judgmentUrl)
  const seen = new Set<string>();
  return coaches.filter((c) => {
    const key = `${c.name}|${c.sport}|${c.judgmentUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Parse <table> rows from HTML ──────────────────────────────────
function parseTableFromHTML(html: string): ScrapedCoach[] {
  const coaches: ScrapedCoach[] = [];

  // Extract table rows using regex (HTMLRewriter is streaming but
  // we need correlated row data; regex on the full HTML is pragmatic
  // for this known CMS structure)
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    // Table structure: [序號, 姓名, 運動種類, 涉及違法事件相關資訊]
    // Skip header rows and malformed rows
    if (cells.length >= 3 && cells[0] && /^\d+$/.test(cells[0])) {
      const name = cells[1];
      const sport = cells[2];

      // Extract judgment URL from the row HTML
      const hrefMatch = rowHtml.match(/href=["']([^"']*judgment\.judicial\.gov\.tw[^"']*)["']/i);
      const judgmentUrl = hrefMatch ? hrefMatch[1] : "";
      const judgmentType = cells[3] || "裁判書";

      if (name && sport) {
        coaches.push({
          name,
          sport,
          category: SPORT_CATEGORY[sport] ?? "其他",
          judgmentUrl: judgmentUrl || "",
          judgmentType,
        });
      }
    }
  }

  return coaches;
}

// ════════════════════════════════════════════════════════════════
// Deterministic D1 Sync
// ════════════════════════════════════════════════════════════════

async function syncToD1(db: D1Database, scraped: ScrapedCoach[], sourceUrl: string): Promise<{
  total: number;
  newRecords: number;
  updatedRecords: number;
  removedRecords: number;
}> {
  const now = new Date().toISOString();

  // 1. Start sync log
  const logResult = await db.prepare(
    `INSERT INTO sync_log (started_at, status, source_url) VALUES (?, 'running', ?)`
  ).bind(now, sourceUrl).run();
  const logId = logResult.meta?.last_row_id;

  try {
    // 2. Get all current active IDs
    const existing = await db.prepare(
      `SELECT id FROM coaches WHERE is_active = 1`
    ).all<{ id: string }>();
    const existingIds = new Set(existing.results.map((r) => r.id));

    // 3. Compute deterministic IDs for scraped data
    const scrapedWithIds = await Promise.all(
      scraped.map(async (c) => ({
        ...c,
        id: await deterministicId(c.name, c.sport, c.judgmentUrl),
      }))
    );

    const scrapedIds = new Set(scrapedWithIds.map((c) => c.id));

    // 4. Upsert each record
    let newRecords = 0;
    let updatedRecords = 0;

    for (const c of scrapedWithIds) {
      if (existingIds.has(c.id)) {
        // Update existing
        await db.prepare(
          `UPDATE coaches
           SET name = ?, sport = ?, category = ?, judgment_url = ?, judgment_type = ?,
               last_updated_at = ?, is_active = 1
           WHERE id = ?`
        ).bind(c.name, c.sport, c.category, c.judgmentUrl || null, c.judgmentType, now, c.id).run();
        updatedRecords++;
      } else {
        // Insert new
        await db.prepare(
          `INSERT INTO coaches (id, name, sport, category, judgment_url, judgment_type, first_seen_at, last_updated_at, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
        ).bind(c.id, c.name, c.sport, c.category, c.judgmentUrl || null, c.judgmentType, now, now).run();
        newRecords++;
      }
    }

    // 5. Mark removed records as inactive
    let removedRecords = 0;
    for (const id of existingIds) {
      if (!scrapedIds.has(id)) {
        await db.prepare(
          `UPDATE coaches SET is_active = 0, last_updated_at = ? WHERE id = ?`
        ).bind(now, id).run();
        removedRecords++;
      }
    }

    // 6. Complete sync log
    await db.prepare(
      `UPDATE sync_log
       SET completed_at = ?, total_fetched = ?, new_records = ?, updated_records = ?,
           removed_records = ?, status = 'success'
       WHERE id = ?`
    ).bind(new Date().toISOString(), scraped.length, newRecords, updatedRecords, removedRecords, logId).run();

    return { total: scraped.length, newRecords, updatedRecords, removedRecords };
  } catch (err) {
    // Log error
    await db.prepare(
      `UPDATE sync_log SET completed_at = ?, status = 'error', error = ? WHERE id = ?`
    ).bind(new Date().toISOString(), err instanceof Error ? err.message : String(err), logId).run();
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════
// Worker entry point
// ════════════════════════════════════════════════════════════════

export default {
  // Cron trigger
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runSync(env));
  },

  // HTTP trigger (manual sync via POST /sync)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/sync" && request.method === "POST") {
      // Optional: protect with a secret header
      const authHeader = request.headers.get("X-Sync-Token");
      const expectedToken = env.USER_AGENT; // repurpose as weak token; override in prod
      // In production, set SYNC_TOKEN as a secret and compare
      // if (authHeader !== expectedToken) return new Response("Unauthorized", { status: 401 });

      try {
        const result = await runSync(env);
        return Response.json({ ok: true, ...result });
      } catch (err) {
        return Response.json(
          { ok: false, error: err instanceof Error ? err.message : String(err) },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, time: new Date().toISOString() });
    }

    return new Response("Unfit Coach Sync Worker\n\nEndpoints:\n  POST /sync  — manual sync\n  GET  /health — health check\n", {
      headers: { "content-type": "text/plain" },
    });
  },
};

async function runSync(env: Env): Promise<{
  total: number;
  newRecords: number;
  updatedRecords: number;
  removedRecords: number;
}> {
  const sourceUrl = env.SOURCE_URL || "https://www.sports.gov.tw/News/6295";
  const userAgent = env.USER_AGENT || "unfit-coach-tracker/1.0";

  console.log(`[sync] Starting scrape of ${sourceUrl}`);
  const scraped = await scrapePage(sourceUrl, userAgent);
  console.log(`[sync] Scraped ${scraped.length} records`);

  if (scraped.length === 0) {
    throw new Error("Scrape returned 0 records — aborting sync to prevent data loss");
  }

  console.log(`[sync] Upserting into D1...`);
  const result = await syncToD1(env.DB, scraped, sourceUrl);
  console.log(`[sync] Done: ${result.newRecords} new, ${result.updatedRecords} updated, ${result.removedRecords} removed`);

  return result;
}
