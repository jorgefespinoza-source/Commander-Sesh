export interface GameEntry {
  date: string;
  gameNum: number;
  placement: number;
  player: string;
  deck: string;
  colorIdentity: string;
  podSize: number;
}

export interface DeckInfo {
  name: string;
  owner: string;
  colorIdentity: string;
  cardName?: string | null;  // official Scryfall card name (null = custom/proxy)
  art?: string | null;       // art_crop URL
  image?: string | null;     // full card image URL
}

/** Resolved card lookup: deck name -> card data (null = custom/unresolved). */
export interface CardInfo {
  card: string;
  art: string | null;
  image: string | null;
  colors: string;
  type?: string | null;         // type line, e.g. "Legendary Creature — Elf Druid"
  mana?: string | null;         // mana cost, e.g. "{2}{B}{G}"
  set?: string | null;          // set name of the default printing
  edhrecRank?: number | null;   // EDHREC popularity rank (1 = most played)
  priceUsd?: string | null;     // Scryfall USD price
  scryfallUri?: string | null;
  edhrecUri?: string | null;
}
export type CardMap = Record<string, CardInfo | null>;

export interface PlayerStats {
  name: string;
  games: number;
  wins: number;
  winRate: number;
  avgPlacement: number;
  cmdScore: number;       // commander points per game (1st=3, 2nd=1, else 0)
  top3Colors: string;     // e.g. "WUG" — top 3 individual colors by game count
  favDeck: string;
  favDeckGames: number;
  mostWinsAsDeck: string;
  mostWinsCount: number;
  favColorIdentity: string;
  placementBreakdown: Record<number, number>;
  decksPlayed: { deck: string; games: number; wins: number; winRate: number }[];
  prevDecks: string[];    // sorted by frequency, most recent first
}

export interface DeckStats {
  name: string;
  owner: string;
  colorIdentity: string;
  cardName?: string | null;   // official card name from Scryfall
  games: number;
  wins: number;
  winRate: number;
  avgPlacement: number;
  history: { date: string; gameNum: number; placement: number; player: string; podSize: number }[];
  players: string[];
}

export interface EloEntry {
  player: string;
  elo: number;
  player_league: string;
  juegos: number;
  win_rate: number;
  elo_rank: number;
}

export interface MonthlyEntry {
  year_month: string;
  player: string;
  juegos: number;
  victorias: number;
  win_rate: number;
  player_league?: string;
  month_n?: number;
}

export interface MvpEntry {
  year_month: string;
  player: string;
  player_league: string;
  juegos: number;
  victorias: number;
  win_rate: number;
}

export interface KingmakerEntry {
  player: string;
  player_league: string;
  juegos: number;
  victorias: number;
  segundo: number;
  tercero: number;
  win_rate: number;
  seg_rate: number;
}

export interface StreakEntry {
  player: string;
  player_league: string;
  max_victorias: number;
  max_derrotas: number;
  juegos: number;
  win_rate: number;
}

export interface RankingEntry {
  player: string;
  player_league: string;
  juegos: number;
  victorias: number;
  win_rate: number;
  avg_placement: number;
  avg_place_norm: number;
  mazos_distintos: number;
  rank: number;
}

export interface H2hEntry {
  p1: string;
  p2: string;
  games: number;
  p1_wins: number;
  p2_wins: number;
  p1_wr: number;
}

export interface TendenciaEntry {
  player: string;
  player_league: string;
  meses: number;
  slope: number;
  wr_inicial: number;
  wr_final: number;
  tendencia: string;
}

export interface DeckDangerEntry {
  deck_name: string;
  player: string;
  player_league: string;
  victorias: number;
  avg_opp_elo: number;
  danger_score: number;
}

export interface H2hMatrixEntry {
  from: string;
  to: string;
  wr: number;
  games: number;
}
