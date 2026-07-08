"use client";
import { useEffect, useState, useMemo } from "react";
import { getElo, getH2hMatrix, getDeckDanger, getGames } from "@/lib/data";
import type { EloEntry, H2hMatrixEntry, DeckDangerEntry, GameEntry } from "@/lib/types";
import { fmt, stripOwnerSuffix } from "@/lib/stats";
import ScryfallArt from "@/components/ScryfallArt";
import Link from "next/link";

const COL_RD = "#C0392B";
const COL_MX = "#27AE60";
const leagueColor = (l?: string) => (l === "RD" ? COL_RD : l === "MX" ? COL_MX : "#7a7898");

/**
 * Pod Oracle — pick tonight's table and get:
 *  - predicted win chances (ELO-based Bradley-Terry)
 *  - the sharpest head-to-head edges at the table
 *  - each player's most dangerous decks to watch out for
 */
export default function OraclePage() {
  const [elo, setElo]       = useState<EloEntry[]>([]);
  const [matrix, setMatrix] = useState<H2hMatrixEntry[]>([]);
  const [danger, setDanger] = useState<DeckDangerEntry[]>([]);
  const [games, setGames]   = useState<GameEntry[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getElo(), getH2hMatrix(), getDeckDanger(), getGames()]).then(([e, m, d, g]) => {
      setElo(e); setMatrix(m); setDanger(d); setGames(g); setLoading(false);
    });
  }, []);

  const eloMap = useMemo(() => new Map(elo.map(e => [e.player, e])), [elo]);

  const toggle = (p: string) =>
    setPicked(prev => prev.includes(p)
      ? prev.filter(x => x !== p)
      : prev.length < 6 ? [...prev, p] : prev);

  // ELO -> win probability: strength 10^(elo/400), normalized over the table.
  const prediction = useMemo(() => {
    if (picked.length < 3) return [];
    const rows = picked.map(p => ({ player: p, elo: eloMap.get(p)?.elo ?? 1500 }));
    const total = rows.reduce((s, r) => s + 10 ** (r.elo / 400), 0);
    return rows
      .map(r => ({ ...r, prob: 10 ** (r.elo / 400) / total, league: eloMap.get(r.player)?.player_league }))
      .sort((a, b) => b.prob - a.prob);
  }, [picked, eloMap]);

  // strongest pairwise edges within the picked table
  const edges = useMemo(() => {
    if (picked.length < 3) return [];
    const set = new Set(picked);
    return matrix
      .filter(r => set.has(r.from) && set.has(r.to) && r.wr >= 0.55)
      .sort((a, b) => b.wr - a.wr)
      .slice(0, 6);
  }, [picked, matrix]);

  // most dangerous decks each picked player might bring
  const threats = useMemo(() => {
    if (picked.length < 3) return [];
    const set = new Set(picked);
    return danger
      .filter(d => set.has(d.player))
      .sort((a, b) => b.danger_score - a.danger_score)
      .slice(0, 6);
  }, [picked, danger]);

  // how often this exact table (or a superset) has met before
  const sharedGames = useMemo(() => {
    if (picked.length < 3) return 0;
    const byGame = new Map<number, Set<string>>();
    for (const g of games) {
      if (!byGame.has(g.gameNum)) byGame.set(g.gameNum, new Set());
      byGame.get(g.gameNum)!.add(g.player);
    }
    let n = 0;
    for (const players of byGame.values()) {
      if (picked.every(p => players.has(p))) n++;
    }
    return n;
  }, [picked, games]);

  if (loading) return <Skeleton />;

  const sortedPlayers = [...elo].sort((a, b) => a.player.localeCompare(b.player));

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
      <h1 className="font-cinzel text-2xl font-bold text-gold-gradient mb-1">Pod Oracle</h1>
      <p className="text-muted text-xs mb-4">
        Pick tonight&apos;s table (3–6 players). The Oracle reads the pod&apos;s history — ELO, head-to-head
        records and deck threat levels — and foretells the battle.
      </p>

      {/* Player picker */}
      <div className="card-arcane p-3 mb-4">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">
          Who sits at the table? <span className="text-muted normal-case tracking-normal">({picked.length}/6)</span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {sortedPlayers.map(e => {
            const on = picked.includes(e.player);
            return (
              <button key={e.player} onClick={() => toggle(e.player)}
                className="px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: on ? `${leagueColor(e.player_league)}33` : "#161628",
                  color: on ? "#e2e0d5" : "#7a7898",
                  border: `1px solid ${on ? leagueColor(e.player_league) : "#1e1e38"}`,
                }}>
                {e.player}
              </button>
            );
          })}
        </div>
      </div>

      {picked.length < 3 && (
        <div className="text-center py-10">
          <div className="text-4xl mb-3 opacity-40">🔮</div>
          <p className="text-muted text-sm">Choose at least 3 players to consult the Oracle.</p>
        </div>
      )}

      {prediction.length > 0 && (
        <div className="space-y-4">
          {/* Win probability */}
          <div className="card-arcane p-3">
            <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">The Prophecy</h3>
            <p className="text-[10px] text-muted mb-3">
              Win chance from ELO ratings: each player&apos;s rating becomes a strength score
              (10^(ELO/400)) and the table&apos;s scores are normalized to 100%. An even {picked.length}-player
              table would be {Math.round(100 / picked.length)}% each.
            </p>
            <div className="space-y-2.5">
              {prediction.map((r, i) => (
                <Link key={r.player} href={`/players/${encodeURIComponent(r.player)}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm w-6 text-center">{i === 0 ? "👑" : ""}</span>
                    <span className="text-sm text-parchment w-28 truncate flex-shrink-0">{r.player}</span>
                    <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: "#1e1e38" }}>
                      <div className="h-full rounded" style={{
                        width: `${r.prob * 100}%`,
                        background: `linear-gradient(90deg, ${leagueColor(r.league)}88, ${leagueColor(r.league)})`,
                      }} />
                    </div>
                    <span className="text-sm font-bold text-gold w-12 text-right">{Math.round(r.prob * 100)}%</span>
                  </div>
                </Link>
              ))}
            </div>
            {sharedGames > 0 && (
              <p className="text-[10px] text-muted mt-3">
                ⚔ These {picked.length} have shared a battlefield {sharedGames} time{sharedGames === 1 ? "" : "s"} before.
              </p>
            )}
          </div>

          {/* Head-to-head edges */}
          {edges.length > 0 && (
            <div className="card-arcane p-3">
              <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">Blood Feuds at This Table</h3>
              <p className="text-[10px] text-muted mb-3">
                Historical head-to-head edges between tonight&apos;s players (% = how often the first
                player finishes above the second when they share a game).
              </p>
              <div className="space-y-1">
                {edges.map(e => (
                  <div key={`${e.from}-${e.to}`} className="flex items-center gap-2 py-1 border-b border-border/20">
                    <span className="text-xs text-parchment flex-1 truncate">{e.from}</span>
                    <span className="text-xs font-bold text-gold">{fmt(e.wr)}</span>
                    <span className="text-[10px] text-muted">over</span>
                    <span className="text-xs text-parchment/70 flex-1 truncate text-right">{e.to}</span>
                    <span className="text-[10px] text-muted w-8 text-right">{e.games}G</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deck threats */}
          {threats.length > 0 && (
            <div className="card-arcane p-3">
              <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">Decks to Fear Tonight</h3>
              <p className="text-[10px] text-muted mb-3">
                The highest Danger-Score decks owned by tonight&apos;s players (wins weighted by the
                strength of the players they beat). If one hits the table, answer it early.
              </p>
              <div className="space-y-2">
                {threats.map((d, i) => (
                  <Link key={`${d.deck_name}-${i}`} href={`/decks/${encodeURIComponent(d.deck_name)}`}>
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-surface2">
                        <ScryfallArt deckName={d.deck_name} className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-parchment truncate">{stripOwnerSuffix(d.deck_name)}</div>
                        <div className="text-[10px] text-muted">{d.player} · {d.victorias} wins</div>
                      </div>
                      <span className="text-xs font-bold" style={{ color: leagueColor(d.player_league) }}>
                        {d.danger_score.toFixed(1)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <div className="h-7 w-40 rounded bg-surface2 animate-pulse" />
      <div className="h-32 rounded-lg bg-surface2 animate-pulse" />
      <div className="h-48 rounded-lg bg-surface2 animate-pulse" />
    </div>
  );
}
