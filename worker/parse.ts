// ════════════════════════════════════════════════════════════════
// worker/parse.ts — Pure parsing helpers, shared by the Worker and
// by scripts/gen-seed.mjs (Node ≥22 strips the types natively).
//
// No Cloudflare-specific APIs here beyond WebCrypto, which Node has
// too — keep it that way so the seed generator stays in sync with
// what the Worker will compute at sync time.
// ════════════════════════════════════════════════════════════════

export const SOURCE_PAGE = "https://www.sports.gov.tw/News/6295";
const SITE_ORIGIN = "https://www.sports.gov.tw";

// ── Sport → category (mirrors the official site's grouping) ───────
export const SPORT_CATEGORY: Record<string, string> = {
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

// ── 司法院 court codes (first 3 chars of the judgment id) ─────────
// The 4th char is the division: M = 刑事. We key on the first three
// so a civil/administrative id would still resolve to the right court.
const COURT_NAMES: Record<string, string> = {
  TPS: "最高法院",
  TPH: "臺灣高等法院",
  TCH: "臺灣高等法院臺中分院",
  TNH: "臺灣高等法院臺南分院",
  KSH: "臺灣高等法院高雄分院",
  HLH: "臺灣高等法院花蓮分院",
  TPD: "臺灣臺北地方法院",
  SLD: "臺灣士林地方法院",
  PCD: "臺灣新北地方法院",
  ILD: "臺灣宜蘭地方法院",
  KLD: "臺灣基隆地方法院",
  TYD: "臺灣桃園地方法院",
  SCD: "臺灣新竹地方法院",
  MLD: "臺灣苗栗地方法院",
  TCD: "臺灣臺中地方法院",
  CHD: "臺灣彰化地方法院",
  NTD: "臺灣南投地方法院",
  ULD: "臺灣雲林地方法院",
  CYD: "臺灣嘉義地方法院",
  TND: "臺灣臺南地方法院",
  KSD: "臺灣高雄地方法院",
  CTD: "臺灣橋頭地方法院",
  PTD: "臺灣屏東地方法院",
  TTD: "臺灣臺東地方法院",
  HLD: "臺灣花蓮地方法院",
  PHD: "臺灣澎湖地方法院",
  KMD: "福建金門地方法院",
  LCD: "福建連江地方法院",
};

export interface CaseMeta {
  court: string;         // 法院全名, or the raw code when unknown
  caseNo: string;        // e.g. 114年度台上字第3014號
  judgmentDate: string;  // YYYY-MM-DD
}

// ── Decode a judgment.judicial.gov.tw permalink ───────────────────
// The `id` query param looks like:
//   TPSM,114,台上,3014,20250717,1
//   TNHM,105,重侵上更(一),1,20170815,1   ← 字別 may contain a comma-ish
// Fields after 年度 are variable-length, so anchor on the 8-digit
// date scanned from the right rather than on a fixed index.
export function parseCaseId(judgmentUrl: string): CaseMeta | null {
  if (!judgmentUrl) return null;

  let rawId = "";
  try {
    rawId = new URL(judgmentUrl).searchParams.get("id") ?? "";
  } catch {
    const m = judgmentUrl.match(/[?&]id=([^&]+)/);
    rawId = m ? decodeURIComponent(m[1]) : "";
  }
  if (!rawId) return null;

  const parts = rawId.split(",");
  if (parts.length < 4) return null;

  // Rightmost 8-digit field is the judgment date.
  let dateIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d{8}$/.test(parts[i])) { dateIdx = i; break; }
  }
  // Need at least [court, year, ...word, num, date]
  if (dateIdx < 3) return null;

  const courtCode = parts[0];
  const year = parts[1];
  const num = parts[dateIdx - 1];
  const word = parts.slice(2, dateIdx - 1).join(",");
  const d = parts[dateIdx];

  const court = COURT_NAMES[courtCode.slice(0, 3)] ?? courtCode;
  const caseNo = word && num ? `${year}年度${word}字第${num}號` : "";
  const judgmentDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

  return { court, caseNo, judgmentDate };
}

// ── Deterministic ID: SHA-256(name|sport|judgment_url) ────────────
export async function deterministicId(
  name: string,
  sport: string,
  judgmentUrl: string
): Promise<string> {
  const raw = `${name}|${sport}|${judgmentUrl}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ScrapedCoach {
  name: string;
  sport: string;
  category: string;
  judgmentUrl: string;
  judgmentType: string;   // 裁判書 | 判決書
  sourceUrl: string;      // per-record announcement page on sports.gov.tw
  court: string;
  caseNo: string;
  judgmentDate: string;
}

function toCoach(
  name: string,
  sport: string,
  judgmentType: string,
  judgmentUrl: string,
  sourceUrl: string
): ScrapedCoach {
  const meta = parseCaseId(judgmentUrl);
  return {
    name,
    sport,
    category: SPORT_CATEGORY[sport] ?? "其他",
    judgmentUrl,
    judgmentType: judgmentType || "裁判書",
    sourceUrl,
    court: meta?.court ?? "",
    caseNo: meta?.caseNo ?? "",
    judgmentDate: meta?.judgmentDate ?? "",
  };
}

// ── Primary parser: the page embeds the FULL dataset ──────────────
// sports.gov.tw runs a Vue list that paginates client-side from a
// `let DefaultData = [ ... ]` literal in an inline <script>. Reading
// it gives every record from a single request — no pagination to
// guess at, and no risk of a partial fetch looking like a deletion.
export function parseDefaultData(html: string): ScrapedCoach[] {
  const marker = html.indexOf("DefaultData");
  if (marker === -1) return [];

  const open = html.indexOf("[", marker);
  if (open === -1) return [];

  // Brace-match to find the end of the array literal, skipping over
  // brackets that appear inside string values.
  let depth = 0;
  let end = -1;
  let inStr = false;
  let escaped = false;
  for (let i = open; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) return [];

  let rows: Record<string, unknown>[];
  try {
    rows = JSON.parse(html.slice(open, end));
  } catch {
    return [];
  }

  const coaches: ScrapedCoach[] = [];
  for (const r of rows) {
    const name = String(r["姓名"] ?? "").trim();
    const sport = String(r["運動種類"] ?? "").trim();
    if (!name || !sport) continue;

    // "裁判書(https://judgment.judicial.gov.tw/...)" — the URL itself
    // can contain ")", so match the label lazily and the URL greedily.
    const info = String(r["涉及違法事件相關資訊"] ?? "");
    const m = info.match(/^([^(]*)\((.+)\)\s*$/);
    const judgmentType = m ? m[1].trim() : info.trim();
    const judgmentUrl = m ? m[2].trim() : "";

    const path = String(r["Path"] ?? "").trim();
    const sourceUrl = path ? `${SITE_ORIGIN}${path}` : "";

    coaches.push(toCoach(name, sport, judgmentType, judgmentUrl, sourceUrl));
  }
  return coaches;
}

// ── Fallback parser: the rendered <table> (page 1 only) ───────────
// Kept so a CMS change that drops DefaultData degrades to partial
// data instead of nothing. Callers must treat a short result as
// suspect — see the shrink guard in the Worker.
export function parseTableFromHTML(html: string): ScrapedCoach[] {
  const coaches: ScrapedCoach[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    // [序號, 姓名, 運動種類, 涉及違法事件相關資訊]
    if (cells.length < 3 || !/^\d+$/.test(cells[0] ?? "")) continue;

    const name = cells[1];
    const sport = cells[2];
    if (!name || !sport) continue;

    const hrefMatch = rowHtml.match(
      /href=["']([^"']*judgment\.judicial\.gov\.tw[^"']*)["']/i
    );
    const judgmentUrl = hrefMatch ? hrefMatch[1].replace(/&amp;/g, "&") : "";
    // cells[3] is the link's anchor text (裁判書 / 判決書), not the
    // whole cell — the tag strip above already reduced it to that.
    const judgmentType = (cells[3] || "").trim() || "裁判書";

    const snMatch = rowHtml.match(/\/News_Content\/6295\/(\d+)/);
    const sourceUrl = snMatch ? `${SITE_ORIGIN}/News_Content/6295/${snMatch[1]}` : "";

    coaches.push(toCoach(name, sport, judgmentType, judgmentUrl, sourceUrl));
  }
  return coaches;
}

// ── Parse, preferring the embedded dataset ────────────────────────
export function parseCoaches(html: string): { coaches: ScrapedCoach[]; via: string } {
  const embedded = parseDefaultData(html);
  if (embedded.length > 0) return { coaches: embedded, via: "DefaultData" };
  return { coaches: parseTableFromHTML(html), via: "table" };
}

// ── Dedupe on the same tuple the primary key is built from ────────
export function dedupe(coaches: ScrapedCoach[]): ScrapedCoach[] {
  const seen = new Set<string>();
  return coaches.filter((c) => {
    const key = `${c.name}|${c.sport}|${c.judgmentUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
