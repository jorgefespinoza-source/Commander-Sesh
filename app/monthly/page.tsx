"use client";
import { useEffect, useState, useMemo } from "react";
import { getMonthlyRD, getMonthlyMX, getMonthlyWr, getMvp } from "@/lib/data";
import type { MonthlyEntry, MvpEntry } from "@/lib/types";
import { fmt } from "@/lib/stats";
import Link from "next/link";
import ScryfallArt from "@/components/ScryfallArt";

const COL_RD  = "#C0392B";
const COL_MX  = "#27AE60";

export default function MonthlyPage() {
  const [mrd, setMrd]   = useState<MonthlyEntry[]>([]);
  const [mmx, setMmx]   = useState<MonthlyEntry[]>([]);
  const [mwr, setMwr]   = useState<MonthlyEntry[]>([]);
  const [mvp, setMvp]   = useState<MvpEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMonthlyRD(), getMonthlyMX(), getMonthlyWr(), getMvp()]).then(
      ([rd, mx, wr, mv]) => { setMrd(rd); setMmx(mx); setMwr(wr); setMvp(mv); setLoading(false); }
    );
  }, []);

  // compute latest month across all datasets
  const currentMonth = useMemo(() => {
    const all = [...mrd, ...mmx, ...mwr].map(m => m.year_month!).filter(Boolean);
    return all.length ? [...all].sort().at(-1)! : "";
  }, [mrd, mmx, mwr]);

  const rdNow = useMemo(() =>
    mrd.filter(m => m.year_month === currentMonth).sort((a, b) => b.win_rate - a.win_rate),
    [mrd, currentMonth]);

  const mxNow = useMemo(() =>
    mmx.filter(m => m.year_month === currentMonth).sort((a, b) => b.win_rate - a.win_rate),
    [mmx, currentMonth]);

  // cross-pod (adv_monthly_wr) — all players combined, current month
  const crossNow = useMemo(() =>
    mwr.filter(m => m.year_month === currentMonth).sort((a, b) => b.win_rate - a.win_rate),
    [mwr, currentMonth]);

  // monthly MVPs for current month
  const mvpNow = useMemo(() =>
    mvp.filter(m => m.year_month === currentMonth),
    [mvp, currentMonth]);

  // history: list of past months with their MVPs
  const pastMonths = useMemo(() => {
    const months = [...new Set(mvp.map(m => m.year_month))].sort().reverse().slice(1, 7);
    return months.map(ym => ({
      ym,
      entries: mvp.filter(m => m.year_month === ym).sort((a, b) => b.win_rate - a.win_rate),
    }));
  }, [mvp]);

  if (loading) return <LoadingSkeleton />;

  const totalGamesNow = [...rdNow, ...mxNow].reduce((s, m) => s + m.juegos, 0) / 2 | 0;
  // crude: sum juegos across all rows / size factor — better to count unique from cross data
  const crossGames = crossNow.reduce((s, m) => s + m.juegos, 0);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <div className="mb-5">
        <h1 className="font-cinzel text-2xl font-bold text-gold-gradient">Monthly Standings</h1>
        <p className="text-muted text-sm mt-0.5">
          {currentMonth || "—"}
          {crossGames > 0 && (
            <span className="ml-2 text-muted/60 text-xs">· {crossNow.reduce((s,m) => s + m.juegos,0)} games registered this month</span>
          )}
        </p>
      </div>

      {/* This month's MVP */}
      {mvpNow.length > 0 && (
        <div className="card-arcane p-3 mb-4">
          <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">MVP of the Month</h3>
          <div className="flex gap-3">
            {mvpNow.map(m => (
              <Link key={m.player_league} href={`/players/${encodeURIComponent(m.player)}`}
                className="flex-1 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
                  style={{ border: `2px solid ${m.player_league === "RD" ? COL_RD : COL_MX}` }}>
                  <ScryfallArt deckName="" className="w-full h-full" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold font-cinzel truncate"
                    style={{ color: m.player_league === "RD" ? COL_RD : COL_MX }}>
                    {m.player_league}
                  </div>
                  <div className="text-sm text-parchment font-semibold truncate">{m.player}</div>
                  <div className="text-gold text-xs font-bold">{fmt(m.win_rate)} · {m.juegos}G</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* RD + MX pods side by side */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <PodStandings title="RD Pod" color={COL_RD} rows={rdNow} />
        <PodStandings title="MX Pod" color={COL_MX} rows={mxNow} />
      </div>

      {/* Cross-pod leaderboard */}
      {crossNow.length > 0 && (
        <div className="card-arcane p-3 mb-4">
          <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">Cross-pod Rankings</h3>
          <div className="space-y-2">
            {crossNow.map((m, i) => (
              <Link key={m.player} href={`/players/${encodeURIComponent(m.player)}`}>
                <div className="flex items-center gap-2 py-1 border-b border-border/20">
                  <span className="text-muted text-xs w-4 text-center font-cinzel">{i + 1}</span>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: m.player_league === "RD" ? COL_RD : COL_MX }} />
                  <span className="text-sm text-parchment flex-1 truncate">{m.player}</span>
                  <div className="flex-1 wr-bar max-w-[60px]">
                    <div className="wr-bar-fill" style={{
                      width: `${Math.min(m.win_rate * 100, 100)}%`,
                      background: m.player_league === "RD" ? COL_RD : COL_MX,
                    }} />
                  </div>
                  <span className="text-xs font-bold text-gold w-12 text-right">{fmt(m.win_rate)}</span>
                  <span className="text-xs text-muted w-6 text-right">{m.juegos}G</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Past months MVP history */}
      {pastMonths.length > 0 && (
        <div className="card-arcane p-3">
          <h3 className="font-cinzel text-xs text-gold uppercase tracking-widest mb-3">Past MVPs</h3>
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

function PodStandings({
  title, color, rows
}: {
  title: string; color: string; rows: MonthlyEntry[];
}) {
  return (
    <div className="card-arcane p-3">
      <h3 className="font-cinzel text-xs uppercase tracking-widest mb-3" style={{ color }}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted text-center py-4">No games yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map((m, i) => (
            <Link key={m.player} href={`/players/${encodeURIComponent(m.player)}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted w-4 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-parchment truncate leading-tight">{m.player}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="wr-bar flex-1" style={{ height: "2px" }}>
                      <div className="wr-bar-fill"
                        style={{ width: `${Math.min(m.win_rate * 100, 100)}%`, background: color }} />
                    </div>
                    <span className="text-[10px] font-bold flex-shrink-0" style={{ color }}>{fmt(m.win_rate)}</span>
                  </div>
                  <div className="text-[10px] text-muted">{m.victorias}W·{m.juegos}G</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <div className="h-8 w-40 rounded bg-surface2 animate-pulse" />
      <div className="h-24 rounded-lg bg-surface2 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-56 rounded-lg bg-surface2 animate-pulse" />
        <div className="h-56 rounded-lg bg-surface2 animate-pulse" />
      </div>
      <div className="h-40 rounded-lg bg-surface2 animate-pulse" />
    </div>
  );
}
