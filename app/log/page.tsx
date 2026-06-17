"use client";
import { useEffect, useState, useMemo } from "react";
import { getGames, getDecks } from "@/lib/data";
import type { GameEntry, DeckInfo } from "@/lib/types";

const PLAYERS = [
  "Blanca","Carlos","Caballol","Diame","Eddy","Gonzalo","Halvin","Ianfi",
  "Jorge Espinoza","Jorge Kourie","Jose","Konstantinos","Lasa","Mak",
  "Migue","Mike","Nicolas","Octaviano","Sabino","Wainer"
];

interface PlayerEntry {
  player: string;
  deck: string;
  placement: number;
}

const DEFAULT_ENTRY = (): PlayerEntry => ({ player: "", deck: "", placement: 0 });

export default function LogPage() {
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [entries, setEntries] = useState<PlayerEntry[]>([DEFAULT_ENTRY(), DEFAULT_ENTRY(), DEFAULT_ENTRY()]);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getDecks().then(setDecks);
  }, []);

  const deckNames = useMemo(() => {
    const sorted = [...decks].sort((a, b) => a.name.localeCompare(b.name));
    return sorted.map(d => d.name);
  }, [decks]);

  function updateEntry(i: number, field: keyof PlayerEntry, value: string | number) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  function addPlayer() {
    if (entries.length < 6) setEntries(prev => [...prev, DEFAULT_ENTRY()]);
  }

  function removePlayer(i: number) {
    if (entries.length > 2) setEntries(prev => prev.filter((_, idx) => idx !== i));
  }

  const isValid = entries.every(e => e.player && e.deck && e.placement > 0) &&
    new Set(entries.map(e => e.placement)).size === entries.length;

  const sorted = useMemo(() =>
    [...entries].sort((a, b) => a.placement - b.placement), [entries]);

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

  function handleSubmit() {
    // In the future this will POST to an API. For now just show the WhatsApp text.
    setSubmitted(true);
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
                <button onClick={() => removePlayer(i)} className="text-muted hover:text-red-400 text-xs transition-colors">
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                value={entry.player}
                onChange={e => updateEntry(i, "player", e.target.value)}
                className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-parchment outline-none focus:border-gold/50">
                <option value="">Player…</option>
                {PLAYERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={entry.placement}
                onChange={e => updateEntry(i, "placement", Number(e.target.value))}
                className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-parchment outline-none focus:border-gold/50">
                <option value={0}>Place…</option>
                {entries.map((_, j) => <option key={j + 1} value={j + 1}>{j + 1}{["st","nd","rd"][j] || "th"}</option>)}
              </select>
            </div>
            <select
              value={entry.deck}
              onChange={e => updateEntry(i, "deck", e.target.value)}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-parchment outline-none focus:border-gold/50">
              <option value="">Deck…</option>
              {deckNames.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        ))}
      </div>

      {entries.length < 6 && (
        <button onClick={addPlayer}
          className="w-full mt-3 py-2 rounded-lg text-sm text-muted border border-dashed border-border hover:border-gold/30 hover:text-gold transition-all">
          + Add Player
        </button>
      )}

      {!isValid && entries.some(e => e.player && e.deck && e.placement > 0) && (
        <p className="text-xs text-red-400/70 mt-2 text-center">
          Make sure all players have unique placements.
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isValid}
        className="w-full mt-5 py-4 rounded-lg font-cinzel font-bold text-base transition-all"
        style={{
          background: isValid ? "linear-gradient(135deg, #c8a951, #8a6f35)" : "#1e1e38",
          color: isValid ? "#08080f" : "#4a4a6a",
          cursor: isValid ? "pointer" : "not-allowed",
        }}>
        Record Game
      </button>
    </div>
  );
}
