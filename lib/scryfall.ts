import { stripOwnerSuffix } from "./stats";
import { getCards } from "./data";

/**
 * Card art lookup.
 * Every known deck is resolved at build time into /data/cards.json (official
 * name, art, image, colors) — see scripts/resolve-cards.mjs. At runtime we just
 * read that map. Names not in the map (e.g. a brand-new deck typed into the
 * search) fall back to a live Scryfall fuzzy lookup.
 */

const runtimeCache = new Map<string, string | null>();

export async function fetchCardArt(deckName: string): Promise<string | null> {
  if (!deckName) return null;
  const cards = await getCards().catch(() => null);
  const hit = cards?.[deckName];
  if (hit !== undefined) return hit?.art ?? null;

  // Unknown deck -> live fuzzy lookup (cached per session).
  if (runtimeCache.has(deckName)) return runtimeCache.get(deckName)!;
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(stripOwnerSuffix(deckName))}`);
    if (!res.ok) { runtimeCache.set(deckName, null); return null; }
    const card = await res.json();
    const art = card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? null;
    runtimeCache.set(deckName, art);
    return art;
  } catch {
    runtimeCache.set(deckName, null);
    return null;
  }
}

/** Official card name for a deck (null if custom/unresolved). */
export async function officialName(deckName: string): Promise<string | null> {
  const cards = await getCards().catch(() => null);
  return cards?.[deckName]?.card ?? null;
}

/** Live commander search against Scryfall (for the deck search bar). */
export interface ScryfallHit { name: string; art: string | null; colors: string }
export async function searchCommanders(query: string): Promise<ScryfallHit[]> {
  if (query.trim().length < 3) return [];
  try {
    const q = encodeURIComponent(`${query} is:commander`);
    const res = await fetch(`https://api.scryfall.com/cards/search?q=${q}&order=edhrec&unique=cards`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).slice(0, 8).map((c: {
      name: string;
      color_identity?: string[];
      image_uris?: { art_crop?: string };
      card_faces?: { image_uris?: { art_crop?: string } }[];
    }) => ({
      name: c.name,
      art: c.image_uris?.art_crop ?? c.card_faces?.[0]?.image_uris?.art_crop ?? null,
      colors: (c.color_identity ?? []).join(""),
    }));
  } catch {
    return [];
  }
}
