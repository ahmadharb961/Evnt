import type { Config } from "tailwindcss";

// EVNT palette: white first, pastel accents, charcoal text.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#252525", soft: "#4a4a4a", muted: "#767676", line: "#ececec" },
        mint: { DEFAULT: "#B3E2CD", soft: "#e6f5ee", deep: "#2f7a5b" },
        peach: { DEFAULT: "#FDCDAC", soft: "#fff1e7", deep: "#a2531e" },
        powder: { DEFAULT: "#CBD5E8", soft: "#eef2f9", deep: "#3d5384" },
        blush: { DEFAULT: "#F4CAE4", soft: "#fcedf6", deep: "#9a3f78" },
        canvas: "#fafaf8",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        card: "0 1px 2px rgba(37,37,37,.04), 0 8px 24px -12px rgba(37,37,37,.12)",
        lift: "0 12px 32px -12px rgba(37,37,37,.22)",
      },
      keyframes: {
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pop: { "0%": { transform: "scale(1)" }, "50%": { transform: "scale(1.2)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "sheet-up": "sheet-up 260ms cubic-bezier(.2,.8,.2,1)",
        "fade-in": "fade-in 200ms ease-out",
        "rise-in": "rise-in 320ms ease-out both",
        pop: "pop 300ms ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
