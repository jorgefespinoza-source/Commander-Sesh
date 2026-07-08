"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { getGames, getDecks, getElo, getStreaks, getMonthlyWr } from "@/lib/data";
import { getPlayerStats, getDeckStats, fmt } from "@/lib/stats";
import type { GameEntry, DeckInfo, EloEntry, StreakEntry, MonthlyEntry } from "@/lib/types";
import ScryfallArt from "@/components/ScryfallArt";
import Link from "next/link";

const PLACEMENT_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };
const PLACEMENT_COLORS: Record<number, string> = {
  1: "#c8a951", 2: "#9e9e9e", 3: "#8B6914", 4: "#7a7898", 5: "#4a4a6a",
};

export default function PlayerProfilePage() {
  const { name } = useParams<{ name: string }>();
  const playerName = decodeURIComponent(name);

  const [games, setGames]       = useState<GameEntry[]>([]);
  const [decks, setDecks]       = useState<DeckInfo[]>([]);
  const [eloList, setEloList]   = useState<EloEntry[]>([]);
  const [streakList, setStreaks] = useState<StreakEntry[]>([]);
  const [monthlyWr, setMonthly] = useState<MonthlyEntry[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getGames(), getDecks(), getElo(), getStreaks(), getMonthlyWr()]).then(
      ([g, d, e, s, m]) => { setGames(g); setDecks(d); setEloList(e); setStreaks(s); setMonthly(m); setLoading(false); }
    );
  }, []);

  const p = useMemo(() => games.length ? getPlayerStats(playerName, games) : null, [games, playerName]);

  const topDeckStats = useMemo(() => {
    if (!p || !games.length) return null;
    return getDeckStats(p.favDeck, games, decks.find(d => d.name === p.favDeck));
  }, [p, games, decks]);

  const eloData    = useMemo(() => eloList.find(e => e.player === playerName), [eloList, playerName]);
  const streakData = useMemo(() => streakList.find(s => s.player === playerName), [streakList, playerName]);
  const monthlyData = useMemo(() =>
    monthlyWr
      .filter(m => m.player === playerName)
      .sort((a, b) => a.year_month!.localeCompare(b.year_month!))
  , [monthlyWr, playerName]);

  if (loading || !p) return <LoadingSkeleton />;

  const totalPlacementCount = Object.values(p.placementBreakdown).reduce((a, b) => a + b, 0);
  const league = eloData?.player_league ?? "";

  return (
    <div className="max-w-lg mx-auto">
      {/* Hero */}
      <div className="relative h-56">
        <ScryfallArt deckName={p.favDeck} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-cinzel text-3xl font-bold text-parchment mb-1">{p.name}</h1>
              <div className="flex items-center gap-2">
                {league && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-cinzel"
                    style={{ background: league === "RD" ? "#C0392B22" : "#27AE6022",
                             color: league === "RD" ? "#e74c3c" : "#2ecc71",
                             border: `1px solid ${league === "RD" ? "#C0392B66" : "#27AE6066"}` }}>
                    {league} League
                  </span>
                )}
                <span className="text-muted text-xs">{p.games} games since {games.find(g => g.player === p.name)?.date?.slice(0, 7) ?? ""}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 space-y-4 mt-2">
        {/* Core stats: win rate and wins are what matter */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Win Rate" value={fmt(p.winRate)} gold />
          <StatBox label="Total Wins" value={String(p.wins)} gold />
          <StatBox label="Games" value={String(p.games)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Avg Placement" value={p.avgPlacement.toFixed(2)} />
          {streakData ? (
            <StatBox
              label="Best streak"
              value={`${streakData.max_victorias}W / ${streakData.max_derrotas}L`}
            />
          ) : <StatBox label="—" value="" />}
          <StatBox label="Decks Used" value={String(p.decksPlayed.length)} />
        </div>

        {/* Monthly trend */}
        {monthlyData.length >= 2 && (
          <Section title="Monthly Win Rate">
            <div className="space-y-1.5">
              {monthlyData.slice(-8).map(m => (
                <div key={m.year_month} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted w-16 flex-shrink-0">{m.year_month}</span>
                  <div className="flex-1 wr-bar">
                    <div className="wr-bar-fill" style={{ width: `${Math.min(m.win_rate * 100, 100)}%` }} />
                  </div>
                  <span className="text-xs text-gold font-bold w-12 text-right">{fmt(m.win_rate)}</span>
                  <span className="text-[10px] text-muted w-8 text-right">{m.juegos}G</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Placement breakdown */}
        <Section title="Placement Breakdown">
          <div className="space-y-2">
            {Object.entries(p.placementBreakdown).sort(([a], [b]) => Number(a) - Number(b)).map(([place, count]) => (
              <div key={place} className="flex items-center gap-2">
                <span className="text-xs w-8 font-cinzel" style={{ color: PLACEMENT_COLORS[Number(place)] || "#7a7898" }}>
                  {PLACEMENT_LABELS[Number(place)] || `#${place}`}
                </span>
                <div className="flex-1 wr-bar">
                  <div className="wr-bar-fill" style={{
                    width: `${(count / totalPlacementCount) * 100}%`,
                    background: PLACEMENT_COLORS[Number(place)] || "#4a4a6a"
                  }} />
                </div>
                <span className="text-xs text-parchment/70 w-12 text-right">
                  {count}x ({Math.round((count / totalPlacementCount) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Decks played */}
        <Section title="Decks Played">
          <div className="space-y-2">
            {p.decksPlayed.slice(0, 10).map(d => (
              <Link key={d.deck} href={`/decks/${encodeURIComponent(d.deck)}`}>
                <div className="flex items-center gap-3 py-1.5 border-b border-border/30 hover:border-gold/20 transition-colors">
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                    <ScryfallArt deckName={d.deck} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs text-parchment/70 flex-1 truncate">{d.deck}</span>
                  <span className="text-xs text-gold font-bold">{fmt(d.wins / d.games)}</span>
                  <span className="text-xs text-muted">{d.games}G</span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function StatBox({ label, value, gold, accent }: { label: string; value: string; gold?: boolean; accent?: string }) {
  const color = accent ?? (gold ? "#c8a951" : undefined);
  return (
    <div className="card-arcane p-3 text-center">
      <div className="text-lg font-bold font-cinzel leading-tight"
        style={{ color: color ?? "var(--parchment)" }}>{value}</div>
      <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-arcane p-3">
      <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <div className="h-56 rounded-lg bg-surface2 animate-pulse" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-surface2 animate-pulse" />)}
      </div>
      <div className="h-48 rounded-lg bg-surface2 animate-pulse" />
    </div>
  );
}
