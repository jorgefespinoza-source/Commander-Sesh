"use client";
import { useEffect, useState, useMemo } from "react";
import { getGames, getElo } from "@/lib/data";
import { getAllPlayerStats, getSeasons, filterBySeason, fmt } from "@/lib/stats";
import type { GameEntry, PlayerStats } from "@/lib/types";
import SeasonFilter from "@/components/SeasonFilter";
import Link from "next/link";
import ScryfallArt from "@/components/ScryfallArt";
import ArcaneBackdrop from "@/components/ArcaneBackdrop";

const MEDALS = ["🥇", "🥈", "🥉"];

type SortKey = "winRate" | "wins";
const SORT_LABELS: Record<SortKey, string> = { winRate: "Win %", wins: "Wins" };

export default function LeaderboardPage() {
  const [games, setGames]   = useState<GameEntry[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("winRate");
  const [loading, setLoading] = useState(true);

  const [roster, setRoster] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([getGames(), getElo()]).then(([g, e]) => {
      setGames(g);
      setRoster(new Set(e.map(x => x.player)));
      setLoading(false);
    });
  }, []);

  const seasons  = useMemo(() => getSeasons(games), [games]);
  const filtered = useMemo(() => filterBySeason(games, season), [games, season]);
  const stats    = useMemo(() =>
    getAllPlayerStats(filtered)
      .filter(p => roster.size === 0 || roster.has(p.name))  // league members only
      .sort((a, b) => b[sortBy] - a[sortBy] || b.winRate - a.winRate || b.wins - a.wins),
    [filtered, sortBy, roster]);

  const totalGames = useMemo(() => {
    return new Set(filtered.map(g => `${g.date}-${g.gameNum}`)).size;
  }, [filtered]);

  if (loading) return <LoadingSkeleton />;

  const maxWins = Math.max(...stats.map(s => s.wins), 1);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      {stats[0] && <ArcaneBackdrop deckName={stats[0].favDeck} />}
      <div className="text-center mb-5">
        <h1 className="font-cinzel text-3xl font-bold text-gold-gradient mb-1">Commander Sesh</h1>
        <p className="text-muted text-sm">{totalGames} games played · only 1st place counts</p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted font-semibold uppercase tracking-widest">Season</span>
        <SeasonFilter seasons={seasons} selected={season} onChange={setSeason} />
      </div>

      {/* Sort toggle */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "#0f0f1c" }}>
        {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
          <button key={k} onClick={() => setSortBy(k)}
            className="flex-1 py-1.5 rounded-md text-xs font-cinzel font-semibold transition-all"
            style={{
              background: sortBy === k ? "#1e1e38" : "transparent",
              color: sortBy === k ? "#c8a951" : "#7a7898",
              border: sortBy === k ? "1px solid #2a2a4a" : "1px solid transparent",
            }}>
            {SORT_LABELS[k]}
          </button>
        ))}
      </div>

      {stats.length >= 3 && <Podium top3={stats.slice(0, 3)} sortBy={sortBy} />}

      <div className="space-y-2 mt-4">
        {stats.map((p, i) => (
          <Link key={p.name} href={`/players/${encodeURIComponent(p.name)}`}>
            <div className="card-arcane p-3 flex items-center gap-3 cursor-pointer hover:border-gold/50 transition-all">
              <span className="text-muted font-cinzel text-sm w-5 text-center">
                {i < 3 ? MEDALS[i] : `${i + 1}`}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-parchment font-semibold text-sm truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="wr-bar flex-1">
                    <div className="wr-bar-fill"
                      style={{ width: `${Math.min((sortBy === "winRate" ? p.winRate : p.wins / maxWins) * 100, 100)}%` }} />
                  </div>
                  <span className="text-gold text-xs font-bold whitespace-nowrap">
                    {sortBy === "winRate" ? fmt(p.winRate) : `${p.wins}W`}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-parchment text-sm font-bold">{sortBy === "winRate" ? `${p.wins}W` : fmt(p.winRate)}</div>
                <div className="text-muted text-[11px]">{p.games} games</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Podium({ top3, sortBy }: { top3: PlayerStats[]; sortBy: SortKey }) {
  return (
    <div className="relative h-44 mb-2 flex items-end justify-center gap-2">
      {[top3[1], top3[0], top3[2]].map((p, col) => {
        const heights = [28, 44, 20];
        const rank = col === 1 ? 0 : col === 0 ? 1 : 2;
        return (
          <Link key={p.name} href={`/players/${encodeURIComponent(p.name)}`} className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 mb-1"
              style={{ borderColor: rank === 0 ? "#c8a951" : rank === 1 ? "#9e9e9e" : "#8B6914" }}>
              <ScryfallArt deckName={p.favDeck} className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-cinzel text-parchment truncate max-w-[72px] text-center">{p.name}</span>
            <span className="text-gold text-xs font-bold">
              {sortBy === "winRate" ? fmt(p.winRate) : `${p.wins}W`}
            </span>
            <span className="text-[9px] text-muted">{p.wins}W · {p.games}G</span>
            <div className="w-16 mt-1 rounded-t-sm"
              style={{
                height: `${heights[col]}px`,
                background: rank === 0 ? "linear-gradient(180deg,#c8a951,#5a3e0a)" : "linear-gradient(180deg,#3a3a5c,#1e1e38)",
                border: "1px solid #1e1e38"
              }} />
          </Link>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-10">
      <div className="h-8 w-48 mx-auto rounded bg-surface2 animate-pulse mb-8" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-surface2 animate-pulse mb-2" />
      ))}
    </div>
  );
}
