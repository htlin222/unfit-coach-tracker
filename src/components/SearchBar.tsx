import { TextInput, Button, Select } from "@primer/react";
import { SearchIcon, XIcon } from "@primer/octicons-react";

export function SearchBar({
  query, setQuery,
  sport, setSport,
  sports,
}: {
  query: string;
  setQuery: (v: string) => void;
  sport: string;
  setSport: (v: string) => void;
  sports: string[];
}) {
  return (
    <div style={{
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "center",
    }}>
      <div style={{ flex: "1 1 280px", position: "relative" }}>
        <TextInput
          leadingVisual={SearchIcon}
          placeholder="搜尋教練姓名…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          trailingAction={query ? (
            <TextInput.Action
              icon={XIcon}
              aria-label="清除搜尋"
              onClick={() => setQuery("")}
            />
          ) : undefined}
          block
          sx={{ fontSize: 1, py: 1 }}
        />
      </div>

      <div style={{ minWidth: 160 }}>
        <Select value={sport} onChange={(e) => setSport(e.target.value)}>
          <Select.Option value="">所有運動種類</Select.Option>
          {sports.map((s) => (
            <Select.Option key={s} value={s}>{s}</Select.Option>
          ))}
        </Select>
      </div>
    </div>
  );
}
