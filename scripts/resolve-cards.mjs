/**
 * Commander -> Scryfall card resolution (used by build-data.mjs).
 * ------------------------------------------------------------------
 * For every deck name in the pod's data, find the real Magic card so the app
 * can show official names, art, and true color identity.
 *
 * Strategy per deck name (owner suffix like "(J)" stripped first):
 *   1. If listed in card-overrides.json `custom` -> it's a proxy/homebrew, skip.
 *   2. Gather candidates: Scryfall fuzzy search on the raw name, plus the
 *      override target if one is configured.
 *   3. Prefer the candidate whose color identity matches the sheet's Deck List
 *      colors for that deck (pod data beats fuzzy guessing); otherwise prefer
 *      the override, then the fuzzy hit.
 *   4. Results are cached in scripts/config/scryfall-cache.json (committed) so
 *      rebuilds and CI runs don't re-hit Scryfall.
 *
 * Returns Map<deckName, {card, art, image, colors} | null>.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, "config", "scryfall-cache.json");
const OVERRIDES_PATH = join(__dirname, "config", "card-overrides.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripOwner = (name) => name.replace(/\s*\([A-Za-z]\)$/, "").trim();

/** EDHREC commander page URL from an official card name (front face for DFCs). */
function edhrecCommanderUrl(cardName) {
  const front = cardName.split("//")[0].trim();
  const slug = front
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // drop accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return slug ? `https://edhrec.com/commanders/${slug}` : null;
}

async function loadJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

/**
 * One Scryfall fuzzy lookup -> slim card record or null. Cached by query.
 * Only a definitive 404 ("no card matches") is cached as a miss; rate limits
 * and network errors are retried with backoff and never poison the cache.
 */
async function fuzzyLookup(query, cache) {
  const key = `q:${query.toLowerCase()}`;
  if (key in cache) return cache[key];

  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(250);
    let res;
    try {
      res = await fetch(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}`,
        { headers: { "User-Agent": "commander-sesh/1.0", Accept: "application/json" } });
    } catch { continue; } // transient network error -> retry
    if (res.status === 429 || res.status >= 500) {
      const wait = res.status === 429 ? 65000 : 3000 * (attempt + 1);
      console.warn(`    Scryfall ${res.status} on "${query}" — waiting ${wait / 1000}s…`);
      await sleep(wait);
      continue;
    }
    if (res.status === 404) { cache[key] = null; return null; } // genuine miss
    if (!res.ok) return null; // unexpected -> unresolved, not cached
    const c = await res.json();
    const img = c.image_uris ?? c.card_faces?.[0]?.image_uris ?? {};
    const front = c.card_faces?.[0] ?? c;
    const result = {
      card: c.name,
      art: img.art_crop ?? null,
      image: img.normal ?? null,
      colors: (c.color_identity ?? []).join(""),
      // premium extras for the app
      type: front.type_line ?? c.type_line ?? null,
      mana: front.mana_cost ?? c.mana_cost ?? null,
      set: c.set_name ?? null,
      edhrecRank: c.edhrec_rank ?? null,            // popularity: 1 = most played card on EDHREC
      priceUsd: c.prices?.usd ?? c.prices?.usd_foil ?? null,
      scryfallUri: c.scryfall_uri ?? null,
      edhrecUri: edhrecCommanderUrl(c.name),
    };
    cache[key] = result;
    return result;
  }
  return null; // gave up this run; next build will retry
}

/** Order candidate colors as WUBRG for comparison with sheet colors. */
const canonColors = (s) =>
  ["W", "U", "B", "R", "G"].filter((c) => (s ?? "").toUpperCase().includes(c)).join("");

export async function resolveCards(deckNames, sheetColors) {
  const cfg = await loadJson(OVERRIDES_PATH, { overrides: {}, custom: [] });
  const cache = await loadJson(CACHE_PATH, {});
  const customSet = new Set(cfg.custom.map((n) => n.toLowerCase()));
  const overrides = Object.fromEntries(
    Object.entries(cfg.overrides).map(([k, v]) => [k.toLowerCase(), v]));

  const out = new Map();
  const unresolved = [];

  for (const name of deckNames) {
    const base = stripOwner(name);
    const baseLc = base.toLowerCase();
    if (customSet.has(name.toLowerCase()) || customSet.has(baseLc)) {
      out.set(name, null);
      continue;
    }

    const overrideName = overrides[name.toLowerCase()] ?? overrides[baseLc];
    const [fuzzy, over] = [
      await fuzzyLookup(base, cache),
      overrideName ? await fuzzyLookup(overrideName, cache) : null,
    ];

    // Pick: sheet-color match wins, then override, then fuzzy.
    const sheet = canonColors(sheetColors.get(name) ?? sheetColors.get(base) ?? "");
    let pick = null;
    if (sheet) {
      if (over && canonColors(over.colors) === sheet) pick = over;
      else if (fuzzy && canonColors(fuzzy.colors) === sheet) pick = fuzzy;
    }
    pick = pick ?? over ?? fuzzy;

    out.set(name, pick);
    if (!pick) unresolved.push(name);
  }

  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 1) + "\n", "utf8");
  if (unresolved.length) {
    console.warn(`\n⚠ ${unresolved.length} deck names could not be matched to a card ` +
      `(add to card-overrides.json "overrides" or "custom"):`);
    console.warn("  " + unresolved.join(" | "));
  }
  return out;
}
