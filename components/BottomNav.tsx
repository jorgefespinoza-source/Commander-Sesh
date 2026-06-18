"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",        label: "Pod",     icon: "🏆" },
  { href: "/stats",   label: "Stats",   icon: "📊" },
  { href: "/log",     label: "Log",     icon: "⚔" },
  { href: "/decks",   label: "Decks",   icon: "🃏" },
  { href: "/players", label: "Players", icon: "👤" },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50"
      style={{ background: "rgba(8,8,15,0.92)", backdropFilter: "blur(16px)", borderTop: "1px solid #1e1e38" }}>
      <div className="max-w-lg mx-auto flex">
        {TABS.map(tab => {
          const active = tab.href === "/" ? path === "/" : path.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 relative transition-colors"
              style={{ color: active ? "#c8a951" : "#7a7898" }}>
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[9px] font-semibold tracking-wide uppercase font-cinzel"
                style={{ color: active ? "#c8a951" : "#7a7898" }}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-6 h-0.5 rounded-full"
                  style={{ background: "#c8a951", boxShadow: "0 0 8px #c8a951" }} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
