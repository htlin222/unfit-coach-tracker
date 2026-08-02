import { Link, Label, Truncate, Text, Box } from "@primer/react";
import type { Coach } from "../lib/types";
import { CategoryLabel } from "./Header";

export function CoachTable({ coaches }: { coaches: Coach[] }) {
  if (coaches.length === 0) {
    return (
      <Box sx={{ textAlign: "center", padding: 6, color: "fg.muted" }}>
        <Text fontSize={2}>沒有符合條件的紀錄</Text>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        overflowX: "auto",
        border: "1px solid",
        borderColor: "border.default",
        borderRadius: 2,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f6f8fa", borderBottom: "2px solid #d0d7de" }}>
            <th style={thStyle}>#</th>
            <th style={thStyle}>姓名</th>
            <th style={thStyle}>運動種類</th>
            <th style={thStyle}>分類</th>
            <th style={thStyle}>判決</th>
            <th style={thStyle}>判決日期</th>
            <th style={thStyle}>參考連結</th>
          </tr>
        </thead>
        <tbody>
          {coaches.map((c, i) => (
            <tr
              key={c.id}
              className="coach-table-row"
              style={{ borderBottom: "1px solid #d8dee4" }}
            >
              <td style={tdStyle}>
                <Label variant="secondary">{i + 1}</Label>
              </td>
              <td style={tdStyle}>
                <Truncate title={c.name} sx={{ maxWidth: 180, fontWeight: 600 }}>
                  {c.name}
                </Truncate>
              </td>
              <td style={tdStyle}>
                <Label variant="primary">{c.sport}</Label>
              </td>
              <td style={tdStyle}>
                <CategoryLabel category={c.category} />
              </td>
              <td style={tdStyle}>
                {c.court || c.case_no ? (
                  <Box sx={{ lineHeight: 1.4 }}>
                    {c.court && (
                      <Text sx={{ fontSize: 0, display: "block" }}>{c.court}</Text>
                    )}
                    {c.case_no && (
                      <Text
                        sx={{
                          fontSize: 0,
                          color: "fg.muted",
                          fontFamily: "mono",
                          display: "block",
                        }}
                      >
                        {c.case_no}
                      </Text>
                    )}
                  </Box>
                ) : (
                  <Dash />
                )}
              </td>
              <td style={tdStyle}>
                {c.judgment_date ? (
                  <Text sx={{ fontSize: 0, color: "fg.muted", whiteSpace: "nowrap" }}>
                    {c.judgment_date}
                  </Text>
                ) : (
                  <Dash />
                )}
              </td>
              <td style={tdStyle}>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {c.judgment_url && (
                    <RefLink
                      href={c.judgment_url}
                      label={`${c.name} 的${c.judgment_type || "裁判書"}（司法院）`}
                    >
                      {c.judgment_type || "裁判書"} ↗
                    </RefLink>
                  )}
                  {c.source_url && (
                    <RefLink
                      href={c.source_url}
                      label={`${c.name} 的運動部公告內頁`}
                    >
                      公告 ↗
                    </RefLink>
                  )}
                  {!c.judgment_url && !c.source_url && <Dash />}
                </Box>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

// Each row repeats the same link text, so give screen readers the
// coach's name to tell them apart.
function RefLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      sx={{ fontSize: 0, whiteSpace: "nowrap" }}
    >
      {children}
    </Link>
  );
}

function Dash() {
  return <Text sx={{ color: "fg.subtle", fontSize: 0 }}>—</Text>;
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 16px",
  fontWeight: 600,
  fontSize: 12,
  color: "#57606a",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
  verticalAlign: "middle",
};
