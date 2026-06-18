"use client";
import { useEffect, useState, useMemo } from "react";
import { getGames, getElo } from "@/lib/data";
import { getAllPlayerStats, getSeasons, filterBySeason, fmt, fmtScore } from "@/lib/stats";
import type { GameEntry, PlayerStats, EloEntry } from "@/lib/types";
import ManaSymbols from "@/components/ManaSymbols";
import SeasonFilter from "@/components/SeasonFilter";
import Link from "next/link";
import ScryfallArt from "@/components/ScryfallArt";

const MEDALS = ["🥇", "🥈", "🥉"];

type SortKey = "cmdScore" | "winRate" | "wins";
const SORT_LABELS: Record<SortKey, string> = { cmdScore: "Score", winRate: "Win %", wins: "Wins" };

export default function LeaderboardPage() {
  const [games, setGames]   = useState<GameEntry[]>([]);
  const [elo, setElo]       = useState<EloEntry[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("cmdScore");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getGames(), getElo()]).then(([g, e]) => {
      setGames(g); setElo(e); setLoading(false);
    });
  }, []);

  const eloMap   = useMemo(() => new Map(elo.map(e => [e.player, e])), [elo]);
  const seasons  = useMemo(() => getSeasons(games), [games]);
  const filtered = useMemo(() => filterBySeason(games, season), [games, season]);
  const stats    = useMemo(() =>
    [...getAllPlayerStats(filtered)].sort((a, b) => b[sortBy] - a[sortBy] || b.wins - a.wins),
    [filtered, sortBy]);

  const totalGames = useMemo(() => {
    return new Set(filtered.map(g => `${g.date}-${g.gameNum}`)).size;
  }, [filtered]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <div className="text-center mb-5">
        <h1 className="font-cinzel text-3xl font-bold text-gold-gradient mb-1">Commander Sesh</h1>
        <p className="text-muted text-sm">{totalGames} games · scoring: 1st=3pts · 2nd=1pt · 3rd+=0</p>
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

      {stats.length >= 3 && <Podium top3={stats.slice(0, 3)} eloMap={eloMap} sortBy={sortBy} />}

      <div className="space-y-2 mt-4">
        {stats.map((p, i) => {
          const eloData = eloMap.get(p.name);
          return (
            <Link key={p.name} href={`/players/${encodeURIComponent(p.name)}`}>
              <div className="card-arcane p-3 flex items-center gap-3 cursor-pointer hover:border-gold/50 transition-all">
                <span className="text-muted font-cinzel text-sm w-5 text-center">
                  {i < 3 ? MEDALS[i] : `${i + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-parchment font-semibold text-sm truncate">{p.name}</span>
                    <ManaSymbols identity={p.top3Colors} size="sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="wr-bar flex-1">
                      <div className="wr-bar-fill"
                        style={{ width: `${Math.min((p[sortBy] / (sortBy === "cmdScore" ? 3 : sortBy === "winRate" ? 1 : Math.max(...stats.map(s=>s.wins)))) * 100, 100)}%` }} />
                    </div>
                    <span className="text-gold text-xs font-bold whitespace-nowrap">
                      {sortBy === "cmdScore" ? fmtScore(p.cmdScore) : sortBy === "winRate" ? fmt(p.winRate) : `${p.wins}W`}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-parchment/60 text-xs">{p.wins}W / {p.games}G</div>
                  {eloData && <div className="text-[10px]" style={{ color: "#8E44AD" }}>Elo {Math.round(eloData.elo)}</div>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Podium({ top3, eloMap, sortBy }: { top3: PlayerStats[]; eloMap: Map<string, EloEntry>; sortBy: SortKey }) {
  return (
    <div className="relative h-44 mb-2 flex items-end justify-center gap-2">
      {[top3[1], top3[0], top3[2]].map((p, col) => {
        const heights = [28, 44, 20];
        const rank = col === 1 ? 0 : col === 0 ? 1 : 2;
        const eloData = eloMap.get(p.name);
        return (
          <Link key={p.name} href={`/players/${encodeURIComponent(p.name)}`} className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 mb-1"
              style={{ borderColor: rank === 0 ? "#c8a951" : rank === 1 ? "#9e9e9e" : "#8B6914" }}>
              <ScryfallArt deckName={p.favDeck} className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-cinzel text-parchment truncate max-w-[72px] text-center">{p.name}</span>
            <span className="text-gold text-xs font-bold">
              {sortBy === "cmdScore" ? fmtScore(p.cmdScore) : sortBy === "winRate" ? fmt(p.winRate) : `${p.wins}W`}
            </span>
            {eloData && <span className="text-[9px]" style={{ color: "#8E44AD" }}>Elo {Math.round(eloData.elo)}</span>}
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
