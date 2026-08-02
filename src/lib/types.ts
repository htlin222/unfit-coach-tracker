// ════════════════════════════════════════════════════════════════
// Type definitions
// ════════════════════════════════════════════════════════════════

export interface Coach {
  id: string;
  name: string;
  sport: string;
  category: string;
  judgment_url: string | null;
  judgment_type: string;
  source_url: string | null;      // 運動部該筆公告內頁
  court: string | null;           // 法院全名
  case_no: string | null;         // 114年度台上字第3014號
  judgment_date: string | null;   // YYYY-MM-DD
  first_seen_at: string;
  last_updated_at: string;
  is_active: number;
}

export interface CoachListResponse {
  data: Coach[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface StatsResponse {
  total_coaches: number;
  active_coaches: number;
  by_sport: { sport: string; count: number }[];
  by_category: { category: string; count: number }[];
  last_sync: SyncLog | null;
}

export interface SyncLog {
  id: number;
  started_at: string;
  completed_at: string | null;
  total_fetched: number;
  new_records: number;
  updated_records: number;
  removed_records: number;
  status: string;
  error: string | null;
  source_url: string;
}

// ── Sport → Category mapping (mirrors the official site) ──────────
export const SPORT_CATEGORY_MAP: Record<string, string> = {
  // 球類運動
  籃球: "球類運動", 棒球: "球類運動", 桌球: "球類運動", 羽球: "球類運動",
  橄欖球: "球類運動", 曲棍球: "球類運動", 冰上曲棍球: "球類運動",
  足球: "球類運動", 排球: "球類運動", 卡巴迪: "球類運動",
  手球: "球類運動", 網球: "球類運動", 壘球: "球類運動",
  保齡球: "球類運動", 撞球: "球類運動",
  // 格鬥類
  跆拳道: "格鬥類", 柔道: "格鬥類", 拳擊: "格鬥類", 擊劍: "格鬥類",
  空手道: "格鬥類", 泰國拳: "格鬥類", 柔術: "格鬥類",
  // 目標類
  射擊: "目標類", 射箭: "目標類",
  // 水上運動類
  游泳: "水上運動類", 輕艇: "水上運動類", 滑水: "水上運動類",
  划船: "水上運動類", 帆船: "水上運動類", 蹼泳: "水上運動類",
  // 競技類
  舉重: "競技類", 健美: "競技類", 健力: "競技類", 自由車: "競技類",
  滑輪溜冰: "競技類", 田徑: "競技類", 定向越野: "競技類", 合球: "競技類",
  // 戶外運動類
  高爾夫: "戶外運動類",
  // 傳統類
  國武術: "傳統類",
  // 冬季運動類
  雪橇: "冬季運動類", 滑雪系列: "冬季運動類", 滑冰系列: "冬季運動類",
};

export const CATEGORIES = [
  "全部", "球類運動", "格鬥類", "目標類",
  "水上運動類", "競技類", "戶外運動類", "傳統類", "冬季運動類",
];
