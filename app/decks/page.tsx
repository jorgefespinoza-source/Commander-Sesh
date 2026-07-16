"use client";
import { useEffect, useState, useMemo } from "react";
import { getGames, getDecks, getElo } from "@/lib/data";
import { getAllDeckStats, filterBySeason, getSeasons, fmt } from "@/lib/stats";
import type { GameEntry, DeckInfo, DeckStats } from "@/lib/types";
import ManaSymbols from "@/components/ManaSymbols";
import ScryfallArt from "@/components/ScryfallArt";
import SeasonFilter from "@/components/SeasonFilter";
import LeagueFilter, { type League } from "@/components/LeagueFilter";
import Link from "next/link";

export default function DecksPage() {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState<League>("ALL");
  const [leagueOf, setLeagueOf] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getGames(), getDecks(), getElo()]).then(([g, d, e]) => {
      setGames(g); setDecks(d);
      setLeagueOf(new Map(e.map(x => [x.player, x.player_league])));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => filterBySeason(games, season), [games, season]);
  const seasons = useMemo(() => getSeasons(games), [games]);
  const deckStats = useMemo(() => getAllDeckStats(filtered, decks), [filtered, decks]);

  const shown = useMemo(() => {
    let list = deckStats;
    if (league !== "ALL") list = list.filter(d => leagueOf.get(d.owner) === league);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(d =>
      d.name.toLowerCase().includes(q) || d.owner.toLowerCase().includes(q) ||
      (d.cardName ?? "").toLowerCase().includes(q)
    );
  }, [deckStats, search, league, leagueOf]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="font-cinzel text-2xl font-bold text-gold-gradient mb-4">Decks</h1>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="search"
          placeholder="Search decks or players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-parchment placeholder-muted outline-none focus:border-gold/50"
        />
      </div>

      <div className="flex items-center justify-between mb-5">
        <LeagueFilter value={league} onChange={setLeague} />
        <SeasonFilter seasons={seasons} selected={season} onChange={setSeason} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {shown.map(d => <DeckCard key={d.name} deck={d} />)}
      </div>
    </div>
  );
}

function DeckCard({ deck }: { deck: DeckStats }) {
  return (
    <Link href={`/decks/${encodeURIComponent(deck.name)}`}>
      <div className="card-arcane overflow-hidden cursor-pointer group">
        <div className="relative h-32">
          <ScryfallArt deckName={deck.name} className="absolute inset-0 w-full h-full" />
          <div className="commander-art-overlay absolute inset-0" />
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <div className="text-xs font-cinzel text-parchment truncate leading-tight">{deck.name}</div>
            {deck.cardName && deck.cardName !== deck.name && (
              <div className="text-[9px] text-gold/60 truncate italic">{deck.cardName}</div>
            )}
            <div className="text-[10px] text-muted">{deck.owner}</div>
          </div>
        </div>
        <div className="p-2 flex items-center justify-between">
          <ManaSymbols identity={deck.colorIdentity} size="sm" />
          <div className="text-right">
            <span className="text-gold text-xs font-bold">{fmt(deck.winRate)}</span>
            <span className="text-muted text-[10px] ml-1">{deck.games}G</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <div className="h-7 w-24 rounded bg-surface2 animate-pulse mb-6" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-44 rounded-lg bg-surface2 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
