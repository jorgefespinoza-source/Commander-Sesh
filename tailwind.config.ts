import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:       "#08080f",
        surface:  "#0f0f1c",
        surface2: "#161628",
        border:   "#1e1e38",
        gold:     "#c8a951",
        "gold-dim": "#8a6f35",
        "gold-bright": "#f0d060",
        parchment: "#e2e0d5",
        muted:    "#7a7898",
        mana: {
          W: "#f9f6e3",
          U: "#1a6fba",
          B: "#7030a0",
          R: "#d32f2f",
          G: "#2e7d32",
          C: "#9e9e9e",
        },
      },
      fontFamily: {
        cinzel: ["Cinzel", "serif"],
        body:   ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #c8a951, #f0d060, #c8a951)",
        "arcane-glow":   "radial-gradient(ellipse at 50% 0%, #1a1040 0%, #08080f 70%)",
      },
      boxShadow: {
        gold:  "0 0 20px rgba(200,169,81,0.15), 0 0 60px rgba(200,169,81,0.05)",
        card:  "0 4px 24px rgba(0,0,0,0.6)",
        glow:  "0 0 30px rgba(200,169,81,0.25)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease",
        "slide-up": "slideUp 0.3s ease",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
