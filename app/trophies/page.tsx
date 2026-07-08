"use client";
import { useEffect, useState, useMemo } from "react";
import { getGames, getElo, getStreaks, getKingmaker, getMvp } from "@/lib/data";
import type { GameEntry, EloEntry, StreakEntry, KingmakerEntry, MvpEntry } from "@/lib/types";
import { fmt } from "@/lib/stats";
import Link from "next/link";

const COL_RD = "#C0392B";
const COL_MX = "#27AE60";

interface Trophy {
  icon: string;
  title: string;
  holder: string;
  value: string;
  desc: string;
}

/**
 * Trophy Room — auto-computed pod honors. Every trophy is derived live from the
 * game log, so titles change hands the moment someone earns them.
 */
export default function TrophiesPage() {
  const [games, setGames]     = useState<GameEntry[]>([]);
  const [elo, setElo]         = useState<EloEntry[]>([]);
  const [streaks, setStreaks] = useState<StreakEntry[]>([]);
  const [king, setKing]       = useState<KingmakerEntry[]>([]);
  const [mvp, setMvp]         = useState<MvpEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getGames(), getElo(), getStreaks(), getKingmaker(), getMvp()]).then(
      ([g, e, s, k, m]) => { setGames(g); setElo(e); setStreaks(s); setKing(k); setMvp(m); setLoading(false); });
  }, []);

  const rostered = useMemo(() => new Set(elo.map(e => e.player)), [elo]);

  const trophies = useMemo<Trophy[]>(() => {
    if (!games.length || !elo.length) return [];
    const t: Trophy[] = [];

    // per-player aggregates from the raw log
    const byPlayer = new Map<string, GameEntry[]>();
    for (const g of games) {
      if (!g.player || !rostered.has(g.player)) continue;
      if (!byPlayer.has(g.player)) byPlayer.set(g.player, []);
      byPlayer.get(g.player)!.push(g);
    }
    const agg = [...byPlayer.entries()].map(([player, gs]) => ({
      player, games: gs.length,
      wins: gs.filter(g => g.placement === 1).length,
      decks: new Set(gs.map(g => g.deck).filter(Boolean)),
      gs,
    }));

    // 🏆 The Emperor — best all-time win rate (min 20 games)
    const emperor = agg.filter(a => a.games >= 20)
      .sort((a, b) => b.wins / b.games - a.wins / a.games)[0];
    if (emperor) t.push({
      icon: "🏆", title: "The Emperor", holder: emperor.player,
      value: fmt(emperor.wins / emperor.games),
      desc: "Highest all-time win rate (min. 20 games). The throne is never safe.",
    });

    // ⚔️ Warlord — most total wins
    const warlord = [...agg].sort((a, b) => b.wins - a.wins)[0];
    if (warlord) t.push({
      icon: "⚔️", title: "The Warlord", holder: warlord.player,
      value: `${warlord.wins} wins`,
      desc: "Most total victories, all-time. Pure body count.",
    });

    // 🔥 Hot Hand — longest win streak
    const hot = [...streaks].sort((a, b) => b.max_victorias - a.max_victorias)[0];
    if (hot) t.push({
      icon: "🔥", title: "The Hot Hand", holder: hot.player,
      value: `${hot.max_victorias} in a row`,
      desc: "Longest unbroken run of 1st places in pod history.",
    });

    // 🗿 The Unbroken — survived the longest losing streak
    const iron = [...streaks].sort((a, b) => b.max_derrotas - a.max_derrotas)[0];
    if (iron) t.push({
      icon: "🗿", title: "The Unbroken", holder: iron.player,
      value: `${iron.max_derrotas} straight losses`,
      desc: "Endured the longest losing streak and kept showing up. Honor them.",
    });

    // 👑 Kingmaker — highest 2nd-place rate
    const km = [...king].sort((a, b) => b.seg_rate - a.seg_rate)[0];
    if (km) t.push({
      icon: "👑", title: "The Kingmaker", holder: km.player,
      value: `2nd in ${fmt(km.seg_rate)} of games`,
      desc: "Finishes 2nd more than anyone — decides who wins without winning.",
    });

    // 🐉 Giant Slayer — most wins in games where the ELO #1 was at the table
    const top = [...elo].sort((a, b) => b.elo - a.elo)[0];
    if (top) {
      const byGame = new Map<number, GameEntry[]>();
      for (const g of games) {
        if (!byGame.has(g.gameNum)) byGame.set(g.gameNum, []);
        byGame.get(g.gameNum)!.push(g);
      }
      const slayCount = new Map<string, number>();
      for (const members of byGame.values()) {
        if (!members.some(m => m.player === top.player)) continue;
        const winner = members.find(m => m.placement === 1);
        if (winner && winner.player !== top.player && rostered.has(winner.player)) {
          slayCount.set(winner.player, (slayCount.get(winner.player) ?? 0) + 1);
        }
      }
      const slayer = [...slayCount.entries()].sort((a, b) => b[1] - a[1])[0];
      if (slayer) t.push({
        icon: "🐉", title: "The Giant Slayer", holder: slayer[0],
        value: `${slayer[1]} wins over ${top.player}`,
        desc: `Most wins at tables where ${top.player} — the highest-rated player — was sitting.`,
      });
    }

    // 🧭 The Explorer — most distinct decks played
    const explorer = [...agg].sort((a, b) => b.decks.size - a.decks.size)[0];
    if (explorer) t.push({
      icon: "🧭", title: "The Explorer", holder: explorer.player,
      value: `${explorer.decks.size} different decks`,
      desc: "Has piloted more commanders than anyone. Never the same threat twice.",
    });

    // 💍 The Loyalist — most games on one deck
    let loyal: { player: string; deck: string; n: number } | null = null;
    for (const a of agg) {
      const counts = new Map<string, number>();
      for (const g of a.gs) if (g.deck) counts.set(g.deck, (counts.get(g.deck) ?? 0) + 1);
      for (const [deck, n] of counts) {
        if (!loyal || n > loyal.n) loyal = { player: a.player, deck, n };
      }
    }
    if (loyal) t.push({
      icon: "💍", title: "The Loyalist", holder: loyal.player,
      value: `${loyal.n} games with ${loyal.deck}`,
      desc: "Most games piloting a single deck. One love, one commander.",
    });

    // 🐺 Big Game Hunter — best win rate in 5+ player pods (min 10 such games)
    const bigAgg = agg.map(a => {
      const big = a.gs.filter(g => g.podSize >= 5);
      return { player: a.player, n: big.length, w: big.filter(g => g.placement === 1).length };
    }).filter(a => a.n >= 10).sort((a, b) => b.w / b.n - a.w / a.n)[0];
    if (bigAgg) t.push({
      icon: "🐺", title: "The Big Game Hunter", holder: bigAgg.player,
      value: `${fmt(bigAgg.w / bigAgg.n)} in 5+ pods`,
      desc: "Best win rate in chaotic tables of five or more (min. 10 such games).",
    });

    // 🌙 MVP Royalty — most monthly MVP titles
    const mvpCount = new Map<string, number>();
    for (const m of mvp) mvpCount.set(m.player, (mvpCount.get(m.player) ?? 0) + 1);
    const royalty = [...mvpCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (royalty) t.push({
      icon: "🌙", title: "MVP Royalty", holder: royalty[0],
      value: `${royalty[1]} monthly MVP titles`,
      desc: "Crowned best player of the month more times than anyone.",
    });

    return t;
  }, [games, elo, streaks, king, mvp, rostered]);

  const records = useMemo(() => {
    if (!games.length) return [];
    const byGame = new Map<number, GameEntry[]>();
    const byDate = new Map<string, Set<number>>();
    for (const g of games) {
      if (!byGame.has(g.gameNum)) byGame.set(g.gameNum, []);
      byGame.get(g.gameNum)!.push(g);
      if (g.date) {
        if (!byDate.has(g.date)) byDate.set(g.date, new Set());
        byDate.get(g.date)!.add(g.gameNum);
      }
    }
    const biggestPod = Math.max(...[...byGame.values()].map(m => m.length));
    const busiest = [...byDate.entries()].sort((a, b) => b[1].size - a[1].size)[0];
    const dates = [...byDate.keys()].sort();
    return [
      { label: "Games played, all-time", value: String(byGame.size) },
      { label: "First recorded game", value: dates[0] ?? "—" },
      { label: "Biggest pod ever", value: `${biggestPod} players` },
      { label: "Busiest game night", value: busiest ? `${busiest[0]} · ${busiest[1].size} games` : "—" },
      { label: "Different commanders seen", value: String(new Set(games.map(g => g.deck).filter(Boolean)).size) },
    ];
  }, [games]);

  if (loading) return <Skeleton />;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
      <h1 className="font-cinzel text-2xl font-bold text-gold-gradient mb-1">Trophy Room</h1>
      <p className="text-muted text-xs mb-5">
        Living honors, computed from every game ever logged. Titles change hands automatically —
        win the stat, take the trophy.
      </p>

      <div className="space-y-3">
        {trophies.map(t => (
          <Link key={t.title} href={`/players/${encodeURIComponent(t.holder)}`}>
            <div className="card-arcane p-3 flex items-start gap-3 hover:border-gold/50 transition-all">
              <div className="text-3xl leading-none pt-0.5">{t.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-cinzel text-sm text-gold font-bold">{t.title}</span>
                  <span className="text-xs text-gold/80 font-bold whitespace-nowrap">{t.value}</span>
                </div>
                <div className="text-parchment text-sm font-semibold mt-0.5">{t.holder}</div>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pod records */}
      <div className="card-arcane p-3 mt-5">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">Pod Records</h3>
        <div className="space-y-2">
          {records.map(r => (
            <div key={r.label} className="flex items-center justify-between py-1 border-b border-border/20">
              <span className="text-xs text-muted">{r.label}</span>
              <span className="text-xs text-parchment font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4 text-[10px] justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: COL_RD }} />
          <span className="text-muted">RD League</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: COL_MX }} />
          <span className="text-muted">MX League</span>
        </span>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
      <div className="h-7 w-40 rounded bg-surface2 animate-pulse" />
      {[0,1,2,3,4].map(i => <div key={i} className="h-20 rounded-lg bg-surface2 animate-pulse" />)}
    </div>
  );
}
