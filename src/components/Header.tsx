import { ReactNode } from "react";
import { Link, Text, Label } from "@primer/react";

export function Header({ lastSync }: { lastSync: string | null }) {
  const syncTime = lastSync
    ? new Date(lastSync).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
    : "尚未同步";

  return (
    <header className="app-header">
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="6" fill="#0969da" />
            <path d="M16 6L8 10v6c0 4.5 3.2 8.5 8 10 4.8-1.5 8-5.5 8-10v-6l-8-4z" fill="#fff" opacity="0.9" />
            <path d="M12 16l2.5 2.5L20 13" stroke="#0969da" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <Text as="div" fontSize={2} fontWeight={700} sx={{ color: "fg.default" }}>
              不適任教練資訊追蹤平台
            </Text>
            <Text as="div" fontSize={0} sx={{ color: "fg.muted" }}>
              Unfit Coach Tracker · 公部門公開資料 · OSINT
            </Text>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="sync-pulse" />
            <Text fontSize={0} sx={{ color: "fg.muted" }}>
              最後同步：{syncTime} (UTC+8)
            </Text>
          </div>
          <Link href="https://www.sports.gov.tw/News/6295" target="_blank" rel="noreferrer" sx={{ fontSize: 0 }}>
            資料來源：運動部 ↗
          </Link>
        </div>
      </div>
    </header>
  );
}

export function CategoryLabel({ category }: { category: string }) {
  if (!category || category === "全部") return null;
  const cls = `cat-${category}`;
  return (
    <span className={cls} style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      background: "var(--cat-bg, #eaeef2)",
      color: "var(--cat-fg, #57606a)",
      whiteSpace: "nowrap",
    }}>
      {category}
    </span>
  );
}

export function StatCard({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #d0d7de",
      borderRadius: 8,
      padding: "16px 20px",
      flex: "1 1 200px",
      minWidth: 200,
    }}>
      <Text as="div" fontSize={0} sx={{ color: "fg.muted", marginBottom: 4 }}>
        {label}
      </Text>
      <Text as="div" fontSize={4} fontWeight={700}>
        {value}
      </Text>
      {children}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="app-footer">
      <Text fontSize={0} sx={{ color: "fg.muted" }}>
        資料來源：<Link href="https://www.sports.gov.tw/News/6295" target="_blank" rel="noreferrer">運動部「涉及違法事件不適任教練資訊專區」</Link>
        {" · "}
        依個人資料保護法第16條但書第2款公開
        {" · "}
        <Link href="https://unfitinfo.moe.gov.tw/" target="_blank" rel="noreferrer">教育部不適任人員系統</Link>
      </Text>
      <Text as="div" fontSize={0} sx={{ color: "fg.subtle", marginTop: 4 }}>
        本站僅整理公部門已公開資訊，不對任何裁判書內容做實質判斷。
      </Text>
    </footer>
  );
}
