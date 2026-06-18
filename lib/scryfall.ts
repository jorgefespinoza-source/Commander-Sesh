import { stripOwnerSuffix } from "./stats";

const cache = new Map<string, string | null>();

const OVERRIDES: Record<string, string> = {
  // suffixed owner variants
  "Teval (N)": "Teval, the Balanced Scale",
  "Teval (J)": "Teval, the Balanced Scale",
  "Teval (M)": "Teval, the Balanced Scale",
  "Zinnia (W)": "Zinnia, Valley's Voice",
  "Zinnia (M)": "Zinnia, Valley's Voice",
  "Zinnia (G)": "Zinnia, Valley's Voice",
  "Eshki (M)": "Eshki the Pilgrim",
  "Eshki (S)": "Eshki the Pilgrim",
  "Bello (O)": "Bello, Bard of the Brambles",
  "Bello (J)": "Bello, Bard of the Brambles",
  "Bello (i)": "Bello, Bard of the Brambles",
  "Bello (G)": "Bello, Bard of the Brambles",
  "Frodo and Sam (L)": "Frodo, Determined Halfling",
  "Frodo and Sam (M)": "Frodo, Determined Halfling",
  "Zurgo (L)": "Zurgo Helmsmasher",
  "Zurgo (S)": "Zurgo Helmsmasher",
  "Shiko and Narset": "Narset, Enlightened Master",
  "Dihada (H)": "Dihada, Binder of Wills",
  "Hazel (N)": "Hazel of the Rootbloom",
  "Hazel (i)": "Hazel of the Rootbloom",
  "Hazel (G)": "Hazel of the Rootbloom",
  "Felothar (i)": "Felothar, Unity's Flame",
  "Felothar (O)": "Felothar, Unity's Flame",
  "Valgavoth (O)": "Valgavoth, Terror Eater",
  "Valgavoth (J)": "Valgavoth, Terror Eater",
  "Valgavoth (M)": "Valgavoth, Terror Eater",
  "Pantlaza": "Pantlaza, Sun-Favored",
  "Shalai and Hallar": "Shalai and Hallar, Equals",
  "Alela, Cunning Conqueror (S)": "Alela, Cunning Conqueror",
  "Alela, Cunning Conqueror (i)": "Alela, Cunning Conqueror",
  "Alela, Artful Provocateur": "Alela, Artful Provocateur",
  "Ms. Bumbleflower (C)": "Myra the Magnificent",
  "Ms. Bumbleflower (G)": "Myra the Magnificent",
  "Ms. Bumbleflower (L)": "Myra the Magnificent",
  "Rin and Seri (D)": "Rin and Seri, Inseparable",
  "Rin and Seri (C)": "Rin and Seri, Inseparable",
  "Rin and Seri (L)": "Rin and Seri, Inseparable",
  "Ashling": "Ashling the Pilgrim",
  "Emmara (J)": "Emmara, Soul of the Accord",
  "Emmara (H)": "Emmara, Soul of the Accord",
  "Breya (H)": "Breya, Etherium Shaper",
  "Breya (M)": "Breya, Etherium Shaper",
  "Ulalek (H)": "Ulalek, Fused Atrocity",
  "Ulalek (J)": "Ulalek, Fused Atrocity",
  "Ureni (M)": "Ureni, the Spiritwalker",
  "Ureni (S)": "Ureni, the Spiritwalker",
  "Goro-Goro": "Goro-Goro, Disciple of Ryusei",
  "Auntie Ool (S)": "Auntie Ool, Swamp Hag",
  "Auntie Ool (M)": "Auntie Ool, Swamp Hag",
  "Obeka ": "Obeka, Splitter of Seconds",
  "Tifa Lockhart": "Tifa Lockhart",
  "Jared Carthalion": "Jared Carthalion, True Heir",
  "Admiral Brass (O)": "Admiral Brass, Unsinkable",
  "Admiral Brass (J)": "Admiral Brass, Unsinkable",
  "Admiral Brass (M)": "Admiral Brass, Unsinkable",
  "Betor, Ancestor's Voice": "Betor, Ancestor's Voice",
  "Omnath, Locus of Rage": "Omnath, Locus of Rage",
  "Hearthhull (W)": "Worldseed Sower",
  "Hearthhull (L)": "Worldseed Sower",
  "Hearthhull (J)": "Worldseed Sower",
  "Sokka, Tenacious Tactician (i)": "Sokka, Wandering Warrior",
  "Sokka, Tenacious Tactician (N)": "Sokka, Wandering Warrior",
  "Malcom & Breeches": "Malcolm, Keen-Eyed Navigator",
  "The Second Doctor": "The Second Doctor",
  "Reaper, King No More (M)": "Reaper, King No More",
  // bare names that need disambiguation or typo fixes
  "Gary": "Gray Merchant of Asphodel",
  "Asusa": "Azusa, Lost but Seeking",
  "Ur Dragon": "The Ur-Dragon",
  "Cloud": "Cloud, ex-SOLDIER",
  "Falco": "Falco Spara, Pactweaver",
  "Saheeli": "Saheeli, the Gifted",
  "Kumena": "Kumena, Tyrant of Orazca",
  "Azami": "Azami, Lady of Scrolls",
  "Rionya": "Rionya, Fire Dancer",
  "Wick": "Wick, the Whorled Mind",
  "Smeagol": "Sméagol, Helpful Guide",
  "Eowyn": "Éowyn, Fearless Knight",
  "Cirdan": "Círdan the Shipwright",
  // Final Fantasy Universes Beyond cards
  "Kefka": "Kefka, the Laughing Mage",
  "Terra": "Terra, Esper Mage",
  "Tidus": "Tidus, Flamboyant Dreamer",
  "Yuna": "Yuna, Resolute Summoner",
  "Celes": "Celes, the Liberator",
};

const CUSTOM_CARDS = new Set([
  // truly custom / proxy cards with no Scryfall equivalent
  "Iroh Grand Lotus", "Avatar Aang",
  "Fire Lord Azula (i)", "Fire Lord Azula (H)", "Fire Lord Azula",
  "Cristiano Ronaldo, The Goat",
  "Norman Osborn",
  "Makima",
  "Capitan America", "Captain America, Team Leader",
  "Kotis",
  "Don Andrés",
  "Blech",
  "Ragost",
  "Kuja",
  "Witherbloom, The Balancer",
  "Jorge Kourie", "Arturo", "Samuel",
  // ambiguous / nickname-only customs
  "Gorma", "Aziza", "Aragorn, El Negro",
  "Infinite Guideline Station",
  "Inspirit", "Karduur Doomscourge",
  "Kilo", "The Council", "The Lord of Pain",
  "Plankton", "Zangief",
  "Neriv", "Cels",
]);

export async function fetchCardArt(deckName: string): Promise<string | null> {
  if (cache.has(deckName)) return cache.get(deckName)!;

  const baseName = OVERRIDES[deckName] ?? stripOwnerSuffix(deckName);

  if (CUSTOM_CARDS.has(deckName) || CUSTOM_CARDS.has(baseName)) {
    cache.set(deckName, null);
    return null;
  }

  try {
    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(baseName)}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) { cache.set(deckName, null); return null; }
    const card = await res.json();
    const art =
      card.image_uris?.art_crop ??
      card.card_faces?.[0]?.image_uris?.art_crop ??
      null;
    cache.set(deckName, art);
    return art;
  } catch {
    cache.set(deckName, null);
    return null;
  }
}
