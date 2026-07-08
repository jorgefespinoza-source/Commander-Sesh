import type { GameEntry, DeckInfo, PlayerStats, DeckStats } from "./types";

/** Commander scoring: 1st=3pts, 2nd=1pt, 3rd+=0pts */
export function cmdPoints(placement: number): number {
  if (placement === 1) return 3;
  if (placement === 2) return 1;
  return 0;
}

export function filterBySeason(games: GameEntry[], season: number | null): GameEntry[] {
  if (!season) return games;
  return games.filter(g => g.date.startsWith(String(season)));
}

export function getSeasons(games: GameEntry[]): number[] {
  const years = new Set(games.map(g => parseInt(g.date.slice(0, 4))).filter(y => !isNaN(y)));
  return Array.from(years).sort((a, b) => b - a);
}

export function getPlayers(games: GameEntry[]): string[] {
  return Array.from(new Set(games.map(g => g.player))).sort();
}

/** Top-3 individual mana colors by game count across all commanders played */
function calcTop3Colors(playerGames: GameEntry[]): string {
  const count: Record<string, number> = {};
  for (const g of playerGames) {
    if (g.colorIdentity && g.colorIdentity !== "?") {
      for (const c of g.colorIdentity.toUpperCase()) {
        if ("WUBRG".includes(c)) count[c] = (count[c] ?? 0) + 1;
      }
    }
  }
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c)
    .join("");
}

export function getPlayerStats(player: string, games: GameEntry[]): PlayerStats {
  const pg = games.filter(g => g.player === player);
  const wins = pg.filter(g => g.placement === 1);

  const deckCount: Record<string, number> = {};
  const deckWins: Record<string, number> = {};
  for (const g of pg) {
    deckCount[g.deck] = (deckCount[g.deck] ?? 0) + 1;
    if (g.placement === 1) deckWins[g.deck] = (deckWins[g.deck] ?? 0) + 1;
  }
  const favDeck = Object.entries(deckCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const mostWinsEntry = Object.entries(deckWins).sort((a, b) => b[1] - a[1])[0];

  const ciCount: Record<string, number> = {};
  for (const g of pg) {
    if (g.colorIdentity && g.colorIdentity !== "?") {
      ciCount[g.colorIdentity] = (ciCount[g.colorIdentity] ?? 0) + 1;
    }
  }
  const favColorIdentity = Object.entries(ciCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const placementBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let totalScore = 0;
  for (const g of pg) {
    placementBreakdown[g.placement] = (placementBreakdown[g.placement] ?? 0) + 1;
    totalScore += cmdPoints(g.placement);
  }

  const decksPlayed = Object.entries(deckCount).map(([deck, gamesPlayed]) => ({
    deck,
    games: gamesPlayed,
    wins: deckWins[deck] ?? 0,
    winRate: gamesPlayed > 0 ? (deckWins[deck] ?? 0) / gamesPlayed : 0,
  })).sort((a, b) => b.games - a.games);

  // prevDecks: all decks played by this player, sorted by frequency
  const prevDecks = decksPlayed.map(d => d.deck);

  return {
    name: player,
    games: pg.length,
    wins: wins.length,
    winRate: pg.length > 0 ? wins.length / pg.length : 0,
    avgPlacement: pg.length > 0 ? pg.reduce((s, g) => s + g.placement, 0) / pg.length : 0,
    cmdScore: pg.length > 0 ? totalScore / pg.length : 0,
    top3Colors: calcTop3Colors(pg),
    favDeck,
    favDeckGames: deckCount[favDeck] ?? 0,
    mostWinsAsDeck: mostWinsEntry?.[0] ?? "",
    mostWinsCount: mostWinsEntry?.[1] ?? 0,
    favColorIdentity,
    placementBreakdown,
    decksPlayed,
    prevDecks,
  };
}

export function getAllPlayerStats(games: GameEntry[]): PlayerStats[] {
  const players = getPlayers(games);
  return players
    .map(p => getPlayerStats(p, games))
    .filter(p => p.games >= 3)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
}

export function getDeckStats(deckName: string, games: GameEntry[], deckInfo?: DeckInfo): DeckStats {
  const dg = games.filter(g => g.deck === deckName);
  const wins = dg.filter(g => g.placement === 1);
  const players = Array.from(new Set(dg.map(g => g.player)));

  return {
    name: deckName,
    owner: deckInfo?.owner ?? "",
    cardName: deckInfo?.cardName ?? null,
    colorIdentity: deckInfo?.colorIdentity ?? dg[0]?.colorIdentity ?? "",
    games: dg.length,
    wins: wins.length,
    winRate: dg.length > 0 ? wins.length / dg.length : 0,
    avgPlacement: dg.length > 0 ? dg.reduce((s, g) => s + g.placement, 0) / dg.length : 0,
    history: dg.map(g => ({
      date: g.date, gameNum: g.gameNum, placement: g.placement, player: g.player, podSize: g.podSize,
    })).sort((a, b) => a.date.localeCompare(b.date)),
    players,
  };
}

export function getAllDeckStats(games: GameEntry[], decks: DeckInfo[]): DeckStats[] {
  const deckInfoMap = new Map(decks.map(d => [d.name, d]));
  const deckNames = Array.from(new Set(games.map(g => g.deck))).filter(Boolean);
  return deckNames
    .map(name => getDeckStats(name, games, deckInfoMap.get(name)))
    .filter(d => d.games >= 2)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games);
}

export function fmt(rate: number): string {
  return (rate * 100).toFixed(1) + "%";
}

export function fmtScore(score: number): string {
  return score.toFixed(2) + "pts";
}

export function stripOwnerSuffix(deckName: string): string {
  return deckName.replace(/\s*\([A-Za-z]\)$/, "").trim();
}

export function ciToLabel(ci: string): string {
  const map: Record<string, string> = {
    W: "Mono White", U: "Mono Blue", B: "Mono Black", R: "Mono Red", G: "Mono Green",
    WU: "Azorius", WB: "Orzhov", WR: "Boros", WG: "Selesnya",
    UB: "Dimir", UR: "Izzet", UG: "Simic",
    BR: "Rakdos", BG: "Golgari", RG: "Gruul",
    WUB: "Esper", WUR: "Jeskai", WUG: "Bant",
    WBR: "Mardu", WBG: "Abzan", WRG: "Naya",
    UBR: "Grixis", UBG: "Sultai", URG: "Temur",
    BRG: "Jund",
    WUBR: "Non-Green", WUBG: "Non-Red", WURG: "Non-Black", WBRG: "Non-Blue", UBRG: "Non-White",
    WUBRG: "Five Color",
  };
  return map[ci?.toUpperCase()] ?? ci ?? "Unknown";
}
