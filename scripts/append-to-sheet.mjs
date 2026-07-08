#!/usr/bin/env node
/**
 * Append reviewed game rows to the Google Sheet "Game Log" tab.
 * ------------------------------------------------------------------
 * This is the WRITE half of the pipeline (build-data.mjs only reads). It uses a
 * Google service account so it can run unattended — no browser, no manual paste.
 *
 * Auth is done with a hand-rolled RS256 JWT (Node's built-in crypto) so there are
 * still zero npm dependencies. See scripts/SETUP-service-account.md for the
 * one-time Google Cloud setup.
 *
 * Usage:
 *   GOOGLE_SA_KEY=./secrets/sa.json node scripts/append-to-sheet.mjs rows.json
 *   (or set GOOGLE_SA_JSON to the raw key JSON, e.g. from a GitHub secret)
 *
 * rows.json is an array of games:
 *   [{ "date": "2026-05-29", "results": [
 *        { "placement": 1, "player": "Octaviano", "deck": "Valgavoth" }, ... ] }, ... ]
 *
 * The script writes one sheet row per result, matching the Game Log columns:
 *   DATE | GAME ID | PLACE | PLAYER | DECK NAME | CHECKED
 * GAME ID is a global sequential counter; the script reads the sheet's current
 * maximum and continues from there. DATE and GAME ID are written only on the
 * first row of each game (blank on continuation rows) to match the sheet's own
 * style and the parser in build-data.mjs. Pass --dry-run to preview without writing.
 */

import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";

const SHEET_ID = process.env.SHEET_ID || "1iHjEijCrgXprn8gHXZqqUHHGjcqKH1r-y1zGlsH5g8I";
const TAB = "Game Log";
const DRY = process.argv.includes("--dry-run");
const rowsPath = process.argv.find((a) => a.endsWith(".json") && !a.includes("sa"));

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function loadServiceAccount() {
  if (process.env.GOOGLE_SA_JSON) return JSON.parse(process.env.GOOGLE_SA_JSON);
  const p = process.env.GOOGLE_SA_KEY;
  if (!p) throw new Error("Set GOOGLE_SA_KEY (path to key file) or GOOGLE_SA_JSON (raw JSON).");
  return JSON.parse(await readFile(p, "utf8"));
}

/** Mint a Google OAuth access token from the service-account key (RS256 JWT). */
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(sa.private_key);
  const jwt = `${signingInput}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token request failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

/** Read the sheet's current max GAME ID via the public CSV endpoint. */
async function getMaxGameId() {
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB)}`);
  if (!res.ok) throw new Error(`Failed to read Game Log CSV: HTTP ${res.status}`);
  const text = await res.text();
  let max = 0;
  // GAME ID is the 2nd CSV column; quoted values like "394"
  for (const line of text.split("\n").slice(1)) {
    const m = line.match(/^"[^"]*","(\d+)"/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  if (!max) throw new Error("Could not determine current max GAME ID — refusing to guess.");
  return max;
}

/** Turn the reviewed games into Game Log sheet rows (global sequential GAME ID). */
function toSheetRows(games, startId) {
  const rows = [];
  let gid = startId;
  for (const g of games) {
    gid++;
    let firstOfGame = true;
    for (const r of g.results) {
      rows.push([
        firstOfGame ? isoToSheet(g.date) : "", // DATE      (first row of each game)
        firstOfGame ? String(gid) : "",        // GAME ID   (first row of each game)
        String(r.placement),                    // PLACE
        r.player,                               // PLAYER
        r.deck,                                 // DECK NAME
        "",                                     // CHECKED
      ]);
      firstOfGame = false;
    }
  }
  return rows;
}

const isoToSheet = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
};

async function main() {
  if (!rowsPath) throw new Error("Pass the path to a rows.json file.");
  const games = JSON.parse(await readFile(rowsPath, "utf8"));
  const maxId = await getMaxGameId();
  const rows = toSheetRows(games, maxId);
  console.log(`Current max GAME ID: ${maxId}. Prepared ${rows.length} sheet rows ` +
    `from ${games.length} games (ids ${maxId + 1}-${maxId + games.length}).`);

  if (DRY) {
    console.log("--dry-run: preview (not writing):");
    for (const r of rows) console.log("  " + r.map((c) => c || "·").join(" | "));
    return;
  }

  const sa = await loadServiceAccount();
  const token = await getAccessToken(sa);
  const range = encodeURIComponent(`${TAB}!A:F`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Append failed: ${JSON.stringify(data)}`);
  console.log(`✓ Appended ${data.updates?.updatedRows ?? rows.length} rows to "${TAB}".`);
  console.log("  Run `npm run data` (or wait for the weekly Action) to publish.");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
