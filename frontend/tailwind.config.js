/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--c-ink)",
          soft: "var(--c-ink-soft)",
          card: "var(--c-ink-card)",
          line: "var(--c-ink-line)",
        },
        bone: "var(--c-bone)",
        mist: "var(--c-mist)",
        ember: "#e8623a", // single warm accent, used with restraint
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.32em",
      },
      borderRadius: {
        xl2: "1.75rem",
      },
      keyframes: {
        drift: {
          "0%": { transform: "scale(1.08) translate3d(0,0,0)" },
          "100%": { transform: "scale(1.15) translate3d(-1.5%,-1.5%,0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        drift: "drift 24s ease-in-out infinite alternate",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
