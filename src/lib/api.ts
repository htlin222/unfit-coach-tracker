// ════════════════════════════════════════════════════════════════
// API client — talks to Pages Functions
// ════════════════════════════════════════════════════════════════

import type { CoachListResponse, StatsResponse, Coach } from "./types";

const BASE = import.meta.env.DEV
  ? "http://localhost:8788" // wrangler pages dev default
  : "";

export async function fetchCoaches(params: {
  q?: string;
  category?: string;
  sport?: string;
  page?: number;
  per_page?: number;
}): Promise<CoachListResponse> {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category && params.category !== "全部") sp.set("category", params.category);
  if (params.sport) sp.set("sport", params.sport);
  sp.set("page", String(params.page ?? 1));
  sp.set("per_page", String(params.per_page ?? 50));

  const res = await fetch(`${BASE}/api/coaches?${sp}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(`${BASE}/api/stats`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchCoachById(id: string): Promise<Coach | null> {
  const res = await fetch(`${BASE}/api/coaches?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as CoachListResponse;
  return data.data?.[0] ?? null;
}
