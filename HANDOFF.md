# Commander Sesh — Handoff Notes

## What This Is

A mobile-first web app for tracking Magic: The Gathering Commander games for a 20-player pod. Live at **https://commander-sesh.vercel.app**.

Built with Next.js 14 / TypeScript / Tailwind CSS. No backend, no database — all data is static JSON served from Vercel.

---

## Current State (as of June 2026)

### ✅ Done
- Full web app deployed to Vercel: leaderboard, deck gallery, player profiles, game log form
- 1,193 game entries exported from the original Excel spreadsheet into `public/data/games.json`
- 170 deck entries in `public/data/decks.json`
- Scryfall API integration for commander card art (with 40+ name overrides for pod-specific deck names)
- Season filter (2025 / 2026 / All Time)
- Dark arcane visual theme (deep black + gold, Cinzel font, mana color pips)
- Google Sheet for collaborative data cleanup: https://docs.google.com/spreadsheets/d/1cy-6SKOPfErNjVy0wHgLpZGvOXIzSWqN2Qpw2Wy1V5E

### 🔴 Not Done Yet
- GitHub repo not yet created (was in progress when session ended — needs `gh auth login`)
- Vercel not yet connected to GitHub (currently deployed via Vercel CLI directly)
- Google Sheet sharing not yet set to "anyone with link can edit" (Share button flow was interrupted)
- Game log form (Log tab) is UI-only — does not actually save games anywhere yet
- Data has not been cleaned yet (see Data Issues below)

---

## Data Issues (needs manual cleanup in the Google Sheet)

### Missing dates — ~1,073 rows
The original Excel had dates only on the first row of each game session. The fill-down export failed. Every game entry needs a date filled in.

### Duplicate / unknown player names
The data has 35 unique player names but the pod only has 20 members. Known issues:
- `Harly` / `Harley` — likely same person, correct spelling unknown
- `Migue` / `Miguel` / `Miguel H` — confirm if same or different people
- `Mart` — likely a typo
- `Santiago`, `Diego`, `Fausto`, `Kilora`, `Pedro`, `Periche`, `Rafi`, `Samuel`, `Alexis`, `Arturo` — guests or typos, need confirmation

### Decks missing color identity
- `Ulalek (H)`, `Ulalek (J)`, `Zhudolock`, `Kozilek`, `Ulamog` — all colorless Eldrazi, should be tagged `C`

### One blank deck name entry
One game row has an empty deck name.

---

## How to Update the App With Fixed Data

1. Edit the Google Sheet (Games / Players / Decks tabs)
2. Export the corrected data as CSV or have someone run the update script
3. Replace `public/data/games.json` and `public/data/decks.json`
4. Run `vercel --prod` from the `commander-sesh/` folder to redeploy

---

## Key Files

```
commander-sesh/
├── app/
│   ├── page.tsx              # Leaderboard (home)
│   ├── decks/page.tsx        # Deck gallery
│   ├── decks/[name]/page.tsx # Deck detail
│   ├── players/page.tsx      # Players list
│   ├── players/[name]/page.tsx # Player profile
│   ├── log/page.tsx          # Game log form (UI only)
│   └── globals.css           # Full dark arcane theme
├── lib/
│   ├── stats.ts              # All stats calculations
│   ├── scryfall.ts           # Card art fetching + name overrides
│   ├── data.ts               # JSON data loader
│   └── types.ts              # TypeScript interfaces
├── components/
│   ├── BottomNav.tsx         # Fixed bottom tab nav
│   ├── ScryfallArt.tsx       # Card art component
│   ├── ManaSymbols.tsx       # Colored mana pip circles
│   └── SeasonFilter.tsx      # Year filter buttons
└── public/data/
    ├── games.json            # 1,193 game entries
    └── decks.json            # 170 deck entries
```

---

## Key Decisions & Constraints

- **No backend / no database** by design — keeps it free and simple. Game logging (Log tab) will need either a backend or a Google Sheets write integration to actually save data.
- **Scryfall API** is called client-side with a module-level cache. Custom/fan cards (Avatar Aang, Makima, etc.) are in a `CUSTOM_CARDS` set and get a gradient fallback instead.
- **Deck name format**: `Commander Name (X)` where X is the owner's initial. The stats engine strips the suffix for Scryfall lookups.
- **Next.js 14** (not 15) — `next.config.ts` is not supported; must use `next.config.mjs`.
- **Vercel deployment**: currently via CLI (`vercel --prod`). To connect to GitHub for auto-deploy, run `gh auth login` then link via Vercel dashboard.

---

## Pod Members (20 active players)

Blanca, Carlos, Caballol, Diame, Eddy, Gonzalo, Halvin, Ianfi, Jorge Espinoza, Jorge Kourie, Jose, Konstantinos, Lasa, Mak, Migue, Mike, Nicolas, Octaviano, Sabino, Wainer

---

## To Resume GitHub Setup

```powershell
# In commander-sesh/ directory:
$env:Path += ";C:\Users\Jorge\AppData\Roaming\npm"
gh auth login --web --git-protocol https
# Enter the device code shown in the browser within 30 seconds
gh repo create commander-sesh --public --source=. --remote=origin --push
```

Then connect Vercel to the GitHub repo via https://vercel.com/dashboard → project settings → Git.
