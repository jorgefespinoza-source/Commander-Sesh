"use client";
import { useEffect, useState, useMemo } from "react";
import { getGames, getDecks } from "@/lib/data";
import type { GameEntry, DeckInfo } from "@/lib/types";
import DeckSearch from "@/components/DeckSearch";

const STORAGE_KEY_PLAYERS = "cdr_custom_players";

interface PlayerEntry {
  player: string;
  deck: string;
  placement: number;
}

const DEFAULT_ENTRY = (): PlayerEntry => ({ player: "", deck: "", placement: 0 });

export default function LogPage() {
  const [games, setGames]           = useState<GameEntry[]>([]);
  const [allDecks, setAllDecks]     = useState<{ name: string; games: number }[]>([]);
  const [knownPlayers, setKnownPlayers] = useState<string[]>([]);
  const [customPlayers, setCustomPlayers] = useState<string[]>([]);
  const [entries, setEntries]       = useState<PlayerEntry[]>([DEFAULT_ENTRY(), DEFAULT_ENTRY(), DEFAULT_ENTRY()]);
  const [submitted, setSubmitted]   = useState(false);
  const [copied, setCopied]         = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  useEffect(() => {
    // load custom players from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_PLAYERS) ?? "[]");
      if (Array.isArray(stored)) setCustomPlayers(stored);
    } catch { /* ignore */ }

    Promise.all([getGames(), getDecks()]).then(([g, d]: [GameEntry[], DeckInfo[]]) => {
      setGames(g);

      // derive known players sorted by game count
      const counts: Record<string, number> = {};
      for (const game of g) counts[game.player] = (counts[game.player] ?? 0) + 1;
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([p]) => p);
      setKnownPlayers(sorted);

      // build deck list with popularity
      const deckCounts: Record<string, number> = {};
      for (const game of g) deckCounts[game.deck] = (deckCounts[game.deck] ?? 0) + 1;
      // add any decks from decks.json not in game log
      for (const deck of d) {
        if (!deckCounts[deck.name]) deckCounts[deck.name] = 0;
      }
      const deckList = Object.entries(deckCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, cnt]) => ({ name, games: cnt }));
      setAllDecks(deckList);
    });
  }, []);

  const allPlayers = useMemo(() => {
    const known = new Set(knownPlayers);
    const extras = customPlayers.filter(p => !known.has(p));
    return [...knownPlayers, ...extras];
  }, [knownPlayers, customPlayers]);

  function saveCustomPlayer(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = [...customPlayers.filter(p => p !== trimmed), trimmed];
    setCustomPlayers(updated);
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(updated));
  }

  function updateEntry(i: number, field: keyof PlayerEntry, value: string | number) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  function addPlayer() {
    if (entries.length < 6) setEntries(prev => [...prev, DEFAULT_ENTRY()]);
  }

  function removePlayer(i: number) {
    if (entries.length > 2) setEntries(prev => prev.filter((_, idx) => idx !== i));
  }

  // per-player previous decks (derived from game log for the selected player)
  function prevDecksFor(playerName: string): string[] {
    if (!playerName) return [];
    const counts: Record<string, number> = {};
    for (const g of games) {
      if (g.player === playerName) counts[g.deck] = (counts[g.deck] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([d]) => d);
  }

  const isValid = entries.every(e => e.player && e.deck && e.placement > 0) &&
    new Set(entries.map(e => e.placement)).size === entries.length;

  const sorted = useMemo(() => [...entries].sort((a, b) => a.placement - b.placement), [entries]);

  const whatsAppText = useMemo(() => {
    if (!isValid) return "";
    const today = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const lines = sorted.map(e => `${e.placement}. ${e.player} - ${e.deck}`);
    return `🎴 Commander Sesh — ${today}\n${lines.join("\n")}`;
  }, [sorted, isValid]);

  function handleCopy() {
    navigator.clipboard.writeText(whatsAppText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-10 text-center">
        <div className="text-5xl mb-4">⚔️</div>
        <h2 className="font-cinzel text-2xl text-gold mb-2">Game Logged!</h2>
        <div className="card-arcane p-4 text-left mb-4">
          <pre className="text-sm text-parchment/80 whitespace-pre-wrap font-mono">{whatsAppText}</pre>
        </div>
        <button onClick={handleCopy}
          className="w-full py-3 rounded-lg font-cinzel font-bold text-sm mb-3 transition-all"
          style={{ background: copied ? "#2e7d32" : "#1e1e38", color: copied ? "#fff" : "#c8a951", border: "1px solid #c8a951" }}>
          {copied ? "✓ Copied!" : "Copy for WhatsApp"}
        </button>
        <button onClick={() => { setSubmitted(false); setEntries([DEFAULT_ENTRY(), DEFAULT_ENTRY(), DEFAULT_ENTRY()]); }}
          className="w-full py-3 rounded-lg font-cinzel text-sm text-muted border border-border">
          Log Another Game
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
      <h1 className="font-cinzel text-2xl font-bold text-gold-gradient mb-1">Log a Game</h1>
      <p className="text-muted text-sm mb-5">Enter results in any order — placement determines ranking.</p>

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="card-arcane p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-cinzel text-xs text-gold uppercase tracking-widest">Player {i + 1}</span>
              {entries.length > 2 && (
                <button onClick={() => removePlayer(i)} className="text-muted hover:text-red-400 text-xs">Remove</button>
              )}
            </div>

            {/* Player + Placement */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <select
                value={entry.player}
                onChange={e => {
                  if (e.target.value === "__new__") {
                    setAddingPlayer(true);
                  } else {
                    updateEntry(i, "player", e.target.value);
                  }
                }}
                className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-parchment outline-none focus:border-gold/50">
                <option value="">Player…</option>
                {allPlayers.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="__new__">+ New player…</option>
              </select>
              <select
                value={entry.placement}
                onChange={e => updateEntry(i, "placement", Number(e.target.value))}
                className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-parchment outline-none focus:border-gold/50">
                <option value={0}>Place…</option>
                {entries.map((_, j) => {
                  const ord = ["st","nd","rd"][j] ?? "th";
                  return <option key={j+1} value={j+1}>{j+1}{ord}</option>;
                })}
              </select>
            </div>

            {/* Deck search */}
            <DeckSearch
              value={entry.deck}
              onChange={v => updateEntry(i, "deck", v)}
              allDecks={allDecks}
              prevDecks={prevDecksFor(entry.player)}
            />
          </div>
        ))}
      </div>

      {/* Add new player modal */}
      {addingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="card-arcane p-5 w-full max-w-sm">
            <h3 className="font-cinzel text-gold text-base mb-3">New Player</h3>
            <input
              type="text"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newPlayerName.trim()) {
                  saveCustomPlayer(newPlayerName);
                  setAddingPlayer(false);
                  setNewPlayerName("");
                }
              }}
              placeholder="Player name…"
              autoFocus
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-parchment outline-none focus:border-gold/50 mb-3"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setAddingPlayer(false); setNewPlayerName(""); }}
                className="py-2 rounded-lg text-sm text-muted border border-border">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newPlayerName.trim()) {
                    saveCustomPlayer(newPlayerName);
                    setAddingPlayer(false);
                    setNewPlayerName("");
                  }
                }}
                className="py-2 rounded-lg text-sm font-bold font-cinzel"
                style={{ background: "linear-gradient(135deg,#c8a951,#8a6f35)", color: "#08080f" }}>
                Add Player
              </button>
            </div>
          </div>
        </div>
      )}

      {entries.length < 6 && (
        <button onClick={addPlayer}
          className="w-full mt-3 py-2 rounded-lg text-sm text-muted border border-dashed border-border hover:border-gold/30 hover:text-gold transition-all">
          + Add Player
        </button>
      )}

      {!isValid && entries.some(e => e.player && e.deck && e.placement > 0) && (
        <p className="text-xs text-red-400/70 mt-2 text-center">All players need unique placements.</p>
      )}

      <button
        onClick={() => setSubmitted(true)}
        disabled={!isValid}
        className="w-full mt-5 py-4 rounded-lg font-cinzel font-bold text-base transition-all"
        style={{
          background: isValid ? "linear-gradient(135deg,#c8a951,#8a6f35)" : "#1e1e38",
          color: isValid ? "#08080f" : "#4a4a6a",
          cursor: isValid ? "pointer" : "not-allowed",
        }}>
        Record Game
      </button>
    </div>
  );
}
