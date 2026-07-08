"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { getGames, getDecks } from "@/lib/data";
import { getDeckStats, fmt } from "@/lib/stats";
import type { GameEntry, DeckInfo, DeckStats } from "@/lib/types";
import ManaSymbols from "@/components/ManaSymbols";
import ScryfallArt from "@/components/ScryfallArt";
import Link from "next/link";

const PLACEMENT_COLORS = ["", "#c8a951", "#9e9e9e", "#8B6914", "#7a7898", "#4a4a6a"];

export default function DeckDetailPage() {
  const { name } = useParams<{ name: string }>();
  const deckName = decodeURIComponent(name);

  const [games, setGames] = useState<GameEntry[]>([]);
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getGames(), getDecks()]).then(([g, d]) => {
      setGames(g); setDecks(d); setLoading(false);
    });
  }, []);

  const deck = useMemo(() => {
    if (!games.length) return null;
    const info = decks.find(d => d.name === deckName);
    return getDeckStats(deckName, games, info);
  }, [games, decks, deckName]);

  if (loading || !deck) return <LoadingSkeleton />;

  return (
    <div className="max-w-lg mx-auto">
      {/* Hero art */}
      <div className="relative h-64 w-full">
        <ScryfallArt deckName={deck.name} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-cinzel text-2xl font-bold text-parchment leading-tight">{deck.name}</h1>
              {deck.cardName && deck.cardName !== deck.name && (
                <div className="text-xs text-gold/70 italic mt-0.5">{deck.cardName}</div>
              )}
              <Link href={`/players/${encodeURIComponent(deck.owner)}`}
                className="text-gold text-sm hover:text-gold-bright transition-colors">
                {deck.owner}
              </Link>
            </div>
            <ManaSymbols identity={deck.colorIdentity} size="lg" />
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <StatBox label="Win Rate" value={fmt(deck.winRate)} gold />
          <StatBox label="Games" value={String(deck.games)} />
          <StatBox label="Avg Place" value={`#${deck.avgPlacement.toFixed(1)}`} />
        </div>

        {/* Placement breakdown */}
        <Section title="Placement Breakdown">
          <div className="space-y-2">
            {deck.history.reduce((acc, h) => {
              acc[h.placement] = (acc[h.placement] || 0) + 1;
              return acc;
            }, {} as Record<number, number>) &&
              Object.entries(
                deck.history.reduce((acc, h) => {
                  acc[h.placement] = (acc[h.placement] || 0) + 1;
                  return acc;
                }, {} as Record<number, number>)
              ).sort(([a], [b]) => Number(a) - Number(b)).map(([place, count]) => (
                <div key={place} className="flex items-center gap-2">
                  <span className="text-xs w-12 text-muted">#{place}</span>
                  <div className="flex-1 wr-bar">
                    <div className="wr-bar-fill" style={{
                      width: `${(count / deck.games) * 100}%`,
                      background: PLACEMENT_COLORS[Number(place)] || "#4a4a6a"
                    }} />
                  </div>
                  <span className="text-xs text-parchment/70 w-8 text-right">{count}x</span>
                </div>
              ))
            }
          </div>
        </Section>

        {/* Players who piloted */}
        {deck.players.length > 1 && (
          <Section title="Pilots">
            <div className="flex flex-wrap gap-2">
              {deck.players.map(p => (
                <Link key={p} href={`/players/${encodeURIComponent(p)}`}>
                  <span className="px-2 py-1 rounded-full text-xs text-parchment/70 hover:text-gold transition-colors"
                    style={{ background: "#161628", border: "1px solid #1e1e38" }}>
                    {p}
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* History timeline */}
        <Section title="Game History">
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {[...deck.history].reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/30">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: h.placement === 1 ? "#c8a951" : "#3a3a5c" }} />
                <span className="text-xs text-muted w-20 flex-shrink-0">{h.date}</span>
                <span className="text-xs text-parchment/70 flex-1 truncate">{h.player}</span>
                <span className="text-xs font-bold flex-shrink-0"
                  style={{ color: h.placement === 1 ? "#c8a951" : "#7a7898" }}>
                  #{h.placement}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function StatBox({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="card-arcane p-3 text-center">
      <div className={`text-lg font-bold font-cinzel ${gold ? "text-gold" : "text-parchment"}`}>{value}</div>
      <div className="text-[10px] text-muted uppercase tracking-wide">{label}</div>
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
      <div className="h-64 rounded-lg bg-surface2 animate-pulse" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-surface2 animate-pulse" />)}
      </div>
    </div>
  );
}
