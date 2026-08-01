// ════════════════════════════════════════════════════════════════
// functions/api/coaches.ts — Pages Function
// GET /api/coaches?q=&category=&sport=&page=&per_page=&id=
// ════════════════════════════════════════════════════════════════

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);
  const params = url.searchParams;

  const q = params.get("q")?.trim() || "";
  const category = params.get("category") || "";
  const sport = params.get("sport") || "";
  const id = params.get("id") || "";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const perPage = Math.min(200, Math.max(1, parseInt(params.get("per_page") || "50", 10)));
  const offset = (page - 1) * perPage;

  // Build WHERE clause dynamically
  const conditions: string[] = ["is_active = 1"];
  const binds: (string | number)[] = [];

  if (id) {
    conditions.push("id = ?");
    binds.push(id);
  }
  if (q) {
    conditions.push("name LIKE ?");
    binds.push(`%${q}%`);
  }
  if (category) {
    conditions.push("category = ?");
    binds.push(category);
  }
  if (sport) {
    conditions.push("sport = ?");
    binds.push(sport);
  }

  const whereClause = conditions.join(" AND ");

  // Count total matching records
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM coaches WHERE ${whereClause}`
  ).bind(...binds).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  // Fetch page of results
  const dataResult = await env.DB.prepare(
    `SELECT id, name, sport, category, judgment_url, judgment_type, first_seen_at, last_updated_at, is_active
     FROM coaches
     WHERE ${whereClause}
     ORDER BY category, sport, name
     LIMIT ? OFFSET ?`
  ).bind(...binds, perPage, offset).all();

  return json({
    data: dataResult.results,
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage) || 1,
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
