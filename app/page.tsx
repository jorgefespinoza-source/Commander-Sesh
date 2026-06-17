"use client";
import { useEffect, useState, useMemo } from "react";
import { getGames, getDecks } from "@/lib/data";
import { getAllPlayerStats, getSeasons, filterBySeason, fmt } from "@/lib/stats";
import type { GameEntry, PlayerStats } from "@/lib/types";
import ManaSymbols from "@/components/ManaSymbols";
import SeasonFilter from "@/components/SeasonFilter";
import Link from "next/link";
import ScryfallArt from "@/components/ScryfallArt";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGames().then(g => { setGames(g); setLoading(false); });
  }, []);

  const seasons = useMemo(() => getSeasons(games), [games]);
  const filtered = useMemo(() => filterBySeason(games, season), [games, season]);
  const stats = useMemo(() => getAllPlayerStats(filtered), [filtered]);

  const totalGames = useMemo(() => {
    const ids = new Set(filtered.map(g => `${g.date}-${g.gameNum}`));
    return ids.size;
  }, [filtered]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-cinzel text-3xl font-bold text-gold-gradient mb-1">
          Commander Sesh
        </h1>
        <p className="text-muted text-sm">{totalGames} games logged</p>
      </div>

      {/* Season filter */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs text-muted font-semibold uppercase tracking-widest">Season</span>
        <SeasonFilter seasons={seasons} selected={season} onChange={setSeason} />
      </div>

      {/* Top 3 podium */}
      {stats.length >= 3 && <Podium top3={stats.slice(0, 3)} />}

      {/* Full leaderboard */}
      <div className="space-y-2 mt-4">
        {stats.map((p, i) => (
          <Link key={p.name} href={`/players/${encodeURIComponent(p.name)}`}>
            <div className="card-arcane p-3 flex items-center gap-3 cursor-pointer hover:border-gold/50 transition-all">
              <span className="text-muted font-cinzel text-sm w-5 text-center">
                {i < 3 ? MEDALS[i] : `${i + 1}`}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-parchment font-semibold text-sm truncate">{p.name}</span>
                  <ManaSymbols identity={p.favColorIdentity} size="sm" />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <WinBar rate={p.winRate} />
                  <span className="text-gold text-xs font-bold whitespace-nowrap">{fmt(p.winRate)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-parchment/60 text-xs">{p.wins}W / {p.games}G</div>
                <div className="text-muted text-xs">avg #{p.avgPlacement.toFixed(1)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function WinBar({ rate }: { rate: number }) {
  return (
    <div className="wr-bar flex-1">
      <div className="wr-bar-fill" style={{ width: `${Math.min(rate * 100, 100)}%` }} />
    </div>
  );
}

function Podium({ top3 }: { top3: PlayerStats[] }) {
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
            <span className="text-gold text-xs font-bold">{fmt(p.winRate)}</span>
            <div className="w-16 mt-1 rounded-t-sm"
              style={{
                height: `${heights[col]}px`,
                background: rank === 0
                  ? "linear-gradient(180deg,#c8a951,#5a3e0a)"
                  : "linear-gradient(180deg,#3a3a5c,#1e1e38)",
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
