// ════════════════════════════════════════════════════════════════
// functions/api/stats.ts — Pages Function
// GET /api/stats — aggregate statistics + last sync info
// ════════════════════════════════════════════════════════════════

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const [totalResult, activeResult, sportResult, categoryResult, syncResult] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as c FROM coaches").first<{ c: number }>(),
    env.DB.prepare("SELECT COUNT(*) as c FROM coaches WHERE is_active = 1").first<{ c: number }>(),
    env.DB.prepare(
      `SELECT sport, COUNT(*) as count FROM coaches WHERE is_active = 1 GROUP BY sport ORDER BY count DESC`
    ).all<{ sport: string; count: number }>(),
    env.DB.prepare(
      `SELECT category, COUNT(*) as count FROM coaches WHERE is_active = 1 GROUP BY category ORDER BY count DESC`
    ).all<{ category: string; count: number }>(),
    env.DB.prepare(
      `SELECT * FROM sync_log ORDER BY id DESC LIMIT 1`
    ).first(),
  ]);

  return json({
    total_coaches: totalResult?.c ?? 0,
    active_coaches: activeResult?.c ?? 0,
    by_sport: sportResult.results,
    by_category: categoryResult.results,
    last_sync: syncResult ?? null,
  });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
