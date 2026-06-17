"use client";

interface Props {
  seasons: number[];
  selected: number | null;
  onChange: (s: number | null) => void;
}

export default function SeasonFilter({ seasons, selected, onChange }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onChange(null)}
        className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
        style={{
          background: selected === null ? "#c8a951" : "transparent",
          color: selected === null ? "#08080f" : "#7a7898",
          border: `1px solid ${selected === null ? "#c8a951" : "#1e1e38"}`,
        }}>
        All Time
      </button>
      {seasons.map(s => (
        <button key={s}
          onClick={() => onChange(s)}
          className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
          style={{
            background: selected === s ? "#c8a951" : "transparent",
            color: selected === s ? "#08080f" : "#7a7898",
            border: `1px solid ${selected === s ? "#c8a951" : "#1e1e38"}`,
          }}>
          {s}
        </button>
      ))}
    </div>
  );
}
