import type { GameEntry, DeckInfo } from "./types";

let _games: GameEntry[] | null = null;
let _decks: DeckInfo[] | null = null;

export async function getGames(): Promise<GameEntry[]> {
  if (_games) return _games;
  const res = await fetch("/data/games.json", { cache: "no-store" });
  _games = await res.json();
  return _games!;
}

export async function getDecks(): Promise<DeckInfo[]> {
  if (_decks) return _decks;
  const res = await fetch("/data/decks.json", { cache: "no-store" });
  _decks = await res.json();
  return _decks!;
}
