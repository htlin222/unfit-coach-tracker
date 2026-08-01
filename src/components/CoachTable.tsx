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
            <th style={thStyle}>裁判書</th>
            <th style={thStyle}>最後更新</th>
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
                {c.judgment_url ? (
                  <Link
                    href={c.judgment_url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ fontSize: 0 }}
                  >
                    {c.judgment_type} ↗
                  </Link>
                ) : (
                  <Text sx={{ color: "fg.subtle", fontSize: 0 }}>—</Text>
                )}
              </td>
              <td style={tdStyle}>
                <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                  {new Date(c.last_updated_at).toLocaleDateString("zh-TW")}
                </Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
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
