import type {
  GameEntry, DeckInfo, EloEntry, MonthlyEntry, MvpEntry, CardMap,
  StreakEntry, RankingEntry, H2hEntry, TendenciaEntry, DeckDangerEntry, H2hMatrixEntry, KingmakerEntry
} from "./types";

const cache: Record<string, unknown[] | null> = {};

async function loadJson<T>(path: string): Promise<T[]> {
  if (cache[path] !== undefined) return cache[path] as T[];
  const res = await fetch(path, { cache: "no-store" });
  cache[path] = await res.json();
  return cache[path] as T[];
}

export const getGames      = () => loadJson<GameEntry>       ("/data/games.json");
export const getDecks      = () => loadJson<DeckInfo>        ("/data/decks.json");
export const getElo        = () => loadJson<EloEntry>        ("/data/elo.json");
export const getMonthlyRD  = () => loadJson<MonthlyEntry>    ("/data/monthly_rd.json");
export const getMonthlyMX  = () => loadJson<MonthlyEntry>    ("/data/monthly_mx.json");
export const getMonthlyWr  = () => loadJson<MonthlyEntry>    ("/data/monthly_wr.json");
export const getMvp        = () => loadJson<MvpEntry>        ("/data/mvp.json");
export const getStreaks     = () => loadJson<StreakEntry>     ("/data/streaks.json");
export const getRankingRD  = () => loadJson<RankingEntry>    ("/data/ranking_rd.json");
export const getRankingMX  = () => loadJson<RankingEntry>    ("/data/ranking_mx.json");
export const getH2h        = () => loadJson<H2hEntry>        ("/data/h2h.json");
export const getTendencia  = () => loadJson<TendenciaEntry>  ("/data/tendencia.json");
export const getDeckDanger = () => loadJson<DeckDangerEntry> ("/data/deck_danger.json");
export const getH2hMatrix  = () => loadJson<H2hMatrixEntry>  ("/data/h2h_matrix.json");
export const getH2hPairs   = () => loadJson<H2hEntry>        ("/data/h2h.json");
export const getKingmaker  = () => loadJson<KingmakerEntry>  ("/data/kingmaker.json");

// cards.json is an object map, not an array — cached separately.
let cardsCache: CardMap | null = null;
export async function getCards(): Promise<CardMap> {
  if (cardsCache) return cardsCache;
  const res = await fetch("/data/cards.json", { cache: "no-store" });
  cardsCache = await res.json();
  return cardsCache!;
}
