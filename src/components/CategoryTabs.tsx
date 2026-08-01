import { CATEGORIES } from "../lib/types";

export function CategoryTabs({
  active,
  onChange,
  counts,
}: {
  active: string;
  onChange: (cat: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div style={{
      display: "flex",
      gap: 4,
      flexWrap: "wrap",
      borderBottom: "1px solid #d0d7de",
      paddingBottom: 0,
    }}>
      {CATEGORIES.map((cat) => {
        const isActive = active === cat;
        const count = counts?.[cat];
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            style={{
              border: "none",
              background: isActive ? "#0969da" : "transparent",
              color: isActive ? "#fff" : "#24292f",
              padding: "6px 14px",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              borderBottom: isActive ? "2px solid #0969da" : "2px solid transparent",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {cat}
            {count != null && (
              <span style={{
                background: isActive ? "rgba(255,255,255,0.25)" : "#eaeef2",
                color: isActive ? "#fff" : "#57606a",
                borderRadius: 10,
                padding: "1px 7px",
                fontSize: 11,
                fontWeight: 600,
                minWidth: 20,
                textAlign: "center",
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
