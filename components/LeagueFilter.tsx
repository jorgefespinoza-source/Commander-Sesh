"use client";

export type League = "ALL" | "RD" | "MX";
export const COL_RD = "#C0392B";
export const COL_MX = "#27AE60";
export const leagueColor = (l?: string) => (l === "RD" ? COL_RD : l === "MX" ? COL_MX : "#7a7898");

/** All / RD / MX chip selector used across views. */
export default function LeagueFilter({ value, onChange }: {
  value: League;
  onChange: (l: League) => void;
}) {
  const chips: { key: League; label: string; color: string }[] = [
    { key: "ALL", label: "All",  color: "#c8a951" },
    { key: "RD",  label: "RD",   color: COL_RD },
    { key: "MX",  label: "MX",   color: COL_MX },
  ];
  return (
    <div className="flex gap-1">
      {chips.map(c => {
        const on = value === c.key;
        return (
          <button key={c.key} onClick={() => onChange(c.key)}
            className="px-3 py-1 rounded-full text-xs font-cinzel font-semibold transition-all"
            style={{
              background: on ? `${c.color}22` : "#0f0f1c",
              color: on ? c.color : "#7a7898",
              border: `1px solid ${on ? c.color : "#1e1e38"}`,
            }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
