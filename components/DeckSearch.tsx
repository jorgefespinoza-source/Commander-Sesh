"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import ScryfallArt from "@/components/ScryfallArt";
import ManaSymbols from "@/components/ManaSymbols";
import { stripOwnerSuffix } from "@/lib/stats";
import { searchCommanders, type ScryfallHit } from "@/lib/scryfall";

interface Props {
  value: string;
  onChange: (deck: string) => void;
  allDecks: { name: string; games: number }[];   // full deck list with popularity
  prevDecks: string[];                            // this player's decks, sorted by frequency
  placeholder?: string;
}

/**
 * Commander search bar: matches the pod's existing decks first; when the text
 * doesn't match anything, it live-searches Scryfall so a NEW deck can be created
 * with the official card name (and therefore art + colors) from day one.
 */
export default function DeckSearch({ value, onChange, allDecks, prevDecks, placeholder = "Search commander…" }: Props) {
  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [scryfall, setScryfall] = useState<ScryfallHit[]>([]);
  const [searching, setSearching] = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (name: string) =>
      !q ||
      name.toLowerCase().includes(q) ||
      stripOwnerSuffix(name).toLowerCase().includes(q);

    const prevSet = new Set(prevDecks);
    const prevMatched = prevDecks.filter(matches);
    const restMatched = allDecks
      .filter(d => !prevSet.has(d.name) && matches(d.name))
      .sort((a, b) => b.games - a.games)
      .map(d => d.name);

    return { prev: prevMatched.slice(0, 15), rest: restMatched.slice(0, 20) };
  }, [query, allDecks, prevDecks]);

  // Live Scryfall search when local matches are thin and query is meaningful.
  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setScryfall([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      searchCommanders(q).then(hits => {
        // hide cards that are already pod decks under the same official name
        const known = new Set([...suggestions.prev, ...suggestions.rest]
          .map(n => stripOwnerSuffix(n).toLowerCase()));
        setScryfall(hits.filter(h => !known.has(h.name.toLowerCase())));
        setSearching(false);
      });
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const allSuggestions = [
    ...suggestions.prev,
    ...suggestions.rest,
    ...scryfall.map(h => `scry:${h.name}`),
  ];

  function select(raw: string) {
    onChange(raw.startsWith("scry:") ? raw.slice(5) : raw);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const idx = focused ? allSuggestions.indexOf(focused) : -1;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused(allSuggestions[Math.min(idx + 1, allSuggestions.length - 1)]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocused(allSuggestions[Math.max(idx - 1, 0)]); }
    else if (e.key === "Enter" && focused) { e.preventDefault(); select(focused); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  }

  const rowStyle = (item: string): React.CSSProperties => ({
    background: focused === item ? "#1e1e38" : "transparent",
    borderBottom: "1px solid #1e1e3888",
  });

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected state */}
      {value && !open && (
        <button
          type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="w-full flex items-center gap-3 text-left rounded-lg px-3 py-2"
          style={{ background: "#1e1e38", border: "1px solid rgba(200,169,81,0.5)" }}>
          <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0">
            <ScryfallArt deckName={value} className="w-full h-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] text-gold/60 uppercase tracking-widest font-cinzel">Commander</div>
            <div className="text-sm text-parchment truncate">{value}</div>
          </div>
          <span className="text-muted text-xs">✎</span>
        </button>
      )}

      {/* Input */}
      {(!value || open) && (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value || placeholder}
          autoComplete="off"
          className="w-full rounded-lg px-3 py-2 text-sm text-parchment placeholder-muted outline-none"
          style={{ background: "#161628", border: "1px solid #1e1e38" }}
        />
      )}

      {/* Dropdown */}
      {open && (allSuggestions.length > 0 || searching) && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl overflow-y-auto"
          style={{ background: "#0f0f1c", border: "1px solid #1e1e38", maxHeight: "300px", boxShadow: "0 8px 32px #00000080" }}>

          {/* Player's previous decks */}
          {suggestions.prev.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[9px] uppercase tracking-widest font-cinzel text-gold/50">Your Decks</span>
              </div>
              {suggestions.prev.map(deck => (
                <DeckRow key={deck} deck={deck} style={rowStyle(deck)}
                  onMouseDown={() => select(deck)} onHover={() => setFocused(deck)} />
              ))}
            </>
          )}

          {/* Rest of pod decks */}
          {suggestions.rest.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[9px] uppercase tracking-widest font-cinzel text-muted/60">Pod Decks</span>
              </div>
              {suggestions.rest.map(deck => (
                <DeckRow key={deck} deck={deck} style={rowStyle(deck)}
                  onMouseDown={() => select(deck)} onHover={() => setFocused(deck)} />
              ))}
            </>
          )}

          {/* Scryfall results: create a new deck with the official card name */}
          {(scryfall.length > 0 || searching) && (
            <>
              <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-widest font-cinzel" style={{ color: "#7a5cc4" }}>
                  New from Scryfall
                </span>
                {searching && <span className="text-[9px] text-muted animate-pulse">searching…</span>}
              </div>
              {scryfall.map(hit => {
                const key = `scry:${hit.name}`;
                return (
                  <button key={key} type="button"
                    onMouseDown={e => { e.preventDefault(); select(key); }}
                    onMouseEnter={() => setFocused(key)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                    style={rowStyle(key)}>
                    <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-surface2">
                      {hit.art
                        ? /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={hit.art} alt={hit.name} className="w-full h-full object-cover" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center text-lg opacity-30">✦</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-parchment truncate">{hit.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ManaSymbols identity={hit.colors} size="sm" />
                        <span className="text-[9px]" style={{ color: "#7a5cc4" }}>official card · new deck</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DeckRow({ deck, style, onMouseDown, onHover }: {
  deck: string;
  style: React.CSSProperties;
  onMouseDown: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onMouseDown(); }}
      onMouseEnter={onHover}
      className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
      style={style}>
      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-surface2">
        <ScryfallArt deckName={deck} className="w-full h-full" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-parchment truncate">{deck}</div>
        <div className="text-[10px] text-muted">{stripOwnerSuffix(deck)}</div>
      </div>
    </button>
  );
}
