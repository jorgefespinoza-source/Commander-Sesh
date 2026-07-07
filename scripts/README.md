# Data Pipeline

How game data gets from the pod into the live site — **no file downloads, no R, no Excel.**

```
Google Sheet (source of truth)  ->  build-data.mjs  ->  public/data/*.json  ->  Vercel
     Game Log + Deck List            (fetch + compute)      (15 JSON files)      (auto-deploy)
```

## Source of truth

The **Google Sheet** is canonical:
`https://docs.google.com/spreadsheets/d/1wrlHIJ6O6Z4kHnGcD2DhbUutuwIBLwN4/`

It's shared "anyone with the link," so the pipeline reads it as CSV with **zero credentials**.
Two tabs matter:

| Tab | Role | Columns used |
|-----|------|--------------|
| **Game Log** | every game result, one row per player per game | Date, Game, Placement, Player, Deck Name |
| **Deck List** | deck -> owner + color identity | Owner, Deck Name, and 5 positional W/U/B/R/G color columns |

The other tabs (Player Profile, Logger) are in-sheet dashboards and are ignored.

## What the build script does

`node scripts/build-data.mjs` (or `npm run data`):

1. Fetches both tabs via the Google `gviz` CSV endpoint.
2. **Cleans** the data: strips invisible/zero-width characters (e.g. a stray U+2060 that was splitting "Lasa"), applies name aliases (`config/aliases.json`), and **fills Date and Game number forward** so every row is dated — this fixes the old bug where ~1,000 rows had blank dates and silently dropped out of the season filter.
3. Recomputes all 15 JSON files the app loads from `public/data/`.
4. Prints a warning if any player in the Game Log isn't in the roster.

Zero npm dependencies — just Node 20+ built-ins.

## The roster (RD / MX leagues)

`config/leagues.json` is the **authoritative roster**. The RD/MX league split is an
assigned attribute that never lived in the sheet — it only survived in the old
`elo.json` and is preserved here.

- Only rostered players appear on leaderboards.
- Guests / typos still count as **opponents** (for ELO, pod size, head-to-head) but don't pollute the boards.
- When a new player shows up, the script warns you; add them to `leagues.json` with their league to put them on the board.

## Adding new game results (WhatsApp intake)

WhatsApp has no API, so this step is assisted rather than fully hands-off:

1. In a Claude session, ask Claude to read the **Leaderboards Commander** WhatsApp window and parse the new results.
2. Claude shows you the structured rows (date, game, placement, player, deck) for approval.
3. On approval, the rows are appended to the **Game Log** tab of the Google Sheet.
4. The next pipeline run (manual or the daily cron) picks them up automatically.

New deck names should also be added to the **Deck List** tab with their color identity.

## Running / automating

- **Locally:** `cd commander-sesh && npm run data`
- **Automatically:** the GitHub Action `.github/workflows/build-data.yml` runs the
  script on a **weekly cron** (Mondays) and on demand (Actions tab -> Run workflow). It commits
  `public/data/` only if something changed, and the push triggers Vercel to redeploy.

## Tunables

Top of `build-data.mjs`:

| Constant | Meaning |
|----------|---------|
| `MIN_GAMES_RANKING` | min games to appear in league rankings (20) |
| `MIN_GAMES_ANALYTICS` | min games for elo/streaks/kingmaker/tendencia (10) |
| `MIN_GAMES_H2H` | min shared games for a head-to-head pair (8) |
| `MIN_GAMES_MONTH_MVP` | min games in a month to be that month's MVP (3) |

## Note on ELO

ELO is a fresh, internally-consistent multiplayer rating (sequential pairwise,
K=24, base 1500) — not a reproduction of the original formula, which was
intentionally not carried over. Win rates, game counts, and league assignments
match the original data exactly.
