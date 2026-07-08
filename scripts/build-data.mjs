#!/usr/bin/env node
/**
 * Commander Sesh — data pipeline
 * ------------------------------------------------------------------
 * Single source of truth: the public Google Sheet (Game Log + Deck List tabs).
 * This script fetches those tabs as CSV (no credentials required — the sheet is
 * "anyone with the link"), normalizes them, and regenerates every JSON file the
 * web app loads from public/data/.
 *
 * It replaces the old R + Excel pipeline entirely. Run it locally with
 *   node scripts/build-data.mjs
 * or let the GitHub Action (.github/workflows/build-data.yml) run it on a
 * schedule / on demand and commit the results so Vercel redeploys.
 *
 * Design notes:
 *  - Zero npm dependencies: uses Node's built-in fetch + a small CSV parser.
 *  - Deterministic: same sheet in => same JSON out (stable sort keys), so the
 *    Action only commits when the data genuinely changed.
 *  - "player_league" (RD/MX) is an assigned attribute that is NOT in the sheet;
 *    it is preserved in scripts/config/leagues.json.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveCards } from "./resolve-cards.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data");

// Native Google Sheet (converted from the original uploaded .xlsx on 2026-07-07;
// the old ID 1wrlHIJ6O6Z4kHnGcD2DhbUutuwIBLwN4 is the dead Office-format file).
const SHEET_ID = process.env.SHEET_ID || "1iHjEijCrgXprn8gHXZqqUHHGjcqKH1r-y1zGlsH5g8I";
const csvUrl = (tab) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

// Tunables that control which players/pairs appear in the ranked/aggregated
// outputs. Chosen to reproduce the counts of the original R outputs; adjust here
// if the pod grows and you want different cutoffs.
const MIN_GAMES_RANKING = 20;   // min games to appear in league rankings
const MIN_GAMES_ANALYTICS = 10; // min games for elo/streaks/kingmaker/tendencia
const MIN_GAMES_H2H = 8;        // min shared games for a head-to-head pair
const MIN_GAMES_MONTH_MVP = 3;  // min games in a month to be that month's MVP

// ------------------------------------------------------------------ utilities

/** Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, commas, newlines). */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, inQuotes = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchTab(tab) {
  const res = await fetch(csvUrl(tab));
  if (!res.ok) throw new Error(`Failed to fetch tab "${tab}": HTTP ${res.status}`);
  return parseCSV(await res.text());
}

const round = (x, d = 3) => {
  const f = 10 ** d;
  return Math.round((x + Number.EPSILON) * f) / f;
};

/** M/D/YYYY -> YYYY-MM-DD (returns "" if unparseable). */
function toISO(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

// ------------------------------------------------------------------ config

const leaguesCfg = JSON.parse(await readFile(join(__dirname, "config", "leagues.json"), "utf8"));
const aliasesCfg = JSON.parse(await readFile(join(__dirname, "config", "aliases.json"), "utf8"));
const unknownPlayers = new Set();
/** Strip control / zero-width / bidi / word-joiner chars that sneak in from
 *  WhatsApp and phone keyboards (e.g. U+2060 prefixing "Lasa" or "Pantlaza"),
 *  and collapse whitespace. Applied to player AND deck names. */
const cleanText = (s) =>
  Array.from(String(s || ""))
    .filter((ch) => {
      const c = ch.codePointAt(0);
      if (c < 0x20 || c === 0x7f) return false;
      if (c >= 0x200b && c <= 0x200f) return false;
      if (c >= 0x202a && c <= 0x202e) return false;
      if (c >= 0x2060 && c <= 0x2064) return false;
      if (c === 0xfeff) return false;
      return true;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

const canonPlayer = (name) => {
  const t = cleanText(name);
  const a = aliasesCfg.players[t.toLowerCase()];
  return a || t;
};
/** The league map IS the roster. Only rostered players appear on leaderboards. */
const isRostered = (player) =>
  Object.prototype.hasOwnProperty.call(leaguesCfg.leagues, player);
const leagueOf = (player) => {
  if (leaguesCfg.leagues[player]) return leaguesCfg.leagues[player];
  unknownPlayers.add(player);
  return leaguesCfg.defaultLeague;
};

// ------------------------------------------------------------------ parse Deck List

/** -> { decks: [{name, owner, colorIdentity}], colorByDeck: Map<name, ci> } */
function parseDeckList(rows) {
  const WUBRG = ["W", "U", "B", "R", "G"];
  const decks = [];
  const colorByDeck = new Map();
  let owner = "";
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells || cells.every((c) => !String(c).trim())) continue;
    if (String(cells[0]).trim()) owner = cleanText(cells[0]);
    const name = cleanText(cells[1]);
    if (!name) continue; // owner-only header row (player with no decks yet)
    // Columns 2..6 are the positional W U B R G slots; any non-empty = present.
    let ci = "";
    for (let k = 0; k < 5; k++) {
      if (String(cells[2 + k] || "").trim()) ci += WUBRG[k];
    }
    decks.push({ name, owner, colorIdentity: ci });
    colorByDeck.set(name.toLowerCase(), ci);
  }
  return { decks, colorByDeck };
}

// ------------------------------------------------------------------ parse Game Log

/**
 * -> games: [{date, gameNum, placement, player, deck, colorIdentity, podSize}]
 * Date fills forward across rows; each non-empty Game value starts a new game.
 * gameNum is made globally unique by combining the running date with the sheet's
 * per-day game number, then re-indexed sequentially so grouping is unambiguous.
 */
function parseGameLog(rows, colorByDeck) {
  // Header names changed when the pod standardized the sheet (July 2026);
  // accept both generations so a rename doesn't silently break the build.
  const HEADER_ALIASES = {
    date: ["DATE", "Date"],
    game: ["GAME ID", "Game"],
    placement: ["PLACE", "Placement"],
    player: ["PLAYER", "Player"],
    deck: ["DECK NAME", "Deck Name"],
  };
  const headerRow = rows[0].map((h) => String(h).trim());
  const idx = {};
  for (const [key, names] of Object.entries(HEADER_ALIASES)) {
    idx[key] = names.map((n) => headerRow.indexOf(n)).find((i) => i >= 0);
    if (idx[key] === undefined)
      throw new Error(`Game Log header not found: tried ${names.join(", ")}`);
  }
  const col = (cells, key) => String(cells[idx[key]] ?? "").trim();

  let curDate = "";
  let curDayGame = "";
  const raw = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells || cells.every((c) => !String(c).trim())) continue;
    const dISO = toISO(col(cells, "date"));
    if (dISO) curDate = dISO;
    const g = col(cells, "game");
    if (g) curDayGame = g;
    const player = canonPlayer(col(cells, "player"));
    const deck = cleanText(col(cells, "deck"));
    const placement = parseInt(col(cells, "placement"), 10);
    if (!player && !deck) continue;
    raw.push({
      date: curDate,
      groupKey: `${curDate}#${curDayGame}`,
      placement: Number.isFinite(placement) ? placement : 0,
      player,
      deck,
      colorIdentity: colorByDeck.get(deck.toLowerCase()) || "",
    });
  }

  // Assign a stable sequential gameNum per (date + day-game) group and podSize.
  const groups = new Map();
  for (const row of raw) {
    if (!groups.has(row.groupKey)) groups.set(row.groupKey, []);
    groups.get(row.groupKey).push(row);
  }
  let gameNum = 0;
  const games = [];
  for (const members of groups.values()) {
    gameNum++;
    const podSize = members.length;
    for (const m of members) {
      games.push({
        date: m.date,
        gameNum,
        placement: m.placement,
        player: m.player,
        deck: m.deck,
        colorIdentity: m.colorIdentity,
        podSize,
      });
    }
  }
  return games;
}

// ------------------------------------------------------------------ stats helpers

const isWin = (g) => g.placement === 1;

/** Base per-player aggregate over a set of games. */
function playerAgg(games) {
  const byPlayer = new Map();
  for (const g of games) {
    if (!g.player) continue;
    if (!byPlayer.has(g.player)) byPlayer.set(g.player, []);
    byPlayer.get(g.player).push(g);
  }
  const out = [];
  for (const [player, gs] of byPlayer) {
    const juegos = gs.length;
    const victorias = gs.filter(isWin).length;
    out.push({
      player,
      player_league: leagueOf(player),
      games: gs,
      juegos,
      victorias,
      win_rate: round(victorias / juegos),
    });
  }
  return out;
}

// ------------------------------------------------------------------ ELO
// Sequential multiplayer ELO: within each game, every pair is scored by
// placement (better placement = win). K-factor 24, base 1500. Games are
// processed in chronological order. "forget about ELO" per owner — this is a
// reasonable, internally-consistent rating, not a reproduction of the old one.
function computeElo(games) {
  const K = 24, BASE = 1500;
  const rating = new Map();
  const get = (p) => (rating.has(p) ? rating.get(p) : BASE);

  const groups = new Map();
  for (const g of games) {
    if (!groups.has(g.gameNum)) groups.set(g.gameNum, []);
    groups.get(g.gameNum).push(g);
  }
  const order = [...groups.keys()].sort((a, b) => {
    const da = groups.get(a)[0].date, db = groups.get(b)[0].date;
    return da === db ? a - b : da.localeCompare(db);
  });

  for (const gn of order) {
    const members = groups.get(gn).filter((m) => m.player);
    const before = new Map(members.map((m) => [m.player, get(m.player)]));
    const delta = new Map(members.map((m) => [m.player, 0]));
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i], b = members[j];
        if (a.placement === b.placement) continue;
        const ra = before.get(a.player), rb = before.get(b.player);
        const ea = 1 / (1 + 10 ** ((rb - ra) / 400));
        const sa = a.placement < b.placement ? 1 : 0; // lower placement number wins
        delta.set(a.player, delta.get(a.player) + K * (sa - ea));
        delta.set(b.player, delta.get(b.player) + K * ((1 - sa) - (1 - ea)));
      }
    }
    // Normalize by opponents faced so big pods don't swing ratings excessively.
    const opp = Math.max(1, members.length - 1);
    for (const m of members) rating.set(m.player, get(m.player) + delta.get(m.player) / opp);
  }
  return rating;
}

// ------------------------------------------------------------------ main build

function build(games, decks) {
  const out = {};
  out["games.json"] = games;
  out["decks.json"] = decks;

  const agg = playerAgg(games);
  // Guests/typos (not in the roster) still count as opponents for ELO, pod size
  // and head-to-head, but only rostered players appear on the leaderboards.
  const rosterAgg = agg.filter((a) => isRostered(a.player));
  const elo = computeElo(games);

  // ---- elo.json (all rostered players, ranked) ----
  out["elo.json"] = rosterAgg
    .map((a) => ({
      player: a.player,
      elo: round(elo.get(a.player) ?? 1500, 1),
      player_league: a.player_league,
      juegos: a.juegos,
      win_rate: a.win_rate,
    }))
    .sort((x, y) => y.elo - x.elo)
    .map((x, i) => ({ ...x, elo_rank: i + 1 }));

  // ---- kingmaker.json (placement distribution, analytics-eligible players) ----
  out["kingmaker.json"] = rosterAgg
    .filter((a) => a.juegos >= MIN_GAMES_ANALYTICS)
    .map((a) => {
      const segundo = a.games.filter((g) => g.placement === 2).length;
      const tercero = a.games.filter((g) => g.placement === 3).length;
      return {
        player: a.player,
        player_league: a.player_league,
        juegos: a.juegos,
        victorias: a.victorias,
        segundo,
        tercero,
        win_rate: a.win_rate,
        seg_rate: round(segundo / a.juegos),
      };
    })
    .sort((x, y) => y.win_rate - x.win_rate);

  // ---- streaks.json (longest win/loss run, chronological) ----
  out["streaks.json"] = rosterAgg
    .filter((a) => a.juegos >= MIN_GAMES_ANALYTICS)
    .map((a) => {
      const chrono = [...a.games].sort((p, q) =>
        p.date === q.date ? p.gameNum - q.gameNum : p.date.localeCompare(q.date)
      );
      let mv = 0, md = 0, cv = 0, cd = 0;
      for (const g of chrono) {
        if (isWin(g)) { cv++; cd = 0; } else { cd++; cv = 0; }
        mv = Math.max(mv, cv); md = Math.max(md, cd);
      }
      return {
        player: a.player, player_league: a.player_league,
        max_victorias: mv, max_derrotas: md, juegos: a.juegos, win_rate: a.win_rate,
      };
    })
    .sort((x, y) => y.max_victorias - x.max_victorias);

  // ---- rankings (per league, min games, ranked by win_rate then avg placement) ----
  const rankingFor = (league) => {
    const list = rosterAgg
      .filter((a) => a.player_league === league && a.juegos >= MIN_GAMES_RANKING)
      .map((a) => {
        const avg_placement = round(
          a.games.reduce((s, g) => s + g.placement, 0) / a.juegos, 2);
        // Normalized: 1.0 = always 1st, 0.0 = always last (uses each game's pod).
        const avg_place_norm = round(
          a.games.reduce((s, g) => {
            const denom = Math.max(1, g.podSize - 1);
            return s + (g.podSize - g.placement) / denom;
          }, 0) / a.juegos, 3);
        const mazos_distintos = new Set(a.games.map((g) => g.deck).filter(Boolean)).size;
        return {
          player: a.player, player_league: a.player_league,
          juegos: a.juegos, victorias: a.victorias, win_rate: a.win_rate,
          avg_placement, avg_place_norm, mazos_distintos,
        };
      })
      .sort((x, y) => y.win_rate - x.win_rate || x.avg_placement - y.avg_placement)
      .map((x, i) => ({ rank: i + 1, ...x }));
    return list;
  };
  out["ranking_rd.json"] = rankingFor("RD");
  out["ranking_mx.json"] = rankingFor("MX");

  // ---- monthly aggregates ----
  const monthKey = (g) => (g.date ? g.date.slice(0, 7) : "");
  const monthAgg = new Map(); // `${ym}|${player}` -> {juegos, victorias}
  for (const g of games) {
    if (!g.player || !g.date || !isRostered(g.player)) continue;
    const key = `${monthKey(g)}|${g.player}`;
    if (!monthAgg.has(key)) monthAgg.set(key, { juegos: 0, victorias: 0 });
    const m = monthAgg.get(key);
    m.juegos++; if (isWin(g)) m.victorias++;
  }
  const monthlyRows = [...monthAgg.entries()].map(([key, m]) => {
    const [year_month, player] = key.split("|");
    return {
      year_month, player, player_league: leagueOf(player),
      juegos: m.juegos, victorias: m.victorias, win_rate: round(m.victorias / m.juegos),
    };
  });
  const byMonthSort = (a, b) =>
    a.year_month.localeCompare(b.year_month) || b.win_rate - a.win_rate;

  out["monthly_rd.json"] = monthlyRows
    .filter((r) => r.player_league === "RD")
    .map(({ year_month, player, juegos, victorias, win_rate }) =>
      ({ year_month, player, juegos, victorias, win_rate }))
    .sort(byMonthSort);
  out["monthly_mx.json"] = monthlyRows
    .filter((r) => r.player_league === "MX")
    .map(({ year_month, player, juegos, victorias, win_rate }) =>
      ({ year_month, player, juegos, victorias, win_rate }))
    .sort(byMonthSort);

  const months = [...new Set(monthlyRows.map((r) => r.year_month))].sort();
  const monthIndex = new Map(months.map((m, i) => [m, i + 1]));
  out["monthly_wr.json"] = monthlyRows
    .map((r) => ({ ...r, month_n: monthIndex.get(r.year_month) }))
    .sort((a, b) => a.player.localeCompare(b.player) || a.year_month.localeCompare(b.year_month));

  // ---- mvp.json (best player each month by wins, min games) ----
  out["mvp.json"] = months
    .map((ym) => {
      const cands = monthlyRows
        .filter((r) => r.year_month === ym && r.juegos >= MIN_GAMES_MONTH_MVP)
        .sort((a, b) => b.victorias - a.victorias || b.win_rate - a.win_rate);
      return cands[0] || null;
    })
    .filter(Boolean)
    .map(({ year_month, player, player_league, juegos, victorias, win_rate }) =>
      ({ year_month, player, player_league, juegos, victorias, win_rate }));

  // ---- tendencia.json (linear trend of monthly win rate) ----
  out["tendencia.json"] = rosterAgg
    .filter((a) => a.juegos >= MIN_GAMES_ANALYTICS)
    .map((a) => {
      const rows = monthlyRows
        .filter((r) => r.player === a.player)
        .sort((x, y) => x.year_month.localeCompare(y.year_month));
      const meses = rows.length;
      const ys = rows.map((r) => r.win_rate);
      const xs = rows.map((_, i) => i);
      let slope = 0;
      if (meses >= 2) {
        const mx = xs.reduce((s, v) => s + v, 0) / meses;
        const my = ys.reduce((s, v) => s + v, 0) / meses;
        const num = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0);
        const den = xs.reduce((s, v) => s + (v - mx) ** 2, 0);
        slope = den ? num / den : 0;
      }
      const wr_inicial = ys.length ? ys[0] : 0;
      const wr_final = ys.length ? ys[ys.length - 1] : 0;
      const tendencia = slope > 0.01 ? "subiendo" : slope < -0.01 ? "bajando" : "estable";
      return {
        player: a.player, player_league: a.player_league, meses,
        slope: round(slope, 4), wr_inicial, wr_final, tendencia,
      };
    })
    .sort((x, y) => y.slope - x.slope);

  // ---- head-to-head (players who shared a game; better placement = win) ----
  const gamesByNum = new Map();
  for (const g of games) {
    if (!g.player) continue;
    if (!gamesByNum.has(g.gameNum)) gamesByNum.set(g.gameNum, []);
    gamesByNum.get(g.gameNum).push(g);
  }
  const pairStats = new Map(); // "A|B" (sorted) -> {games, aWins, bWins}
  const dirStats = new Map();  // "A>B" -> {games, wins}
  for (const members of gamesByNum.values()) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i], b = members[j];
        if (a.player === b.player) continue;
        const [p1, p2] = [a.player, b.player].sort();
        const key = `${p1}|${p2}`;
        if (!pairStats.has(key)) pairStats.set(key, { games: 0, p1Wins: 0, p2Wins: 0 });
        const ps = pairStats.get(key);
        ps.games++;
        if (a.placement !== b.placement) {
          const aBetter = a.placement < b.placement;
          const winner = aBetter ? a.player : b.player;
          if (winner === p1) ps.p1Wins++; else ps.p2Wins++;
          for (const [x, y] of [[a.player, b.player], [b.player, a.player]]) {
            const dk = `${x}>${y}`;
            if (!dirStats.has(dk)) dirStats.set(dk, { games: 0, wins: 0 });
          }
          dirStats.get(`${a.player}>${b.player}`).wins += aBetter ? 1 : 0;
          dirStats.get(`${b.player}>${a.player}`).wins += aBetter ? 0 : 1;
        }
        for (const [x, y] of [[a.player, b.player], [b.player, a.player]]) {
          const dk = `${x}>${y}`;
          if (!dirStats.has(dk)) dirStats.set(dk, { games: 0, wins: 0 });
          dirStats.get(dk).games++;
        }
      }
    }
  }
  out["h2h.json"] = [...pairStats.entries()]
    .filter(([key, s]) => {
      const [p1, p2] = key.split("|");
      return s.games >= MIN_GAMES_H2H && isRostered(p1) && isRostered(p2);
    })
    .map(([key, s]) => {
      const [p1, p2] = key.split("|");
      return { p1, p2, games: s.games, p1_wins: s.p1Wins, p2_wins: s.p2Wins,
        p1_wr: round(s.p1Wins / s.games) };
    })
    .sort((a, b) => b.games - a.games);

  out["h2h_matrix.json"] = [...dirStats.entries()]
    .filter(([key, s]) => {
      const [from, to] = key.split(">");
      return s.games >= MIN_GAMES_H2H && isRostered(from) && isRostered(to);
    })
    .map(([key, s]) => {
      const [from, to] = key.split(">");
      return { from, to, wr: round(s.wins / s.games), games: s.games };
    })
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  // ---- deck_danger.json (deck wins weighted by opponent strength) ----
  const eloAvg = [...elo.values()].reduce((s, v) => s + v, 0) / Math.max(1, elo.size);
  const deckStat = new Map(); // "deck|player" -> {victorias, oppEloSum, wins}
  for (const members of gamesByNum.values()) {
    for (const m of members) {
      if (!m.player || !m.deck) continue;
      if (!isWin(m)) continue;
      const opps = members.filter((o) => o.player && o.player !== m.player);
      const oppElo = opps.length
        ? opps.reduce((s, o) => s + (elo.get(o.player) ?? eloAvg), 0) / opps.length
        : eloAvg;
      const key = `${m.deck}|${m.player}`;
      if (!deckStat.has(key)) deckStat.set(key, { victorias: 0, oppEloSum: 0 });
      const d = deckStat.get(key);
      d.victorias++; d.oppEloSum += oppElo;
    }
  }
  out["deck_danger.json"] = [...deckStat.entries()]
    .map(([key, d]) => {
      const [deck_name, player] = key.split("|");
      const avg_opp_elo = round(d.oppEloSum / d.victorias, 1);
      // Danger = wins scaled by how strong the beaten field was, relative to base.
      const danger_score = round(d.victorias * (avg_opp_elo / 1500), 2);
      return { deck_name, player, player_league: leagueOf(player),
        victorias: d.victorias, avg_opp_elo, danger_score };
    })
    .filter((d) => d.victorias >= 2 && isRostered(d.player))
    .sort((a, b) => b.danger_score - a.danger_score);

  return out;
}

// ------------------------------------------------------------------ run

async function main() {
  console.log(`▶ Fetching sheet ${SHEET_ID} …`);
  const [gameRows, deckRows] = await Promise.all([
    fetchTab("Game Log"),
    fetchTab("Deck List"),
  ]);

  const { decks, colorByDeck } = parseDeckList(deckRows);
  const games = parseGameLog(gameRows, colorByDeck);
  console.log(`  parsed ${games.length} game rows, ${decks.length} decks`);

  // ---- resolve every deck name to its real card (official name, art, colors)
  const allDeckNames = [...new Set([
    ...decks.map((d) => d.name),
    ...games.map((g) => g.deck).filter(Boolean),
  ])].sort();
  const sheetColors = new Map(decks.map((d) => [d.name, d.colorIdentity]));
  console.log(`  resolving ${allDeckNames.length} deck names via Scryfall …`);
  const cards = await resolveCards(allDeckNames, sheetColors);
  const resolvedCount = [...cards.values()].filter(Boolean).length;
  console.log(`  resolved ${resolvedCount}/${allDeckNames.length} to real cards`);

  // Enrich decks with card data; card colors override sheet colors when found.
  for (const d of decks) {
    const c = cards.get(d.name);
    d.cardName = c?.card ?? null;
    d.art = c?.art ?? null;
    d.image = c?.image ?? null;
    if (c?.colors) d.colorIdentity = c.colors;
  }
  // Game rows inherit resolved colors too.
  for (const g of games) {
    const c = cards.get(g.deck);
    if (c?.colors) g.colorIdentity = c.colors;
  }

  const outputs = build(games, decks);

  // cards.json: deckName -> card lookup for the whole app (art, official name).
  outputs["cards.json"] = Object.fromEntries(
    [...cards.entries()].map(([name, c]) => [name, c ?? null]));

  await mkdir(DATA_DIR, { recursive: true });
  for (const [file, data] of Object.entries(outputs)) {
    await writeFile(join(DATA_DIR, file), JSON.stringify(data, null, 2) + "\n", "utf8");
    const n = Array.isArray(data) ? data.length : Object.keys(data).length;
    console.log(`  wrote ${file.padEnd(20)} (${n} rows)`);
  }

  if (unknownPlayers.size) {
    console.warn(`\n⚠ Players not in leagues.json (assigned "${leaguesCfg.defaultLeague}"): ` +
      [...unknownPlayers].join(", "));
    console.warn("  Add them to scripts/config/leagues.json to classify them.");
  }
  console.log("\n✓ Done.");
}

main().catch((e) => { console.error("✗ Build failed:", e); process.exit(1); });
