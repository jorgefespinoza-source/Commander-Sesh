"use client";
import { useEffect, useState } from "react";
import { fetchCardArt } from "@/lib/scryfall";

/**
 * Full-page blurred commander-art backdrop. Pass the deck whose art should
 * glow behind the page (e.g. the current leader's favorite deck). Renders
 * nothing until the art URL is known, so pages never flash.
 */
export default function ArcaneBackdrop({ deckName }: { deckName: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!deckName) return;
    let cancelled = false;
    fetchCardArt(deckName).then(art => { if (!cancelled) setUrl(art); });
    return () => { cancelled = true; };
  }, [deckName]);

  if (!url) return null;
  return <div className="arcane-backdrop" style={{ backgroundImage: `url(${url})` }} />;
}
