"use client";
import { useEffect, useState, useMemo } from "react";
import {
  getElo, getTendencia, getDeckDanger, getH2hMatrix,
  getMonthlyRD, getMonthlyMX, getMonthlyWr, getMvp
} from "@/lib/data";
import type { EloEntry, TendenciaEntry, DeckDangerEntry, H2hMatrixEntry, MonthlyEntry, MvpEntry } from "@/lib/types";
import { fmt, fmtScore, stripOwnerSuffix } from "@/lib/stats";
import Link from "next/link";
import ScryfallArt from "@/components/ScryfallArt";

const COL_RD = "#C0392B";
const COL_MX = "#2980B9";
type Tab = "monthly" | "elo" | "trends" | "h2h" | "danger";

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("monthly");

  const [elo, setElo]         = useState<EloEntry[]>([]);
  const [tend, setTend]       = useState<TendenciaEntry[]>([]);
  const [danger, setDanger]   = useState<DeckDangerEntry[]>([]);
  const [matrix, setMatrix]   = useState<H2hMatrixEntry[]>([]);
  const [mrd, setMrd]         = useState<MonthlyEntry[]>([]);
  const [mmx, setMmx]         = useState<MonthlyEntry[]>([]);
  const [mwr, setMwr]         = useState<MonthlyEntry[]>([]);
  const [mvp, setMvp]         = useState<MvpEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getElo(), getTendencia(), getDeckDanger(), getH2hMatrix(),
      getMonthlyRD(), getMonthlyMX(), getMonthlyWr(), getMvp()
    ]).then(([e, t, d, m, rd, mx, wr, mv]) => {
      setElo(e); setTend(t); setDanger(d); setMatrix(m);
      setMrd(rd); setMmx(mx); setMwr(wr); setMvp(mv);
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
    { key: "elo",     label: "ELO" },
    { key: "trends",  label: "Trends" },
    { key: "h2h",     label: "H2H" },
    { key: "danger",  label: "Danger" },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="font-cinzel text-2xl font-bold text-gold-gradient mb-4">Analytics</h1>

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
      {tab === "elo"     && <EloTab elo={elo} />}
      {tab === "trends"  && <TrendsTab tend={tend} />}
      {tab === "h2h"     && <H2hTab matrix={matrix} />}
      {tab === "danger"  && <DangerTab danger={danger} />}
    </div>
  );
}

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
      <div className="flex items-baseline gap-2">
        <span className="font-cinzel text-parchment text-base">{currentMonth}</span>
        <span className="text-muted text-xs">{totalGames} juegos registrados este mes</span>
      </div>

      {/* MVP */}
      {mvpNow.length > 0 && (
        <div className="card-arcane p-3">
          <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">MVP del Mes</h3>
          <div className="flex gap-3">
            {mvpNow.map(m => (
              <Link key={m.player_league} href={`/players/${encodeURIComponent(m.player)}`}
                className="flex-1 flex items-center gap-2">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                  style={{ border: `2px solid ${m.player_league === "RD" ? COL_RD : COL_MX}` }}>
                  <ScryfallArt deckName="" className="w-full h-full" />
                </div>
                <div>
                  <div className="text-[10px] font-bold font-cinzel"
                    style={{ color: m.player_league === "RD" ? COL_RD : COL_MX }}>{m.player_league}</div>
                  <div className="text-sm text-parchment font-semibold">{m.player}</div>
                  <div className="text-gold text-xs">{fmt(m.win_rate)} · {m.juegos}G</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pods side by side */}
      <div className="grid grid-cols-2 gap-3">
        <PodCard title="RD Pod" color={COL_RD} rows={rdNow} />
        <PodCard title="MX Pod" color={COL_MX} rows={mxNow} />
      </div>

      {/* Cross-pod */}
      {crossNow.length > 0 && (
        <div className="card-arcane p-3">
          <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">Cross-Pod Rankings</h3>
          <HBarChart
            rows={crossNow.map(m => ({
              label: m.player,
              value: m.win_rate,
              max: 1,
              color: m.player_league === "RD" ? COL_RD : COL_MX,
              sub: `${fmt(m.win_rate)} · ${m.juegos}G`,
              href: `/players/${encodeURIComponent(m.player)}`,
            }))}
          />
        </div>
      )}

      {/* Past MVPs */}
      {pastMonths.length > 0 && (
        <div className="card-arcane p-3">
          <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">Historial MVP</h3>
          <div className="space-y-2">
            {pastMonths.map(({ ym, entries }) => (
              <div key={ym} className="flex items-center gap-3 py-1.5 border-b border-border/20">
                <span className="text-xs text-muted w-16 flex-shrink-0">{ym}</span>
                {entries.map(e => (
                  <div key={e.player_league} className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: e.player_league === "RD" ? COL_RD : COL_MX }} />
                    <span className="text-xs text-parchment truncate">{e.player}</span>
                    <span className="text-xs text-gold">{fmt(e.win_rate)}</span>
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

// ── ELO Tab ────────────────────────────────────────────────────────────────────

function EloTab({ elo }: { elo: EloEntry[] }) {
  const maxElo = Math.max(...elo.map(e => e.elo));
  const sorted = [...elo].sort((a, b) => b.elo - a.elo);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Commander ELO — calculated across all games, K=32. Baseline 1500.</p>
      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">ELO Ranking</h3>
        <HBarChart
          rows={sorted.map((e, i) => ({
            label: `#${i + 1} ${e.player}`,
            value: e.elo - 1000,   // offset so bars are meaningful
            max: maxElo - 1000,
            color: e.player_league === "RD" ? COL_RD : COL_MX,
            sub: `${Math.round(e.elo)} (${e.player_league})`,
            href: `/players/${encodeURIComponent(e.player)}`,
          }))}
        />
      </div>

      {/* ELO vs Win Rate scatter (table form) */}
      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">ELO vs Win Rate</h3>
        <div className="space-y-1">
          {sorted.map(e => (
            <Link key={e.player} href={`/players/${encodeURIComponent(e.player)}`}>
              <div className="flex items-center gap-2 py-1.5 border-b border-border/20">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: e.player_league === "RD" ? COL_RD : COL_MX }} />
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

function TrendsTab({ tend }: { tend: TendenciaEntry[] }) {
  const sorted = [...tend].sort((a, b) => b.slope - a.slope);
  const maxAbs = Math.max(...sorted.map(t => Math.abs(t.slope)), 0.001);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Win-rate slope per month (linear regression). Positive = improving.</p>
      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">Who's Improving?</h3>
        <div className="space-y-2">
          {sorted.map(t => {
            const pos = t.slope >= 0;
            const pct = Math.abs(t.slope) / maxAbs;
            const color = t.tendencia === "Mejorando" ? "#27AE60" : t.tendencia === "Declinando" ? COL_RD : "#7a7898";
            return (
              <Link key={t.player} href={`/players/${encodeURIComponent(t.player)}`}>
                <div className="flex items-center gap-2 py-1">
                  <span className="text-xs text-parchment w-20 truncate flex-shrink-0">{t.player}</span>
                  {/* centered bar */}
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

      {/* WR inicial vs final */}
      <div className="card-arcane p-3">
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">WR: Start → Now</h3>
        <div className="space-y-1">
          {sorted.map(t => (
            <Link key={t.player} href={`/players/${encodeURIComponent(t.player)}`}>
              <div className="flex items-center gap-2 py-1.5 border-b border-border/20">
                <span className="text-xs text-parchment flex-1 truncate">{t.player}</span>
                <span className="text-xs text-muted">{fmt(t.wr_inicial)}</span>
                <span className="text-xs text-muted">→</span>
                <span className="text-xs font-bold text-gold">{fmt(t.wr_final)}</span>
                <span className="text-[10px]"
                  style={{ color: t.tendencia === "Mejorando" ? "#27AE60" : t.tendencia === "Declinando" ? COL_RD : "#7a7898" }}>
                  {t.tendencia}
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

function H2hTab({ matrix }: { matrix: H2hMatrixEntry[] }) {
  const players = useMemo(() => {
    const set = new Set<string>();
    for (const r of matrix) { set.add(r.from); set.add(r.to); }
    return [...set].sort();
  }, [matrix]);

  const lookup = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of matrix) m.set(`${r.from}||${r.to}`, r.wr);
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
      <p className="text-xs text-muted">Win rate of row player vs column player. Green = row wins more.</p>
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
                  const wr = lookup.get(`${from}||${to}`);
                  return (
                    <td key={to} className="text-center font-bold"
                      style={{ background: cellColor(wr), color: wr !== undefined ? (wr >= 0.5 ? "#4ade80" : "#f87171") : "#3a3a5c", padding: "3px 2px" }}>
                      {wr !== undefined ? Math.round(wr * 100) : "·"}
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
        <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">Rivalidades Más Polarizadas</h3>
        <div className="space-y-1">
          {[...matrix]
            .filter(r => r.wr >= 0.6 && r.games >= 5)
            .sort((a, b) => b.wr - a.wr)
            .slice(0, 10)
            .map(r => (
              <div key={`${r.from}-${r.to}`} className="flex items-center gap-2 py-1 border-b border-border/20">
                <span className="text-xs text-parchment flex-1 truncate">{r.from}</span>
                <span className="text-xs text-gold font-bold">{fmt(r.wr)}</span>
                <span className="text-xs text-muted">vs</span>
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

function DangerTab({ danger }: { danger: DeckDangerEntry[] }) {
  const top20 = [...danger].sort((a, b) => b.danger_score - a.danger_score).slice(0, 20);
  const maxScore = top20[0]?.danger_score ?? 1;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Danger Score = wins × avg opponent ELO / 1000. Measures quality of wins.</p>
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
                    {d.player} · {d.victorias}W · avg opp Elo {Math.round(d.avg_opp_elo)}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#1e1e38" }}>
                    <div className="h-full rounded-full"
                      style={{
                        width: `${(d.danger_score / maxScore) * 100}%`,
                        background: d.player_league === "RD" ? COL_RD : COL_MX,
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
          <div key={i} className="flex items-center gap-2">
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
