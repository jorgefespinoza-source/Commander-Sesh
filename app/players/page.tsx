"use client";
import { useEffect, useState, useMemo } from "react";
import { getGames, getElo } from "@/lib/data";
import { getAllPlayerStats, filterBySeason, getSeasons, fmt } from "@/lib/stats";
import type { GameEntry } from "@/lib/types";
import ScryfallArt from "@/components/ScryfallArt";
import SeasonFilter from "@/components/SeasonFilter";
import Link from "next/link";

export default function PlayersPage() {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [roster, setRoster] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([getGames(), getElo()]).then(([g, e]) => {
      setGames(g);
      setRoster(new Set(e.map(x => x.player)));
      setLoading(false);
    });
  }, []);

  const seasons = useMemo(() => getSeasons(games), [games]);
  const filtered = useMemo(() => filterBySeason(games, season), [games, season]);
  const stats = useMemo(() => getAllPlayerStats(filtered).filter(p => roster.size === 0 || roster.has(p.name)), [filtered, roster]);

  if (loading) return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg bg-surface2 animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="font-cinzel text-2xl font-bold text-gold-gradient mb-4">Players</h1>

      <div className="flex items-center justify-between mb-5">
        <span className="text-xs text-muted font-semibold uppercase tracking-widest">Season</span>
        <SeasonFilter seasons={seasons} selected={season} onChange={setSeason} />
      </div>

      <div className="space-y-2">
        {stats.map((p, i) => (
          <Link key={p.name} href={`/players/${encodeURIComponent(p.name)}`}>
            <div className="card-arcane p-3 flex items-center gap-3 cursor-pointer">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-border">
                <ScryfallArt deckName={p.favDeck} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-parchment font-semibold text-sm truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="wr-bar flex-1">
                    <div className="wr-bar-fill" style={{ width: `${Math.min(p.winRate * 100, 100)}%` }} />
                  </div>
                  <span className="text-gold text-xs font-bold">{fmt(p.winRate)}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-parchment/60">{p.wins}W</div>
                <div className="text-xs text-muted">{p.games}G</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
