"use client";
import { useEffect, useState, useMemo } from "react";
import {
  getElo, getTendencia, getDeckDanger, getH2hMatrix,
  getMonthlyRD, getMonthlyMX, getMonthlyWr, getMvp, getStreaks, getKingmaker
} from "@/lib/data";
import type {
  EloEntry, TendenciaEntry, DeckDangerEntry, H2hMatrixEntry,
  MonthlyEntry, MvpEntry, StreakEntry, KingmakerEntry
} from "@/lib/types";
import { fmt, stripOwnerSuffix } from "@/lib/stats";
import Link from "next/link";
import ScryfallArt from "@/components/ScryfallArt";
import LeagueFilter, { type League } from "@/components/LeagueFilter";

const COL_RD = "#C0392B";   // RD league = red
const COL_MX = "#27AE60";   // MX league = green
const leagueColor = (l: string) => (l === "RD" ? COL_RD : COL_MX);

type Tab = "monthly" | "elo" | "trends" | "h2h" | "danger" | "records";

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("monthly");
  const [league, setLeague] = useState<League>("ALL");

  const [elo, setElo]         = useState<EloEntry[]>([]);
  const [tend, setTend]       = useState<TendenciaEntry[]>([]);
  const [danger, setDanger]   = useState<DeckDangerEntry[]>([]);
  const [matrix, setMatrix]   = useState<H2hMatrixEntry[]>([]);
  const [mrd, setMrd]         = useState<MonthlyEntry[]>([]);
  const [mmx, setMmx]         = useState<MonthlyEntry[]>([]);
  const [mwr, setMwr]         = useState<MonthlyEntry[]>([]);
  const [mvp, setMvp]         = useState<MvpEntry[]>([]);
  const [streaks, setStreaks] = useState<StreakEntry[]>([]);
  const [king, setKing]       = useState<KingmakerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getElo(), getTendencia(), getDeckDanger(), getH2hMatrix(),
      getMonthlyRD(), getMonthlyMX(), getMonthlyWr(), getMvp(),
      getStreaks(), getKingmaker(),
    ]).then(([e, t, d, m, rd, mx, wr, mv, st, kg]) => {
      setElo(e); setTend(t); setDanger(d); setMatrix(m);
      setMrd(rd); setMmx(mx); setMwr(wr); setMvp(mv);
      setStreaks(st); setKing(kg);
      setLoading(false);
    });
  }, []);

  const currentMonth = useMemo(() => {
    const all = [...mrd, ...mmx, ...mwr].map(m => m.year_month!).filter(Boolean);
    return all.length ? [...all].sort().at(-1)! : "";
  }, [mrd, mmx, mwr]);

  if (loading) return <Skeleton />;

  const TABS: { key: Tab; label: string }[] = [
    { key: "monthly", label: "Monthly" },
    { key: "records", label: "Records" },
    { key: "h2h",     label: "H2H" },
    { key: "danger",  label: "Danger" },
    { key: "elo",     label: "ELO" },
    { key: "trends",  label: "Trends" },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="font-cinzel text-2xl font-bold text-gold-gradient mb-1">Analytics</h1>
      <div className="flex items-center justify-between mb-4">
        <LeagueFilter value={league} onChange={setLeague} />
        <span className="text-[10px] text-muted">RD = red · MX = green</span>
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl overflow-x-auto" style={{ background: "#0f0f1c" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 py-1.5 rounded-lg text-xs font-cinzel font-semibold whitespace-nowrap transition-all px-2"
            style={{
              background: tab === t.key ? "#1e1e38" : "transparent",
              color: tab === t.key ? "#c8a951" : "#7a7898",
              border: tab === t.key ? "1px solid #2a2a4a" : "1px solid transparent",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "monthly" && <MonthlyTab mrd={mrd} mmx={mmx} mwr={mwr} mvp={mvp} currentMonth={currentMonth} />}
      {tab === "records" && <RecordsTab streaks={streaks} king={king} league={league} />}
      {tab === "elo"     && <EloTab elo={elo} league={league} />}
      {tab === "trends"  && <TrendsTab tend={tend} league={league} />}
      {tab === "h2h"     && <H2hTab matrix={matrix} elo={elo} league={league} />}
      {tab === "danger"  && <DangerTab danger={danger} league={league} />}
    </div>
  );
}

// ── Shared: explainer block (item 6: every stat says WHAT it measures and HOW) ──

function Explainer({ what, how, read }: { what: string; how: string; read?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg mb-3 overflow-hidden" style={{ background: "#12122266", border: "1px solid #1e1e38" }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <span className="text-gold text-xs">ⓘ</span>
        <span className="text-xs text-parchment/80 flex-1">{what}</span>
        <span className="text-muted text-[10px]">{open ? "▲ less" : "▼ how it works"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-muted leading-relaxed"><span className="text-gold/80 font-semibold">How it&apos;s calculated: </span>{how}</p>
          {read && <p className="text-xs text-muted leading-relaxed"><span className="text-gold/80 font-semibold">How to read it: </span>{read}</p>}
        </div>
      )}
    </div>
  );
}

const Dot = ({ c }: { c: string }) => (
  <span className="inline-block w-2 h-2 rounded-full" style={{ background: c }} />
);

// ── Monthly Tab ────────────────────────────────────────────────────────────────

function MonthlyTab({ mrd, mmx, mwr, mvp, currentMonth }: {
  mrd: MonthlyEntry[]; mmx: MonthlyEntry[];
  mwr: MonthlyEntry[]; mvp: MvpEntry[]; currentMonth: string;
}) {
  const rdNow  = mrd.filter(m => m.year_month === currentMonth).sort((a, b) => b.win_rate - a.win_rate);
  const mxNow  = mmx.filter(m => m.year_month === currentMonth).sort((a, b) => b.win_rate - a.win_rate);
  const crossNow = mwr.filter(m => m.year_month === currentMonth).sort((a, b) => b.win_rate - a.win_rate);
  const mvpNow = mvp.filter(m => m.year_month === currentMonth);
  const totalGames = crossNow.reduce((s, m) => s + m.juegos, 0);

  const pastMonths = useMemo(() => {
    const months = [...new Set(mvp.map(m => m.year_month))].sort().reverse().slice(1, 7);
    return months.map(ym => ({ ym, entries: mvp.filter(m => m.year_month === ym) }));
  }, [mvp]);

  return (
    <div className="space-y-4">
      <Explainer
        what="This month's performance, split by league, plus the running MVP."
        how="Every game this calendar month counts once per player. Win rate = games won (1st place only) ÷ games played. The MVP is the player with the most wins this month (minimum 3 games; win rate breaks ties)."
        read="Bars are win rate: full bar = won everything. A high win rate on very few games is fragile — check the game count next to it."
      />

      <div className="flex items-baseline gap-2">
        <span className="font-cinzel text-parchment text-base">{currentMonth}</span>
        <span className="text-muted text-xs">{totalGames} player-games logged this month</span>
      </div>

      {/* MVP */}
      {mvpNow.length > 0 && (
        <div className="card-arcane p-3">
          <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">MVP of the Month</h3>
          <div className="flex gap-3">
            {mvpNow.map(m => (
              <Link key={m.player_league} href={`/players/${encodeURIComponent(m.player)}`}
                className="flex-1 flex items-center gap-2">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                  style={{ border: `2px solid ${leagueColor(m.player_league)}` }}>
                  <ScryfallArt deckName="" className="w-full h-full" />
                </div>
                <div>
                  <div className="text-[10px] font-bold font-cinzel" style={{ color: leagueColor(m.player_league) }}>
                    {m.player_league}
                  </div>
                  <div className="text-sm text-parchment font-semibold">{m.player}</div>
                  <div className="text-gold text-xs">{m.victorias} wins · {fmt(m.win_rate)} · {m.juegos}G</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pods side by side */}
      <div className="grid grid-cols-2 gap-3">
        <PodCard title="RD League" color={COL_RD} rows={rdNow} />
        <PodCard title="MX League" color={COL_MX} rows={mxNow} />
      </div>

      {/* Cross-pod */}
      {crossNow.length > 0 && (
        <div className="card-arcane p-3">
          <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">Cross-League Ranking</h3>
          <p className="text-[10px] text-muted mb-3">Everyone who played this month, both leagues on one board.</p>
          <HBarChart
            rows={crossNow.map(m => ({
              label: m.player,
              value: m.win_rate,
              max: 1,
              color: leagueColor(m.player_league ?? ""),
              sub: `${fmt(m.win_rate)} · ${m.juegos}G`,
              href: `/players/${encodeURIComponent(m.player)}`,
            }))}
          />
        </div>
      )}

      {/* Past MVPs */}
      {pastMonths.length > 0 && (
        <div className="card-arcane p-3">
          <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">MVP History</h3>
          <p className="text-[10px] text-muted mb-3">Best player of each past month (most wins, min. 3 games).</p>
          <div className="space-y-2">
            {pastMonths.map(({ ym, entries }) => (
              <div key={ym} className="flex items-center gap-3 py-1.5 border-b border-border/20">
                <span className="text-xs text-muted w-16 flex-shrink-0">{ym}</span>
                {entries.map(e => (
                  <div key={e.player_league} className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Dot c={leagueColor(e.player_league)} />
                    <span className="text-xs text-parchment truncate">{e.player}</span>
                    <span className="text-xs text-gold">{e.victorias}W · {fmt(e.win_rate)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Records Tab (streaks + kingmaker) ──────────────────────────────────────────

function RecordsTab({ streaks, king, league }: { streaks: StreakEntry[]; king: KingmakerEntry[]; league: League }) {
  const inL = (l: string) => league === "ALL" || l === league;
  streaks = streaks.filter(s => inL(s.player_league));
  king = king.filter(k => inL(k.player_league));
  const byWinStreak = [...streaks].sort((a, b) => b.max_victorias - a.max_victorias);
  const byLossStreak = [...streaks].sort((a, b) => b.max_derrotas - a.max_derrotas).slice(0, 8);
  const maxW = byWinStreak[0]?.max_victorias ?? 1;
  const maxL = byLossStreak[0]?.max_derrotas ?? 1;
  const kingSorted = [...king].sort((a, b) => b.seg_rate - a.seg_rate).slice(0, 10);

  return (
    <div className="space-y-4">
      <Explainer
        what="All-time streaks and the pod's 'always the bridesmaid' award."
        how="Streaks: each player's games are laid out in chronological order; we count the longest unbroken run of wins and of losses (minimum 10 games played). Kingmaker rate = how often a player finishes exactly 2nd — close enough to threaten, not enough to win."
        read="A long win streak with a low overall win rate means one legendary hot night. A high 2nd-place rate with a low win rate is the classic kingmaker: they decide who wins without winning themselves."
      />

      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">Longest Win Streaks</h3>
        <p className="text-[10px] text-muted mb-3">Best unbroken run of 1st places, all-time.</p>
        <div className="space-y-2">
          {byWinStreak.map(s => (
            <Link key={s.player} href={`/players/${encodeURIComponent(s.player)}`}>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-parchment w-24 truncate flex-shrink-0">{s.player}</span>
                <div className="flex-1 h-2.5 rounded overflow-hidden" style={{ background: "#1e1e38" }}>
                  <div className="h-full rounded" style={{
                    width: `${(s.max_victorias / maxW) * 100}%`,
                    background: leagueColor(s.player_league), opacity: 0.9,
                  }} />
                </div>
                <span className="text-xs font-bold text-gold w-8 text-right">{s.max_victorias}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">Longest Losing Streaks</h3>
        <p className="text-[10px] text-muted mb-3">Worst unbroken run without a win. Respect the grind.</p>
        <div className="space-y-2">
          {byLossStreak.map(s => (
            <Link key={s.player} href={`/players/${encodeURIComponent(s.player)}`}>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-parchment w-24 truncate flex-shrink-0">{s.player}</span>
                <div className="flex-1 h-2.5 rounded overflow-hidden" style={{ background: "#1e1e38" }}>
                  <div className="h-full rounded" style={{
                    width: `${(s.max_derrotas / maxL) * 100}%`,
                    background: "#4a4a6a",
                  }} />
                </div>
                <span className="text-xs font-bold text-muted w-8 text-right">{s.max_derrotas}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">The Kingmakers</h3>
        <p className="text-[10px] text-muted mb-3">
          % of games finished exactly 2nd. Gold dot = their actual win rate, for contrast.
        </p>
        <div className="space-y-2">
          {kingSorted.map(k => (
            <Link key={k.player} href={`/players/${encodeURIComponent(k.player)}`}>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-parchment w-24 truncate flex-shrink-0">{k.player}</span>
                <div className="flex-1 relative h-2.5 rounded overflow-visible" style={{ background: "#1e1e38" }}>
                  <div className="h-full rounded" style={{
                    width: `${k.seg_rate * 100}%`,
                    background: leagueColor(k.player_league), opacity: 0.85,
                  }} />
                  {/* win-rate marker */}
                  <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                    style={{ left: `calc(${Math.min(k.win_rate * 100, 98)}% - 4px)`, background: "#c8a951", boxShadow: "0 0 4px #c8a951" }} />
                </div>
                <span className="text-xs font-bold w-20 text-right">
                  <span style={{ color: leagueColor(k.player_league) }}>{fmt(k.seg_rate)}</span>
                  <span className="text-muted text-[9px]"> 2nd</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ELO Tab ────────────────────────────────────────────────────────────────────

function EloTab({ elo, league }: { elo: EloEntry[]; league: League }) {
  const sorted = [...elo]
    .filter(e => league === "ALL" || e.player_league === league)
    .sort((a, b) => b.elo - a.elo);
  const maxElo = sorted[0]?.elo ?? 1600;
  const minElo = sorted.at(-1)?.elo ?? 1400;

  return (
    <div className="space-y-3">
      <Explainer
        what="A skill rating that weighs WHO you beat, not just how often you win."
        how="Everyone starts at 1500. After each game, every pair of players in the pod is scored as a mini-duel: finishing above someone counts as beating them. Beating a higher-rated player pays more points than beating a lower-rated one (K=24, scaled by pod size so 5-player games don't swing harder than 3-player games). Ratings update game by game in chronological order."
        read="1500 is average. Above ~1550 means consistently beating strong opposition; below ~1450 the opposite. Unlike win rate, ELO barely moves when you farm wins against weaker tables — it's the 'strength of schedule' view of the same results."
      />
      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">ELO Ranking</h3>
        <HBarChart
          rows={sorted.map((e, i) => ({
            label: `#${i + 1} ${e.player}`,
            value: e.elo - minElo + 20,
            max: maxElo - minElo + 20,
            color: leagueColor(e.player_league),
            sub: `${Math.round(e.elo)} · ${e.juegos}G`,
            href: `/players/${encodeURIComponent(e.player)}`,
          }))}
        />
      </div>

      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">ELO vs Win Rate</h3>
        <p className="text-[10px] text-muted mb-3">
          When ELO ranks someone higher than their win rate would, their wins came against tougher tables.
        </p>
        <div className="space-y-1">
          {sorted.map(e => (
            <Link key={e.player} href={`/players/${encodeURIComponent(e.player)}`}>
              <div className="flex items-center gap-2 py-1.5 border-b border-border/20">
                <Dot c={leagueColor(e.player_league)} />
                <span className="text-sm text-parchment flex-1 truncate">{e.player}</span>
                <span className="text-xs font-bold" style={{ color: "#8E44AD", minWidth: 52, textAlign: "right" }}>
                  {Math.round(e.elo)}
                </span>
                <span className="text-xs text-gold font-bold" style={{ minWidth: 44, textAlign: "right" }}>
                  {fmt(e.win_rate)}
                </span>
                <span className="text-xs text-muted" style={{ minWidth: 30, textAlign: "right" }}>
                  {e.juegos}G
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Trends Tab ─────────────────────────────────────────────────────────────────

function TrendsTab({ tend, league }: { tend: TendenciaEntry[]; league: League }) {
  const sorted = [...tend]
    .filter(t => league === "ALL" || t.player_league === league)
    .sort((a, b) => b.slope - a.slope);
  const maxAbs = Math.max(...sorted.map(t => Math.abs(t.slope)), 0.001);
  const trendColor = (t: string) =>
    t === "subiendo" ? "#27AE60" : t === "bajando" ? COL_RD : "#7a7898";
  const trendLabel = (t: string) =>
    t === "subiendo" ? "improving" : t === "bajando" ? "declining" : "steady";

  return (
    <div className="space-y-3">
      <Explainer
        what="Whether each player is getting better or worse over time."
        how="We take each player's win rate month by month and fit a straight line through those points (linear regression). The slope of that line is the trend: +2%/mo means their monthly win rate has been climbing about two points each month."
        read="Bars to the right of the center line = improving, left = declining. A steep slope on few months of data is noisy — trust trends built on 5+ months."
      />
      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">Who&apos;s Improving?</h3>
        <div className="space-y-2">
          {sorted.map(t => {
            const pos = t.slope >= 0;
            const pct = Math.abs(t.slope) / maxAbs;
            const color = trendColor(t.tendencia);
            return (
              <Link key={t.player} href={`/players/${encodeURIComponent(t.player)}`}>
                <div className="flex items-center gap-2 py-1">
                  <span className="text-xs text-parchment w-20 truncate flex-shrink-0">{t.player}</span>
                  <div className="flex-1 flex items-center" style={{ height: 14 }}>
                    <div className="flex-1 flex justify-end">
                      {!pos && (
                        <div style={{ width: `${pct * 100}%`, background: color, height: 10, borderRadius: "3px 0 0 3px", opacity: 0.8 }} />
                      )}
                    </div>
                    <div style={{ width: 1, background: "#3a3a5c", height: 14, flexShrink: 0 }} />
                    <div className="flex-1">
                      {pos && (
                        <div style={{ width: `${pct * 100}%`, background: color, height: 10, borderRadius: "0 3px 3px 0", opacity: 0.8 }} />
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold w-16 text-right flex-shrink-0" style={{ color }}>
                    {t.slope > 0 ? "+" : ""}{(t.slope * 100).toFixed(1)}%/mo
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">Win Rate: First Month → Latest</h3>
        <p className="text-[10px] text-muted mb-3">Each player&apos;s monthly win rate in their first recorded month vs their most recent one.</p>
        <div className="space-y-1">
          {sorted.map(t => (
            <Link key={t.player} href={`/players/${encodeURIComponent(t.player)}`}>
              <div className="flex items-center gap-2 py-1.5 border-b border-border/20">
                <span className="text-xs text-parchment flex-1 truncate">{t.player}</span>
                <span className="text-xs text-muted">{fmt(t.wr_inicial)}</span>
                <span className="text-xs text-muted">→</span>
                <span className="text-xs font-bold text-gold">{fmt(t.wr_final)}</span>
                <span className="text-[10px] w-14 text-right" style={{ color: trendColor(t.tendencia) }}>
                  {trendLabel(t.tendencia)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── H2H Tab ────────────────────────────────────────────────────────────────────

function H2hTab({ matrix, elo, league }: { matrix: H2hMatrixEntry[]; elo: EloEntry[]; league: League }) {
  const leagueOf = useMemo(() => new Map(elo.map(e => [e.player, e.player_league])), [elo]);
  const inL = (p: string) => league === "ALL" || leagueOf.get(p) === league;
  matrix = useMemo(() => matrix.filter(r => inL(r.from) && inL(r.to)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matrix, league, leagueOf]);
  const players = useMemo(() => {
    const set = new Set<string>();
    for (const r of matrix) { set.add(r.from); set.add(r.to); }
    return [...set].sort();
  }, [matrix]);

  const lookup = useMemo(() => {
    const m = new Map<string, { wr: number; games: number }>();
    for (const r of matrix) m.set(`${r.from}||${r.to}`, { wr: r.wr, games: r.games });
    return m;
  }, [matrix]);

  function cellColor(wr: number | undefined): string {
    if (wr === undefined) return "#1a1a2e";
    if (wr >= 0.65) return "#1a4731";
    if (wr >= 0.5)  return "#1a3120";
    if (wr >= 0.35) return "#3a1a1a";
    return "#4a1010";
  }

  return (
    <div className="space-y-3">
      <Explainer
        what="Head-to-head dominance between every pair of players."
        how="Every time two players sit in the same game, whoever places higher 'beats' the other. A cell shows how often the ROW player finished above the COLUMN player, out of all their shared games (pairs with fewer than 8 shared games are hidden as too noisy)."
        read="Numbers are percentages: 71 means the row player finishes above that opponent 71% of the time. Green cells favor the row player, red cells the column player. The matrix is mirrored — if A beats B 70%, B beats A 30%."
      />
      <div className="card-arcane p-2 overflow-x-auto">
        <table className="text-[9px] border-collapse w-full">
          <thead>
            <tr>
              <th className="p-1 text-muted text-left" style={{ minWidth: 52 }}>vs</th>
              {players.map(p => (
                <th key={p} className="p-1 text-center" style={{ minWidth: 28 }}>
                  <span className="text-muted">{p.split(" ")[0].slice(0, 4)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map(from => (
              <tr key={from}>
                <td className="p-1 text-parchment text-[9px] font-semibold" style={{ whiteSpace: "nowrap" }}>
                  {from.split(" ")[0]}
                </td>
                {players.map(to => {
                  if (from === to) return <td key={to} style={{ background: "#0f0f1c" }} />;
                  const cell = lookup.get(`${from}||${to}`);
                  return (
                    <td key={to} className="text-center font-bold"
                      style={{ background: cellColor(cell?.wr), color: cell !== undefined ? (cell.wr >= 0.5 ? "#4ade80" : "#f87171") : "#3a3a5c", padding: "3px 2px" }}>
                      {cell !== undefined ? Math.round(cell.wr * 100) : "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Biggest rivals */}
      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-1">Most One-Sided Matchups</h3>
        <p className="text-[10px] text-muted mb-3">Pairs where one player dominates: 60%+ edge over at least 8 shared games.</p>
        <div className="space-y-1">
          {[...matrix]
            .filter(r => r.wr >= 0.6 && r.games >= 8)
            .sort((a, b) => b.wr - a.wr)
            .slice(0, 10)
            .map(r => (
              <div key={`${r.from}-${r.to}`} className="flex items-center gap-2 py-1 border-b border-border/20">
                <span className="text-xs text-parchment flex-1 truncate">{r.from}</span>
                <span className="text-xs text-gold font-bold">{fmt(r.wr)}</span>
                <span className="text-xs text-muted">over</span>
                <span className="text-xs text-parchment/70 flex-1 truncate text-right">{r.to}</span>
                <span className="text-[10px] text-muted">{r.games}G</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Danger Tab ─────────────────────────────────────────────────────────────────

function DangerTab({ danger, league }: { danger: DeckDangerEntry[]; league: League }) {
  const top20 = [...danger]
    .filter(d => league === "ALL" || d.player_league === league)
    .sort((a, b) => b.danger_score - a.danger_score).slice(0, 20);
  const maxScore = top20[0]?.danger_score ?? 1;

  return (
    <div className="space-y-3">
      <Explainer
        what="Which DECKS win the hardest games — not just the most games."
        how="For every win a deck has, we look at who was at the table and average the ELO ratings of the defeated opponents. Danger Score = number of wins × (average defeated-opponent ELO ÷ 1500). Decks with fewer than 2 wins aren't listed."
        read="A score of 10 ≈ ten wins against average opposition; the same ten wins against the pod's strongest players scores higher. 'Avg victim ELO' above 1500 means the deck preys on the top of the food chain, below 1500 means it farms easier tables. The bar is scaled to the #1 deck."
      />
      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">Most Dangerous Decks</h3>
        <div className="space-y-3">
          {top20.map((d, i) => (
            <Link key={`${d.deck_name}-${i}`} href={`/decks/${encodeURIComponent(d.deck_name)}`}>
              <div className="flex items-center gap-2">
                <span className="text-muted text-xs w-5 text-center">{i + 1}</span>
                <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-surface2">
                  <ScryfallArt deckName={d.deck_name} className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-parchment truncate">{stripOwnerSuffix(d.deck_name)}</div>
                  <div className="text-[10px] text-muted">
                    {d.player} · {d.victorias} wins · avg victim ELO {Math.round(d.avg_opp_elo)}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#1e1e38" }}>
                    <div className="h-full rounded-full"
                      style={{
                        width: `${(d.danger_score / maxScore) * 100}%`,
                        background: leagueColor(d.player_league),
                      }} />
                  </div>
                </div>
                <span className="text-xs font-bold text-gold flex-shrink-0">{d.danger_score.toFixed(1)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared Components ──────────────────────────────────────────────────────────

function PodCard({ title, color, rows }: { title: string; color: string; rows: MonthlyEntry[] }) {
  return (
    <div className="card-arcane p-3">
      <h3 className="font-cinzel text-xs uppercase tracking-widest mb-3" style={{ color }}>{title}</h3>
      {rows.length === 0
        ? <p className="text-xs text-muted text-center py-3">No games yet</p>
        : rows.map((m, i) => (
          <Link key={m.player} href={`/players/${encodeURIComponent(m.player)}`}>
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[10px] text-muted w-3">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-parchment truncate">{m.player}</div>
                <div className="h-1.5 rounded overflow-hidden mt-0.5" style={{ background: "#1e1e38" }}>
                  <div className="h-full" style={{ width: `${m.win_rate * 100}%`, background: color }} />
                </div>
              </div>
              <span className="text-[10px] font-bold flex-shrink-0" style={{ color }}>{fmt(m.win_rate)}</span>
            </div>
          </Link>
        ))
      }
    </div>
  );
}

function HBarChart({ rows }: {
  rows: { label: string; value: number; max: number; color: string; sub: string; href?: string }[]
}) {
  const maxVal = rows.reduce((m, r) => Math.max(m, r.value), 0.001);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const inner = (
          <div className="flex items-center gap-2">
            <span className="text-xs text-parchment w-28 truncate flex-shrink-0">{r.label}</span>
            <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: "#1e1e38" }}>
              <div className="h-full rounded" style={{
                width: `${Math.min((r.value / maxVal) * 100, 100)}%`,
                background: r.color,
                opacity: 0.85,
              }} />
            </div>
            <span className="text-xs text-muted flex-shrink-0 w-24 text-right">{r.sub}</span>
          </div>
        );
        return r.href
          ? <Link key={i} href={r.href}>{inner}</Link>
          : <div key={i}>{inner}</div>;
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <div className="h-7 w-32 rounded bg-surface2 animate-pulse" />
      <div className="h-10 rounded-xl bg-surface2 animate-pulse" />
      {[0,1,2].map(i => <div key={i} className="h-48 rounded-lg bg-surface2 animate-pulse" />)}
    </div>
  );
}
