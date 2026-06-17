"use client";
import { useEffect, useState } from "react";
import { fetchCardArt } from "@/lib/scryfall";

interface Props {
  deckName: string;
  className?: string;
  fallbackBg?: string;
}

const FALLBACK_GRADIENT: Record<string, string> = {
  W: "from-amber-900 to-yellow-950",
  U: "from-blue-950 to-indigo-950",
  B: "from-purple-950 to-gray-950",
  R: "from-red-950 to-orange-950",
  G: "from-green-950 to-emerald-950",
};

function colorGradient(ci: string) {
  if (!ci || ci === "?") return "from-gray-900 to-gray-950";
  const first = ci[0].toUpperCase();
  return FALLBACK_GRADIENT[first] ?? "from-gray-900 to-gray-950";
}

export default function ScryfallArt({ deckName, className = "", fallbackBg = "" }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCardArt(deckName).then(art => {
      if (!cancelled) { setUrl(art); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [deckName]);

  if (loading) {
    return (
      <div className={`bg-gradient-to-br ${fallbackBg || "from-gray-900 to-gray-950"} animate-pulse ${className}`} />
    );
  }

  if (!url) {
    return (
      <div className={`bg-gradient-to-br ${fallbackBg || colorGradient("")} flex items-center justify-center ${className}`}>
        <span className="text-4xl opacity-20">⚔</span>
      </div>
    );
  }

  return (
    <div className={`commander-art ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={deckName} loading="lazy" />
    </div>
  );
}
