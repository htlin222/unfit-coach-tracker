import { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, Pagination } from "@primer/react";
import { Header, StatCard, Footer } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { CategoryTabs } from "./components/CategoryTabs";
import { CoachTable } from "./components/CoachTable";
import { LoadingState, ErrorState } from "./components/States";
import { fetchCoaches, fetchStats } from "./lib/api";
import type { Coach, StatsResponse } from "./lib/types";

const PER_PAGE = 25;

export default function App() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [sport, setSport] = useState("");

  // Debounce
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        fetchCoaches({
          q: debouncedQuery || undefined,
          category: category !== "全部" ? category : undefined,
          sport: sport || undefined,
          page,
          per_page: PER_PAGE,
        }),
        fetchStats(),
      ]);
      setCoaches(listRes.data);
      setTotal(listRes.total);
      setStats(statsRes);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, category, sport, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [debouncedQuery, category, sport]);

  const totalPages = Math.ceil(total / PER_PAGE) || 1;

  // Category counts from stats
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { "全部": stats?.active_coaches ?? 0 };
    stats?.by_category?.forEach((c) => { map[c.category] = c.count; });
    return map;
  }, [stats]);

  // All sports list for the dropdown
  const allSports = useMemo(() => {
    return stats?.by_sport?.map((s) => s.sport).sort() ?? [];
  }, [stats]);

  return (
    <Box sx={{ minHeight: "100vh", bg: "#f6f8fa" }}>
      <Header lastSync={stats?.last_sync?.completed_at ?? null} />

      <Box sx={{ maxWidth: 1200, mx: "auto", px: 3, py: 4 }}>
        {/* Stats cards */}
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 4 }}>
          <StatCard label="不適任教練總數" value={stats?.active_coaches ?? "—"} />
          <StatCard label="運動種類數" value={stats?.by_sport?.length ?? "—"} />
          <StatCard label="分類數" value={stats?.by_category?.length ?? "—"} />
          <StatCard
            label="上次同步狀態"
            value={
              <Text
                fontSize={2}
                fontWeight={600}
                sx={{
                  color: stats?.last_sync?.status === "success" ? "success.fg" : "attention.fg",
                }}
              >
                {stats?.last_sync?.status === "success" ? "✓ 成功" : stats?.last_sync?.status ?? "—"}
              </Text>
            }
          >
            {stats?.last_sync && (
              <Text as="div" fontSize={0} sx={{ color: "fg.muted", mt: 1 }}>
                新增 {stats.last_sync.new_records} · 更新 {stats.last_sync.updated_records} · 移除 {stats.last_sync.removed_records}
              </Text>
            )}
          </StatCard>
        </Box>

        {/* Search + sport filter */}
        <Box sx={{ mb: 3 }}>
          <SearchBar
            query={query}
            setQuery={setQuery}
            sport={sport}
            setSport={setSport}
            sports={allSports}
          />
        </Box>

        {/* Category tabs */}
        <Box sx={{ mb: 3 }}>
          <CategoryTabs
            active={category}
            onChange={setCategory}
            counts={categoryCounts}
          />
        </Box>

        {/* Table */}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <>
            <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text fontSize={0} sx={{ color: "fg.muted" }}>
                共 {total} 筆紀錄 · 第 {page}/{totalPages} 頁
              </Text>
            </Box>
            <CoachTable coaches={coaches} />
            {totalPages > 1 && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                <Pagination
                  pageCount={totalPages}
                  currentPage={page}
                  onPageChange={(_, pageNum) => setPage(pageNum)}
                />
              </Box>
            )}
          </>
        )}

        <Footer />
      </Box>
    </Box>
  );
}
