"use client";
import { useEffect, useState, useMemo } from "react";
import { getGames, getElo, getDecks } from "@/lib/data";
import { getAllPlayerStats, getAllDeckStats, getSeasons, filterBySeason, fmt, stripOwnerSuffix } from "@/lib/stats";
import type { GameEntry, PlayerStats, DeckInfo, DeckStats } from "@/lib/types";
import SeasonFilter from "@/components/SeasonFilter";
import LeagueFilter, { type League, leagueColor } from "@/components/LeagueFilter";
import Link from "next/link";
import ScryfallArt from "@/components/ScryfallArt";
import ArcaneBackdrop from "@/components/ArcaneBackdrop";
import ManaSymbols from "@/components/ManaSymbols";

const MEDALS = ["🥇", "🥈", "🥉"];
const MIN_DECK_GAMES = 5; // decks need this many games to rank by win %

type SortKey = "winRate" | "wins";
const SORT_LABELS: Record<SortKey, string> = { winRate: "Win %", wins: "Wins" };
type View = "players" | "decks";

export default function LeaderboardPage() {
  const [games, setGames]   = useState<GameEntry[]>([]);
  const [decks, setDecks]   = useState<DeckInfo[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("winRate");
  const [view, setView]     = useState<View>("players");
  const [league, setLeague] = useState<League>("ALL");
  const [loading, setLoading] = useState(true);
  const [leagueOf, setLeagueOf] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    Promise.all([getGames(), getElo(), getDecks()]).then(([g, e, d]) => {
      setGames(g);
      setDecks(d);
      setLeagueOf(new Map(e.map(x => [x.player, x.player_league])));
      setLoading(false);
    });
  }, []);

  const seasons  = useMemo(() => getSeasons(games), [games]);
  const filtered = useMemo(() => filterBySeason(games, season), [games, season]);

  const inLeague = (player: string) =>
    league === "ALL" ? leagueOf.has(player) : leagueOf.get(player) === league;

  const playerStats = useMemo(() =>
    getAllPlayerStats(filtered)
      .filter(p => leagueOf.size === 0 || inLeague(p.name))
      .sort((a, b) => b[sortBy] - a[sortBy] || b.winRate - a.winRate || b.wins - a.wins),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, sortBy, leagueOf, league]);

  const deckStats = useMemo(() =>
    getAllDeckStats(filtered, decks)
      .filter(d => d.games >= (sortBy === "winRate" ? MIN_DECK_GAMES : 2))
      .filter(d => league === "ALL" || leagueOf.get(d.owner) === league)
      .sort((a, b) => b[sortBy] - a[sortBy] || b.winRate - a.winRate || b.wins - a.wins),
    [filtered, decks, sortBy, league, leagueOf]);

  const totalGames = useMemo(() => {
    return new Set(filtered.map(g => `${g.date}-${g.gameNum}`)).size;
  }, [filtered]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      {playerStats[0] && <ArcaneBackdrop deckName={playerStats[0].favDeck} />}
      <div className="text-center mb-5">
        <h1 className="font-cinzel text-3xl font-bold text-gold-gradient mb-1">Commander Sesh</h1>
        <p className="text-muted text-sm">{totalGames} games played · only 1st place counts</p>
      </div>

      {/* View toggle: Players | Decks */}
      <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: "#0f0f1c" }}>
        {(["players", "decks"] as View[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className="flex-1 py-2 rounded-md text-sm font-cinzel font-bold transition-all"
            style={{
              background: view === v ? "#1e1e38" : "transparent",
              color: view === v ? "#c8a951" : "#7a7898",
              border: view === v ? "1px solid #2a2a4a" : "1px solid transparent",
            }}>
            {v === "players" ? "⚔ Players" : "🃏 Commanders"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <LeagueFilter value={league} onChange={setLeague} />
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

      {view === "players" ? (
        <>
          {playerStats.length >= 3 && <Podium top3={playerStats.slice(0, 3)} sortBy={sortBy} />}
          <PlayerList stats={playerStats} sortBy={sortBy} leagueOf={leagueOf} />
        </>
      ) : (
        <>
          {sortBy === "winRate" && (
            <p className="text-[10px] text-muted text-center mb-3">
              Ranked by win rate · minimum {MIN_DECK_GAMES} games played
            </p>
          )}
          <DeckList stats={deckStats} sortBy={sortBy} leagueOf={leagueOf} />
        </>
      )}
    </div>
  );
}

function PlayerList({ stats, sortBy, leagueOf }: {
  stats: PlayerStats[]; sortBy: SortKey; leagueOf: Map<string, string>;
}) {
  const maxWins = Math.max(...stats.map(s => s.wins), 1);
  return (
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
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: leagueColor(leagueOf.get(p.name)) }} />
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
  );
}

function DeckList({ stats, sortBy, leagueOf }: {
  stats: DeckStats[]; sortBy: SortKey; leagueOf: Map<string, string>;
}) {
  const maxWins = Math.max(...stats.map(s => s.wins), 1);
  return (
    <div className="space-y-2 mt-1">
      {stats.map((d, i) => (
        <Link key={d.name} href={`/decks/${encodeURIComponent(d.name)}`}>
          <div className="card-arcane p-2.5 flex items-center gap-3 cursor-pointer hover:border-gold/50 transition-all">
            <span className="text-muted font-cinzel text-sm w-5 text-center flex-shrink-0">
              {i < 3 ? MEDALS[i] : `${i + 1}`}
            </span>
            <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 border border-border">
              <ScryfallArt deckName={d.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-parchment font-semibold text-sm truncate leading-tight">
                {stripOwnerSuffix(d.name)}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ManaSymbols identity={d.colorIdentity} size="sm" />
                <span className="text-[10px] truncate" style={{ color: leagueColor(leagueOf.get(d.owner)) }}>
                  {d.owner}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="wr-bar flex-1">
                  <div className="wr-bar-fill"
                    style={{ width: `${Math.min((sortBy === "winRate" ? d.winRate : d.wins / maxWins) * 100, 100)}%` }} />
                </div>
                <span className="text-gold text-xs font-bold whitespace-nowrap">
                  {sortBy === "winRate" ? fmt(d.winRate) : `${d.wins}W`}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-parchment text-sm font-bold">{sortBy === "winRate" ? `${d.wins}W` : fmt(d.winRate)}</div>
              <div className="text-muted text-[11px]">{d.games} games</div>
            </div>
          </div>
        </Link>
      ))}
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
