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
}

export interface PlayerStats {
  name: string;
  games: number;
  wins: number;
  winRate: number;
  avgPlacement: number;
  favDeck: string;
  favDeckGames: number;
  mostWinsAsDeck: string;
  mostWinsCount: number;
  favColorIdentity: string;
  placementBreakdown: Record<number, number>;
  decksPlayed: { deck: string; games: number; wins: number; winRate: number }[];
}

export interface DeckStats {
  name: string;
  owner: string;
  colorIdentity: string;
  games: number;
  wins: number;
  winRate: number;
  avgPlacement: number;
  history: { date: string; gameNum: number; placement: number; player: string; podSize: number }[];
  players: string[];
}
