/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: { 850: "#151e32", 900: "#0f172a", 950: "#020617" },
        indigo: { 450: "#6366f1" },
        dicecho: {
          bg: "rgb(var(--theme-bg) / <alpha-value>)",
          panel: "rgb(var(--theme-panel) / <alpha-value>)",
          card: "rgb(var(--theme-card) / <alpha-value>)",
          raised: "rgb(var(--theme-raised) / <alpha-value>)",
          border: "rgb(var(--theme-border) / <alpha-value>)",
          primary: "rgb(var(--theme-primary) / <alpha-value>)",
          "primary-strong": "rgb(var(--theme-primary-strong) / <alpha-value>)",
          accent: "rgb(var(--theme-accent) / <alpha-value>)",
          rating: "rgb(var(--theme-rating) / <alpha-value>)",
          muted: "rgb(var(--theme-muted) / <alpha-value>)",
        },
      },
      animation: {
        blob: "blob 7s infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-in": "scaleIn 0.15s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
}
